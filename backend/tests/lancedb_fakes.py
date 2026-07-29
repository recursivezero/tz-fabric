"""Small LanceDB-compatible fakes used by the administrator API tests."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class FakeDataType:
    label: str
    list_size: int | None = None

    def __str__(self) -> str:
        if self.list_size is not None:
            return f"fixed_size_list<item: float>[{self.list_size}]"
        return self.label


@dataclass
class FakeField:
    name: str
    type: FakeDataType
    nullable: bool = True


class FakeSchema(list[FakeField]):
    def __init__(self) -> None:
        super().__init__(
            [
                FakeField("vector", FakeDataType("vector", list_size=4)),
                FakeField("image_uri", FakeDataType("string"), False),
                FakeField("tag", FakeDataType("string"), False),
                FakeField("hash", FakeDataType("string"), False),
                FakeField("mtime", FakeDataType("double"), False),
            ]
        )
        self.metadata = {
            b"embedding": b'{"provider":"siglip","api_token":"hidden"}',
            b"owner": b"threadzip",
        }


@dataclass
class FakeEmbeddingFunction:
    name: str = "siglip"


@dataclass
class FakeEmbeddingConfig:
    source_column: str = "image_uri"
    vector_column: str = "vector"
    function: FakeEmbeddingFunction = field(default_factory=FakeEmbeddingFunction)


class FakeBatch:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self._rows = rows

    def to_pylist(self) -> list[dict[str, Any]]:
        return list(self._rows)


class FakeQuery:
    def __init__(
        self,
        table: "FakeTable",
        rows: list[dict[str, Any]] | None = None,
    ) -> None:
        self.table = table
        self.rows = list(table.rows if rows is None else rows)
        self.columns: list[str] | None = None
        self.include_row_id = False
        self.offset_value = 0
        self.limit_value: int | None = None
        self.ordering: list[Any] | None = None

    def select(self, columns: list[str]) -> "FakeQuery":
        self.columns = list(columns)
        self.table.last_selected_columns = list(columns)
        return self

    def with_row_id(self, enabled: bool) -> "FakeQuery":
        self.include_row_id = enabled
        self.table.last_with_row_id = enabled
        return self

    def where(self, expression: str) -> "FakeQuery":
        prefix = "tag = '"
        if not expression.startswith(prefix) or not expression.endswith("'"):
            raise ValueError("unsafe expression")

        value = expression[len(prefix) : -1].replace("''", "'")
        self.rows = [row for row in self.rows if row.get("tag") == value]
        self.table.last_filter = expression
        return self

    def order_by(self, ordering: list[Any]) -> "FakeQuery":
        self.ordering = ordering

        order = ordering[0]

        if isinstance(order, tuple):
            column, direction = order
        elif isinstance(order, dict):
            column = str(order["column_name"])
            direction = "asc" if bool(order["ascending"]) else "desc"
        else:
            column = str(order.column_name)
            direction = "asc" if bool(order.ascending) else "desc"

        self.table.last_ordering = [(column, direction)]
        self.rows.sort(
            key=lambda row: (
                row.get(column) is None,
                row.get(column),
            ),
            reverse=direction == "desc",
        )
        return self

    def limit(self, value: int) -> "FakeQuery":
        self.limit_value = value
        self.table.last_limit = value
        return self

    def offset(self, value: int) -> "FakeQuery":
        self.offset_value = value
        self.table.last_offset = value
        return self

    def _project(self, row: dict[str, Any]) -> dict[str, Any]:
        projected = (
            {column: row.get(column) for column in self.columns}
            if self.columns is not None
            else dict(row)
        )
        if self.include_row_id or "_rowid" in row:
            projected["_rowid"] = row["_rowid"]
        return projected

    def to_list(self) -> list[dict[str, Any]]:
        start = self.offset_value
        stop = None if self.limit_value is None else start + self.limit_value
        return [self._project(row) for row in self.rows[start:stop]]

    def to_batches(self, batch_size: int | None = None):
        self.table.last_batch_size = batch_size
        size = batch_size or 1024
        for index in range(0, len(self.rows), size):
            yield FakeBatch(
                [self._project(row) for row in self.rows[index : index + size]]
            )


class FakeArrowTableResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def to_pylist(self) -> list[dict[str, Any]]:
        return [dict(row) for row in self.rows]


class FakeTakeQuery:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def with_row_id(self, enabled: bool = True) -> "FakeTakeQuery":
        return self

    def to_list(self) -> list[dict[str, Any]]:
        return [dict(row) for row in self.rows]


class FakeTable:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.rows = (
            [
                {
                    "_rowid": 0,
                    "vector": [0.1, 0.2, 0.3, 0.4],
                    "image_uri": "https://assets.threadzip.com/images/a.webp",
                    "tag": "product",
                    "hash": "hash-a",
                    "mtime": 10.0,
                },
                {
                    "_rowid": 1,
                    "vector": [0.5, 0.6, 0.7, 0.8],
                    "image_uri": "https://assets.threadzip.com/images/b.webp",
                    "tag": "embroidery",
                    "hash": "hash-b",
                    "mtime": 30.0,
                },
                {
                    "_rowid": 2,
                    "vector": [0.9, 1.0, 1.1, 1.2],
                    "image_uri": "https://assets.threadzip.com/images/c.webp",
                    "tag": "product",
                    "hash": "hash-c",
                    "mtime": 20.0,
                },
            ]
            if rows is None
            else rows
        )
        self.schema = FakeSchema()
        self.embedding_functions = {"vector": FakeEmbeddingConfig()}
        self.last_selected_columns: list[str] | None = None
        self.last_filter: str | None = None
        self.last_ordering: list[tuple[str, str]] | None = None
        self.last_with_row_id: bool | None = None
        self.last_take_with_row_id: bool | None = None
        self.last_batch_size: int | None = None
        self.last_limit: int | None = None
        self.last_offset: int | None = None

    def count_rows(self, filter: str | None = None) -> int:
        if not filter:
            return len(self.rows)
        value = filter.removeprefix("tag = '").removesuffix("'").replace("''", "'")
        return sum(1 for row in self.rows if row.get("tag") == value)

    def search(self) -> FakeQuery:
        return FakeQuery(self)

    def take_row_ids(
        self,
        row_ids: list[int],
        with_row_id: bool = False,
    ) -> FakeTakeQuery:
        self.last_take_with_row_id = with_row_id
        wanted = set(row_ids)
        rows = []
        for source in self.rows:
            if source["_rowid"] not in wanted:
                continue
            row = dict(source)
            if not with_row_id:
                row.pop("_rowid", None)
            rows.append(row)
        return FakeTakeQuery(rows)


class FakeConnection:
    def __init__(self, tables: dict[str, FakeTable]) -> None:
        self.tables = tables

    def table_names(self) -> list[str]:
        return list(self.tables)
