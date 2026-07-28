"""Read-only LanceDB inspection operations for the administrator API.

The service deliberately selects scalar columns for normal row browsing and
loads a full vector only for an explicit row-detail request.  Query inputs are
validated before they reach LanceDB and table names are resolved from the active
connection instead of being concatenated into filesystem paths.
"""

from __future__ import annotations

import json
import math
import re
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from heapq import heappush, heapreplace
from typing import Any

from constants import DATABASE_PATH
from models.admin_lancedb import (
    LanceEmbeddingFunction,
    LanceFilterState,
    LancePagination,
    LanceRowDetailResponse,
    LanceRowsResponse,
    LanceRowSummary,
    LanceSchemaField,
    LanceSortState,
    LanceTableDetailsResponse,
    LanceTableItem,
    LanceTablesResponse,
    LanceVectorColumn,
    LanceVectorSummary,
    LanceVectorValues,
    SortColumn,
    SortOrder,
)

_TABLE_NAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")
_SORTABLE_COLUMNS: set[str] = {"image_uri", "tag", "hash", "mtime"}
_GRID_COLUMNS = ["image_uri", "tag", "hash", "mtime"]
_SENSITIVE_METADATA_PARTS = (
    "api_key",
    "apikey",
    "secret",
    "token",
    "password",
    "credential",
)
_STREAM_BATCH_SIZE = 1024


class LanceDBAdminError(RuntimeError):
    """Base class for errors that can be safely mapped by the API layer."""


class LanceDBTableNotFound(LanceDBAdminError):
    pass


class LanceDBRowNotFound(LanceDBAdminError):
    pass


class LanceDBValidationError(LanceDBAdminError):
    pass


class LanceDBUnavailable(LanceDBAdminError):
    pass


@dataclass(frozen=True)
class _ReverseKey:
    """Heap key whose comparison is reversed for bounded ascending selection."""

    value: tuple[Any, ...]

    def __lt__(self, other: "_ReverseKey") -> bool:
        return self.value > other.value


class LanceDBAdminService:
    """Inspection façade around a LanceDB connection.

    Factories are injectable so the service can be exhaustively tested without
    importing or initialising the heavyweight embedding stack.
    """

    def __init__(
        self,
        connection_factory: Callable[[str], Any] | None = None,
        table_factory: Callable[[str, str], Any] | None = None,
    ) -> None:
        self._connection_factory = connection_factory
        self._table_factory = table_factory

    def _get_connection(self) -> Any:
        try:
            if self._connection_factory is not None:
                return self._connection_factory(DATABASE_PATH)

            from image_search.db.connection import get_db_connection

            return get_db_connection(DATABASE_PATH)
        except Exception as error:  # pragma: no cover - real driver path
            raise LanceDBUnavailable("Unable to connect to LanceDB.") from error

    def _list_table_names(self) -> list[str]:
        connection = self._get_connection()
        try:
            table_names = connection.table_names()
            return sorted(str(name) for name in table_names)
        except Exception as error:
            raise LanceDBUnavailable("Unable to list LanceDB tables.") from error

    def list_tables(self) -> LanceTablesResponse:
        return LanceTablesResponse(
            tables=[LanceTableItem(name=name) for name in self._list_table_names()]
        )

    def _validate_table_name(self, table_name: str) -> None:
        if not _TABLE_NAME_PATTERN.fullmatch(table_name):
            raise LanceDBValidationError("Invalid LanceDB table name.")

    def _open_table(self, table_name: str) -> Any:
        self._validate_table_name(table_name)
        if table_name not in self._list_table_names():
            raise LanceDBTableNotFound("The selected LanceDB table was not found.")

        try:
            if self._table_factory is not None:
                return self._table_factory(DATABASE_PATH, table_name)

            from image_search.db.connection import get_table

            return get_table(DATABASE_PATH, table_name)
        except LanceDBAdminError:
            raise
        except Exception as error:
            raise LanceDBUnavailable(
                "Unable to open the selected LanceDB table."
            ) from error

    @staticmethod
    def _table_schema(table: Any) -> Any:
        try:
            schema = getattr(table, "schema")
            return schema() if callable(schema) else schema
        except Exception as error:
            raise LanceDBUnavailable("Unable to read the table schema.") from error

    @staticmethod
    def _vector_dimension(data_type: Any) -> int | None:
        for attribute in ("list_size", "value_length"):
            value = getattr(data_type, attribute, None)
            if isinstance(value, int) and value >= 0:
                return value

        text = str(data_type)
        match = re.search(r"\[(\d+)\]", text)
        return int(match.group(1)) if match else None

    @classmethod
    def _schema_fields(
        cls, schema: Any
    ) -> tuple[list[LanceSchemaField], list[LanceVectorColumn]]:
        fields: list[LanceSchemaField] = []
        vectors: list[LanceVectorColumn] = []

        for field in schema:
            dimension = cls._vector_dimension(field.type)
            is_vector = dimension is not None or field.name == "vector"
            fields.append(
                LanceSchemaField(
                    name=str(field.name),
                    type=str(field.type),
                    nullable=bool(getattr(field, "nullable", True)),
                    is_vector=is_vector,
                )
            )
            if is_vector:
                vectors.append(
                    LanceVectorColumn(name=str(field.name), dimension=dimension or 0)
                )

        return fields, vectors

    @classmethod
    def _serialise_value(cls, value: Any) -> Any:
        if value is None or isinstance(value, (str, bool, int)):
            return value

        if isinstance(value, float):
            return value if math.isfinite(value) else None

        if isinstance(value, Decimal):
            converted = float(value)
            return converted if math.isfinite(converted) else None

        if isinstance(value, (datetime, date)):
            return value.isoformat()

        if isinstance(value, bytes):
            return value.decode("utf-8", errors="replace")

        if isinstance(value, Mapping):
            return {
                str(cls._serialise_value(key)): cls._serialise_value(item)
                for key, item in value.items()
            }

        if isinstance(value, (list, tuple, set)):
            return [cls._serialise_value(item) for item in value]

        to_list = getattr(value, "tolist", None)
        if callable(to_list):
            return cls._serialise_value(to_list())

        as_py = getattr(value, "as_py", None)
        if callable(as_py):
            return cls._serialise_value(as_py())

        item = getattr(value, "item", None)
        if callable(item):
            try:
                return cls._serialise_value(item())
            except (TypeError, ValueError):
                pass

        return str(value)

    @classmethod
    def _redact_metadata(cls, value: Any, key_hint: str = "") -> Any:
        if any(part in key_hint.lower() for part in _SENSITIVE_METADATA_PARTS):
            return "[redacted]"

        if isinstance(value, Mapping):
            return {
                str(key): cls._redact_metadata(item, str(key))
                for key, item in value.items()
            }

        if isinstance(value, list):
            return [cls._redact_metadata(item, key_hint) for item in value]

        return value

    @classmethod
    def _schema_metadata(cls, schema: Any) -> dict[str, Any]:
        raw_metadata = getattr(schema, "metadata", None) or {}
        decoded: dict[str, Any] = {}

        for raw_key, raw_value in raw_metadata.items():
            key = cls._serialise_value(raw_key)
            value = cls._serialise_value(raw_value)
            if not isinstance(key, str):
                key = str(key)

            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    pass

            decoded[key] = cls._redact_metadata(value, key)

        return decoded

    @classmethod
    def _embedding_functions(cls, table: Any) -> list[LanceEmbeddingFunction]:
        try:
            raw_configs = getattr(table, "embedding_functions", {})
            configs = raw_configs() if callable(raw_configs) else raw_configs
        except Exception:
            configs = {}

        if not isinstance(configs, Mapping):
            return []

        result: list[LanceEmbeddingFunction] = []
        for vector_name, config in configs.items():
            function = getattr(config, "function", None)
            name_value = getattr(function, "name", None)
            if callable(name_value):
                try:
                    name_value = name_value()
                except TypeError:
                    name_value = None
            function_name = (
                name_value
                or getattr(function, "__name__", None)
                or (function.__class__.__name__ if function is not None else "unknown")
            )
            result.append(
                LanceEmbeddingFunction(
                    name=str(function_name),
                    source_column=str(getattr(config, "source_column", "")),
                    vector_column=str(
                        getattr(config, "vector_column", None) or vector_name
                    ),
                )
            )

        return result

    def get_table_details(self, table_name: str) -> LanceTableDetailsResponse:
        table = self._open_table(table_name)
        schema = self._table_schema(table)
        schema_fields, vector_columns = self._schema_fields(schema)

        try:
            row_count = int(table.count_rows())
        except Exception as error:
            raise LanceDBUnavailable("Unable to count table rows.") from error

        return LanceTableDetailsResponse(
            name=table_name,
            row_count=row_count,
            table_schema=schema_fields,
            schema_metadata=self._schema_metadata(schema),
            embedding_functions=self._embedding_functions(table),
            vector_columns=vector_columns,
        )

    @staticmethod
    def _build_tag_filter(tag: str | None) -> str | None:
        if tag is None:
            return None

        clean = tag.strip()
        if not clean:
            return None
        if len(clean) > 128 or any(ord(char) < 32 for char in clean):
            raise LanceDBValidationError("Invalid tag filter.")

        escaped = clean.replace("'", "''")
        return f"tag = '{escaped}'"

    @staticmethod
    def _normalise_sort(
        sort_by: SortColumn | None, sort_order: SortOrder
    ) -> tuple[str | None, SortOrder]:
        if sort_by is not None and sort_by not in _SORTABLE_COLUMNS:
            raise LanceDBValidationError("Invalid sort column.")
        if sort_order not in ("asc", "desc"):
            raise LanceDBValidationError("Invalid sort order.")
        return sort_by, sort_order

    @staticmethod
    def _apply_ordering(query: Any, sort_by: str, sort_order: SortOrder) -> Any:
        """Apply Lance's native scalar ordering without importing it at startup."""

        try:
            from lance.dataset import ColumnOrdering
        except ImportError:
            # Test doubles and older compatible query builders commonly accept
            # the same lightweight ``(column, direction)`` representation.
            return query.order_by([(sort_by, sort_order)])

        ordering = ColumnOrdering(
            sort_by,
            ascending=sort_order == "asc",
            nulls_first=False,
        )
        return query.order_by([ordering])

    @classmethod
    def _query_rows(
        cls,
        table: Any,
        *,
        columns: list[str],
        row_filter: str | None,
        limit: int,
        offset: int,
        sort_by: str | None,
        sort_order: SortOrder,
    ) -> list[dict[str, Any]]:
        try:
            query = table.search()
            if columns:
                query = query.select(columns)
            query = query.with_row_id(True)
            if row_filter:
                query = query.where(row_filter)

            if sort_by and hasattr(query, "order_by"):
                query = cls._apply_ordering(query, sort_by, sort_order)

            if sort_by and not hasattr(query, "order_by"):
                return cls._streaming_sorted_rows(
                    query,
                    sort_by=sort_by,
                    sort_order=sort_order,
                    offset=offset,
                    limit=limit,
                )

            return list(query.limit(limit).offset(offset).to_list())
        except LanceDBAdminError:
            raise
        except Exception as error:
            raise LanceDBUnavailable("Unable to read LanceDB rows.") from error

    @classmethod
    def _streaming_sorted_rows(
        cls,
        query: Any,
        *,
        sort_by: str,
        sort_order: SortOrder,
        offset: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        """Memory-bounded compatibility sort for LanceDB versions without order_by.

        Only the best ``offset + limit`` rows are retained while batches are
        scanned.  This avoids materialising the complete table while preserving
        correct global ordering for the requested page.
        """

        target_count = offset + limit
        if target_count <= 0:
            return []

        heap: list[tuple[Any, int, dict[str, Any]]] = []
        sequence = 0
        batches = query.to_batches(batch_size=_STREAM_BATCH_SIZE)

        for batch in batches:
            rows = batch.to_pylist()
            for row in rows:
                key = cls._bounded_selection_key(row.get(sort_by), sort_order)
                heap_key: Any = _ReverseKey(key) if sort_order == "asc" else key
                item = (heap_key, sequence, row)
                sequence += 1

                if len(heap) < target_count:
                    heappush(heap, item)
                    continue

                root_key = heap[0][0]
                if heap_key > root_key:
                    heapreplace(heap, item)

        rows = [item[2] for item in heap]
        non_null_rows = [
            row
            for row in rows
            if cls._serialise_value(row.get(sort_by)) is not None
        ]
        null_rows = [
            row
            for row in rows
            if cls._serialise_value(row.get(sort_by)) is None
        ]
        non_null_rows.sort(
            key=lambda row: cls._sort_key(row.get(sort_by)),
            reverse=sort_order == "desc",
        )
        ordered_rows = non_null_rows + null_rows
        return ordered_rows[offset : offset + limit]

    @classmethod
    def _sort_key(cls, value: Any) -> tuple[Any, ...]:
        serialised = cls._serialise_value(value)
        if serialised is None:
            return (3, "")
        if isinstance(serialised, bool):
            return (0, int(serialised))
        if isinstance(serialised, (int, float)):
            return (1, serialised)
        return (2, str(serialised).casefold())

    @classmethod
    def _bounded_selection_key(
        cls, value: Any, sort_order: SortOrder
    ) -> tuple[Any, ...]:
        serialised = cls._serialise_value(value)
        if serialised is None:
            # Nulls are always last, regardless of direction.  Ascending keeps
            # them as the largest values; descending keeps them as the smallest.
            return (1, 3, "") if sort_order == "asc" else (0, 0, "")

        type_rank, comparable = cls._sort_key(serialised)
        if sort_order == "asc":
            return (0, type_rank, comparable)
        return (1, type_rank, comparable)

    @staticmethod
    def _vector_dimension_for_table(table: Any) -> int:
        schema = LanceDBAdminService._table_schema(table)
        _, vector_columns = LanceDBAdminService._schema_fields(schema)
        if not vector_columns:
            return 0
        return vector_columns[0].dimension

    @classmethod
    def _row_summary(cls, row: Mapping[str, Any], vector_length: int) -> LanceRowSummary:
        row_id = row.get("_rowid")
        if row_id is None:
            raise LanceDBUnavailable("LanceDB did not return row identifiers.")

        return LanceRowSummary(
            row_id=int(row_id),
            image_uri=cls._optional_string(row.get("image_uri")),
            tag=cls._optional_string(row.get("tag")),
            hash=cls._optional_string(row.get("hash")),
            mtime=cls._serialise_value(row.get("mtime")),
            vector=LanceVectorSummary(length=vector_length, included=False),
        )

    @classmethod
    def _optional_string(cls, value: Any) -> str | None:
        serialised = cls._serialise_value(value)
        if serialised is None:
            return None
        return str(serialised)

    def get_rows(
        self,
        table_name: str,
        *,
        page: int = 1,
        page_size: int = 25,
        tag: str | None = None,
        sort_by: SortColumn | None = None,
        sort_order: SortOrder = "asc",
    ) -> LanceRowsResponse:
        if page < 1:
            raise LanceDBValidationError("Page must be at least 1.")
        if page_size < 1 or page_size > 100:
            raise LanceDBValidationError("Page size must be between 1 and 100.")

        sort_by, sort_order = self._normalise_sort(sort_by, sort_order)
        row_filter = self._build_tag_filter(tag)
        table = self._open_table(table_name)
        schema = self._table_schema(table)
        available_columns = {str(field.name) for field in schema}
        selected_columns = [
            column for column in _GRID_COLUMNS if column in available_columns
        ]
        if row_filter and "tag" not in available_columns:
            raise LanceDBValidationError(
                "The selected table does not contain a tag column."
            )
        if sort_by and sort_by not in available_columns:
            raise LanceDBValidationError(
                f"The selected table does not contain the {sort_by} column."
            )

        try:
            total_rows = int(table.count_rows(filter=row_filter))
        except TypeError:
            total_rows = int(table.count_rows(row_filter))
        except Exception as error:
            raise LanceDBUnavailable("Unable to count filtered rows.") from error

        total_pages = math.ceil(total_rows / page_size) if total_rows else 0
        safe_page = min(page, total_pages) if total_pages else 1
        offset = (safe_page - 1) * page_size
        raw_rows = self._query_rows(
            table,
            columns=selected_columns,
            row_filter=row_filter,
            limit=page_size,
            offset=offset,
            sort_by=sort_by,
            sort_order=sort_order,
        )
        vector_length = self._vector_dimension_for_table(table)
        rows = [self._row_summary(row, vector_length) for row in raw_rows]

        return LanceRowsResponse(
            table=table_name,
            rows=rows,
            pagination=LancePagination(
                page=safe_page,
                page_size=page_size,
                total_rows=total_rows,
                total_pages=total_pages,
                has_next=safe_page < total_pages,
                has_previous=total_pages > 0 and safe_page > 1,
            ),
            filter=LanceFilterState(tag=tag.strip() if tag and tag.strip() else None),
            sort=LanceSortState(column=sort_by, order=sort_order),
        )

    @classmethod
    def _vector_values(cls, raw_vector: Any) -> list[float | None]:
        serialised = cls._serialise_value(raw_vector)
        if serialised is None:
            return []
        if not isinstance(serialised, list):
            raise LanceDBUnavailable("The selected row has an invalid vector value.")

        values: list[float | None] = []
        for value in serialised:
            if value is None:
                values.append(None)
                continue
            try:
                converted = float(value)
            except (TypeError, ValueError) as error:
                raise LanceDBUnavailable(
                    "The selected row has an invalid vector value."
                ) from error
            values.append(converted if math.isfinite(converted) else None)
        return values

    def get_row(self, table_name: str, row_id: int) -> LanceRowDetailResponse:
        if row_id < 0:
            raise LanceDBValidationError("Row ID must not be negative.")

        table = self._open_table(table_name)
        try:
            try:
                query = table.take_row_ids([row_id], with_row_id=True)
            except TypeError:
                query = table.take_row_ids([row_id])
                if hasattr(query, "with_row_id"):
                    try:
                        query = query.with_row_id(True)
                    except TypeError:
                        # Async-style builders expose a no-argument variant.
                        query = query.with_row_id()

            if hasattr(query, "to_list"):
                rows = list(query.to_list())
            elif hasattr(query, "to_pylist"):
                rows = list(query.to_pylist())
            else:
                raise LanceDBUnavailable(
                    "The LanceDB row result cannot be serialised."
                )
        except LanceDBAdminError:
            raise
        except Exception as error:
            raise LanceDBUnavailable("Unable to read the selected row.") from error

        if not rows:
            raise LanceDBRowNotFound("The selected LanceDB row was not found.")

        row = rows[0]
        vector_values = self._vector_values(row.get("vector"))
        actual_row_id = row.get("_rowid", row_id)
        return LanceRowDetailResponse(
            row_id=int(actual_row_id),
            image_uri=self._optional_string(row.get("image_uri")),
            tag=self._optional_string(row.get("tag")),
            hash=self._optional_string(row.get("hash")),
            mtime=self._serialise_value(row.get("mtime")),
            vector=LanceVectorValues(
                length=len(vector_values),
                values=vector_values,
            ),
        )
