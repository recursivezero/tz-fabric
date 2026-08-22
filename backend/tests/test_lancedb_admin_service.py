from __future__ import annotations

import tests.bootstrap  # noqa: F401

import math
import unittest
from types import ModuleType
from unittest.mock import patch

from models.admin_lancedb import LanceDataSource
from services.lancedb_admin_service import (
    LanceDBAdminService,
    LanceDBRowNotFound,
    LanceDBTableNotFound,
    LanceDBValidationError,
)
from tests.lancedb_fakes import (
    FakeArrowTableResult,
    FakeConnection,
    FakeTable,
)


class LanceDBAdminServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.table = FakeTable()
        self.connection = FakeConnection({"tz-fabric-table": self.table})
        self.service = LanceDBAdminService(
            connection_factory=lambda _path: self.connection,
            table_factory=lambda _path, table_name: self.connection.tables[table_name],
        )

    def test_lists_tables_without_opening_rows(self) -> None:
        response = self.service.list_tables()
        self.assertEqual([item.name for item in response.tables], ["tz-fabric-table"])
        self.assertEqual(response.source.storage, "local")
        self.assertEqual(response.source.location, "")
        self.assertEqual(self.connection.list_tables_calls, 1)

    def test_empty_database_returns_an_authenticated_empty_collection(self) -> None:
        connection = FakeConnection({})
        service = LanceDBAdminService(
            connection_factory=lambda _path: connection,
            table_factory=lambda _path, name: connection.tables[name],
        )

        response = service.list_tables()

        self.assertEqual(response.tables, [])
        self.assertEqual(connection.list_tables_calls, 1)

    def test_selected_s3_source_is_passed_to_lancedb_connection(self) -> None:
        locations: list[str] = []
        connection = FakeConnection({})

        def connection_factory(location: str) -> FakeConnection:
            locations.append(location)
            return connection

        service = LanceDBAdminService(
            source=LanceDataSource(
                storage="s3",
                location="s3://fabric-bucket/admin/database/",
            ),
            connection_factory=connection_factory,
        )

        response = service.list_tables()

        self.assertEqual(locations, ["s3://fabric-bucket/admin/database"])
        self.assertEqual(response.source.storage, "s3")
        self.assertEqual(response.source.location, "s3://fabric-bucket/admin/database")

    def test_configured_s3_bucket_is_used_without_exposing_it_in_source(self) -> None:
        locations: list[str] = []
        connection = FakeConnection({})

        def connection_factory(location: str) -> FakeConnection:
            locations.append(location)
            return connection

        with patch.dict("os.environ", {"AWS_BUCKET_NAME": "configured-bucket"}):
            service = LanceDBAdminService(
                source=LanceDataSource(storage="s3"),
                connection_factory=connection_factory,
            )
            response = service.list_tables()

        self.assertEqual(locations, ["s3://configured-bucket"])
        self.assertEqual(response.source, LanceDataSource(storage="s3"))

    def test_r2_uses_s3_compatible_endpoint_and_separate_credentials(self) -> None:
        environment = {
            "AWS_ACCESS_KEY_ID": "aws-key-that-must-not-be-used",
            "AWS_SECRET_ACCESS_KEY": "aws-secret-that-must-not-be-used",
            "AWS_REGION": "ap-south-1",
            "R2_BUCKET_NAME": "configured-r2-bucket",
            "R2_ACCESS_KEY_ID": "test-r2-key",
            "R2_SECRET_ACCESS_KEY": "test-r2-secret",
            "R2_ACCOUNT_ID": "test-account",
            "R2_REGION": "auto",
        }

        with patch.dict("os.environ", environment, clear=False):
            service = LanceDBAdminService(
                source=LanceDataSource(storage="r2"),
                connection_factory=lambda _location: FakeConnection({}),
            )
            options = service._storage_options()

        self.assertEqual(service._connection_location, "s3://configured-r2-bucket")
        self.assertEqual(service.source, LanceDataSource(storage="r2"))
        self.assertEqual(
            options,
            {
                "endpoint": "https://test-account.r2.cloudflarestorage.com",
                "aws_access_key_id": "test-r2-key",
                "aws_secret_access_key": "test-r2-secret",
                "aws_region": "auto",
            },
        )

    def test_r2_passes_explicit_credentials_to_lancedb_connect(self) -> None:
        calls: list[tuple[str, dict[str, str] | None]] = []
        connection = FakeConnection({})

        def connect(
            location: str,
            *,
            storage_options: dict[str, str] | None = None,
        ) -> FakeConnection:
            calls.append((location, storage_options))
            return connection

        environment = {
            "AWS_ACCESS_KEY_ID": "aws-key-that-must-not-be-used",
            "AWS_SECRET_ACCESS_KEY": "aws-secret-that-must-not-be-used",
            "AWS_REGION": "ap-south-1",
            "R2_BUCKET_NAME": "configured-r2-bucket",
            "R2_ACCESS_KEY_ID": "test-r2-key",
            "R2_SECRET_ACCESS_KEY": "test-r2-secret",
            "R2_ENDPOINT": "https://test-account.r2.cloudflarestorage.com",
            "R2_REGION": "auto",
        }
        fake_lancedb = ModuleType("lancedb")
        setattr(fake_lancedb, "connect", connect)

        with (
            patch.dict("os.environ", environment, clear=False),
            patch.dict("sys.modules", {"lancedb": fake_lancedb}),
        ):
            service = LanceDBAdminService(source=LanceDataSource(storage="r2"))
            response = service.list_tables()

        self.assertEqual(response.tables, [])
        self.assertEqual(
            calls,
            [
                (
                    "s3://configured-r2-bucket",
                    {
                        "endpoint": "https://test-account.r2.cloudflarestorage.com",
                        "aws_access_key_id": "test-r2-key",
                        "aws_secret_access_key": "test-r2-secret",
                        "aws_region": "auto",
                    },
                )
            ],
        )

    def test_r2_requires_backend_credentials(self) -> None:
        environment = {
            "R2_BUCKET_NAME": "configured-r2-bucket",
            "R2_ACCESS_KEY_ID": "",
            "R2_SECRET_ACCESS_KEY": "",
            "R2_ENDPOINT": "",
            "R2_ACCOUNT_ID": "",
        }
        with patch.dict("os.environ", environment, clear=False):
            service = LanceDBAdminService(
                source=LanceDataSource(storage="r2"),
                connection_factory=lambda _location: FakeConnection({}),
            )
            with self.assertRaisesRegex(LanceDBValidationError, "R2 credentials"):
                service._storage_options()

    def test_s3_uses_documented_storage_option_names(self) -> None:
        environment = {
            "AWS_ACCESS_KEY_ID": "test-aws-key",
            "AWS_SECRET_ACCESS_KEY": "test-aws-secret",
            "AWS_SESSION_TOKEN": "test-session-token",
            "AWS_REGION": "ap-south-1",
        }
        with patch.dict("os.environ", environment, clear=False):
            service = LanceDBAdminService(
                source=LanceDataSource(storage="s3", location="s3://bucket/db"),
                connection_factory=lambda _location: FakeConnection({}),
            )
            options = service._storage_options()

        self.assertEqual(
            options,
            {
                "aws_access_key_id": "test-aws-key",
                "aws_secret_access_key": "test-aws-secret",
                "aws_session_token": "test-session-token",
                "aws_region": "ap-south-1",
            },
        )

    def test_rejects_invalid_s3_source_uri(self) -> None:
        with self.assertRaisesRegex(LanceDBValidationError, "s3://bucket"):
            LanceDBAdminService(
                source=LanceDataSource(storage="s3", location="https://bucket/path"),
                connection_factory=lambda _location: FakeConnection({}),
            )

    def test_rejects_invalid_cloud_bucket_names(self) -> None:
        invalid_sources = [
            LanceDataSource(storage="s3", location="s3://UPPERCASE/database"),
            LanceDataSource(storage="s3", location="s3://192.168.1.10/database"),
            LanceDataSource(storage="r2", location="s3://bucket.with.dots/database"),
        ]
        for source in invalid_sources:
            with self.subTest(storage=source.storage, location=source.location):
                with self.assertRaisesRegex(
                    LanceDBValidationError, "bucket name is invalid"
                ):
                    LanceDBAdminService(
                        source=source,
                        connection_factory=lambda _location: FakeConnection({}),
                    )

    def test_local_source_rejects_client_supplied_server_paths(self) -> None:
        with self.assertRaisesRegex(LanceDBValidationError, "path selection is disabled"):
            LanceDBAdminService(
                source=LanceDataSource(storage="local", location="/tmp/other-path"),
                connection_factory=lambda _location: FakeConnection({}),
            )

    def test_rejects_unknown_and_unsafe_table_names(self) -> None:
        with self.assertRaises(LanceDBTableNotFound):
            self.service.get_table_details("missing")
        with self.assertRaises(LanceDBValidationError):
            self.service.get_table_details("../../database")

    def test_returns_schema_redacted_metadata_embedding_and_vector_dimension(
        self,
    ) -> None:
        details = self.service.get_table_details("tz-fabric-table")
        self.assertEqual(details.row_count, 3)
        self.assertEqual(
            [field.name for field in details.table_schema],
            ["vector", "image_uri", "tag", "hash", "mtime"],
        )
        self.assertTrue(details.table_schema[0].is_vector)
        self.assertEqual(details.vector_columns[0].dimension, 4)
        self.assertEqual(details.embedding_functions[0].name, "siglip")
        self.assertEqual(details.embedding_functions[0].source_column, "image_uri")
        self.assertEqual(
            details.schema_metadata["embedding"]["api_token"], "[redacted]"
        )
        self.assertEqual(details.schema_metadata["owner"], "threadzip")

    def test_paginates_server_side_and_excludes_vector(self) -> None:
        response = self.service.get_rows("tz-fabric-table", page=2, page_size=2)
        self.assertEqual(response.pagination.page, 2)
        self.assertEqual(response.pagination.total_pages, 2)
        self.assertEqual([row.row_id for row in response.rows], [2])
        self.assertEqual(self.table.last_limit, 2)
        self.assertEqual(self.table.last_offset, 2)
        self.assertNotIn("vector", self.table.last_selected_columns or [])
        self.assertIs(self.table.last_with_row_id, True)
        self.assertEqual(response.rows[0].vector.length, 4)
        self.assertFalse(response.rows[0].vector.included)

    def test_empty_table_returns_a_stable_empty_page(self) -> None:
        empty = FakeTable([])
        connection = FakeConnection({"empty": empty})
        service = LanceDBAdminService(
            connection_factory=lambda _path: connection,
            table_factory=lambda _path, name: connection.tables[name],
        )

        response = service.get_rows("empty", page=7, page_size=25)

        self.assertEqual(response.rows, [])
        self.assertEqual(response.pagination.page, 1)
        self.assertEqual(response.pagination.total_rows, 0)
        self.assertEqual(response.pagination.total_pages, 0)
        self.assertFalse(response.pagination.has_next)
        self.assertFalse(response.pagination.has_previous)

    def test_clamps_out_of_range_page_to_last_available_page(self) -> None:
        response = self.service.get_rows("tz-fabric-table", page=99, page_size=2)
        self.assertEqual(response.pagination.page, 2)
        self.assertEqual([row.row_id for row in response.rows], [2])

    def test_exact_tag_filter_is_escaped_and_updates_counts(self) -> None:
        quoted = FakeTable(
            [
                {
                    "_rowid": 7,
                    "vector": [1.0, 2.0, 3.0, 4.0],
                    "image_uri": "x",
                    "tag": "kid's",
                    "hash": "quoted",
                    "mtime": 1.0,
                }
            ]
        )
        connection = FakeConnection({"quoted": quoted})
        service = LanceDBAdminService(
            connection_factory=lambda _path: connection,
            table_factory=lambda _path, name: connection.tables[name],
        )
        response = service.get_rows("quoted", tag=" kid's ")
        self.assertEqual(response.pagination.total_rows, 1)
        self.assertEqual(response.filter.tag, "kid's")
        self.assertEqual(quoted.last_filter, "tag = 'kid''s'")

    def test_rejects_filter_or_sort_for_columns_missing_from_a_table(self) -> None:
        table = FakeTable()
        table.schema[:] = [field for field in table.schema if field.name != "tag"]
        for row in table.rows:
            row.pop("tag", None)
        connection = FakeConnection({"no-tag": table})
        service = LanceDBAdminService(
            connection_factory=lambda _path: connection,
            table_factory=lambda _path, name: connection.tables[name],
        )

        with self.assertRaisesRegex(LanceDBValidationError, "tag column"):
            service.get_rows("no-tag", tag="product")
        with self.assertRaisesRegex(LanceDBValidationError, "tag column"):
            service.get_rows("no-tag", sort_by="tag")

    def test_row_detail_supports_arrow_table_results(self) -> None:
        original_take = self.table.take_row_ids

        def take_as_arrow(row_ids, with_row_id=False):
            query = original_take(row_ids, with_row_id=with_row_id)
            return FakeArrowTableResult(query.to_list())

        self.table.take_row_ids = take_as_arrow  # type: ignore[method-assign]
        detail = self.service.get_row("tz-fabric-table", 0)
        self.assertEqual(detail.hash, "hash-a")
        self.assertEqual(detail.vector.values, [0.1, 0.2, 0.3, 0.4])

    def test_non_finite_vector_values_are_returned_as_json_null(self) -> None:
        self.table.rows[0]["vector"] = [0.1, math.nan, math.inf, -math.inf]
        detail = self.service.get_row("tz-fabric-table", 0)
        self.assertEqual(detail.vector.values, [0.1, None, None, None])

    def test_native_ordering_uses_lance_ordering_contract(self) -> None:
        query = self.table.search()

        result = self.service._apply_ordering(
            query,
            "mtime",
            "desc",
        )

        self.assertIs(result, query)
        self.assertIsNotNone(query.ordering)
        assert query.ordering is not None

        self.assertEqual(
            query.ordering,
            [
                {
                    "column_name": "mtime",
                    "ascending": False,
                    "nulls_first": False,
                }
            ],
        )

    def test_sorts_only_whitelisted_scalar_columns(self) -> None:
        response = self.service.get_rows(
            "tz-fabric-table", sort_by="mtime", sort_order="desc"
        )
        self.assertEqual([row.row_id for row in response.rows], [1, 2, 0])
        self.assertEqual(self.table.last_ordering, [("mtime", "desc")])
        with self.assertRaises(LanceDBValidationError):
            self.service.get_rows("tz-fabric-table", sort_by="vector")  # type: ignore[arg-type]
        with self.assertRaises(LanceDBValidationError):
            self.service.get_rows(
                "tz-fabric-table", sort_order="random"  # type: ignore[arg-type]
            )

    def test_streaming_sort_fallback_is_globally_sorted_and_bounded(self) -> None:
        query = self.table.search().select(["mtime"]).with_row_id(True)
        rows = self.service._streaming_sorted_rows(
            query,
            sort_by="mtime",
            sort_order="asc",
            offset=1,
            limit=1,
        )
        self.assertEqual([row["_rowid"] for row in rows], [2])
        self.assertEqual(self.table.last_batch_size, 1024)

        descending = self.service._streaming_sorted_rows(
            self.table.search().select(["mtime"]).with_row_id(True),
            sort_by="mtime",
            sort_order="desc",
            offset=0,
            limit=2,
        )
        self.assertEqual([row["_rowid"] for row in descending], [1, 2])

        null_table = FakeTable(
            [
                {**self.table.rows[0], "_rowid": 10, "mtime": None},
                {**self.table.rows[1], "_rowid": 11, "mtime": 50.0},
                {**self.table.rows[2], "_rowid": 12, "mtime": 5.0},
            ]
        )
        descending_with_null = self.service._streaming_sorted_rows(
            null_table.search().select(["mtime"]).with_row_id(True),
            sort_by="mtime",
            sort_order="desc",
            offset=0,
            limit=3,
        )
        self.assertEqual(
            [row["_rowid"] for row in descending_with_null],
            [11, 12, 10],
        )

    def test_rejects_invalid_pagination_and_control_char_filter(self) -> None:
        for page_size in (0, 101):
            with self.assertRaises(LanceDBValidationError):
                self.service.get_rows("tz-fabric-table", page_size=page_size)
        with self.assertRaises(LanceDBValidationError):
            self.service.get_rows("tz-fabric-table", page=0)
        with self.assertRaises(LanceDBValidationError):
            self.service.get_rows("tz-fabric-table", tag="bad\nfilter")

    def test_full_vector_is_returned_only_by_explicit_row_request(self) -> None:
        detail = self.service.get_row("tz-fabric-table", 1)
        self.assertIs(self.table.last_take_with_row_id, True)
        self.assertEqual(detail.row_id, 1)
        self.assertEqual(detail.vector.length, 4)
        self.assertEqual(detail.vector.values, [0.5, 0.6, 0.7, 0.8])
        with self.assertRaises(LanceDBRowNotFound):
            self.service.get_row("tz-fabric-table", 999)

    def test_serialiser_normalises_non_finite_values(self) -> None:
        self.assertIsNone(self.service._serialise_value(math.inf))
        self.assertIsNone(self.service._serialise_value(math.nan))
        self.assertEqual(self.service._serialise_value(b"fabric"), "fabric")
        self.assertEqual(
            self.service._serialise_value({"value": [1, math.inf]}),
            {"value": [1, None]},
        )


if __name__ == "__main__":
    unittest.main()
