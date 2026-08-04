from __future__ import annotations

import tests.bootstrap  # noqa: F401

import tempfile
import unittest
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from constants import API_KEY
from routes.admin_lancedb import get_lancedb_admin_service, router
from services.lancedb_admin_service import LanceDBAdminService, LanceDBUnavailable
from tests.lancedb_fakes import FakeConnection, FakeTable


class FailingService(LanceDBAdminService):
    def __init__(self) -> None:
        super().__init__(connection_factory=lambda _location: None)

    def list_tables(self):
        raise LanceDBUnavailable("/private/backend/database/secret.lance")


class AdminLanceDBRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        table = FakeTable()
        connection = FakeConnection({"tz-fabric-table": table})
        self.service = LanceDBAdminService(
            connection_factory=lambda _path: connection,
            table_factory=lambda _path, name: connection.tables[name],
        )
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        app.dependency_overrides[get_lancedb_admin_service] = lambda: self.service
        self.app = app
        self.client = TestClient(app)
        self.headers = {"X-Internal-Secret": API_KEY}

    def test_requires_valid_admin_secret(self) -> None:
        self.assertEqual(
            self.client.get("/api/v1/admin/lancedb/tables").status_code, 403
        )
        self.assertEqual(
            self.client.get(
                "/api/v1/admin/lancedb/tables",
                headers={"X-Internal-Secret": "wrong"},
            ).status_code,
            403,
        )
        authorised = self.client.get(
            "/api/v1/admin/lancedb/tables", headers=self.headers
        )
        self.assertEqual(authorised.status_code, 200)
        self.assertEqual(authorised.headers["cache-control"], "no-store, max-age=0")
        self.assertEqual(authorised.headers["pragma"], "no-cache")

    def test_openapi_lists_admin_routes_under_one_tag(self) -> None:
        schema = self.app.openapi()
        admin_paths = {
            path: operations
            for path, operations in schema["paths"].items()
            if path.startswith("/api/v1/admin/lancedb")
        }

        self.assertTrue(admin_paths)
        for operations in admin_paths.values():
            for operation in operations.values():
                self.assertEqual(operation["tags"], ["Admin"])

    def test_access_endpoint_validates_header_without_touching_lancedb(self) -> None:
        response = self.client.get(
            "/api/v1/admin/lancedb/access",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "authenticated": True,
                "auth_mode": "internal-secret-header",
                "header_name": "X-Internal-Secret",
            },
        )

    def test_empty_database_is_a_successful_empty_table_response(self) -> None:
        connection = FakeConnection({})
        empty_service = LanceDBAdminService(
            connection_factory=lambda _path: connection,
            table_factory=lambda _path, name: connection.tables[name],
        )
        self.app.dependency_overrides[get_lancedb_admin_service] = lambda: empty_service

        response = self.client.get(
            "/api/v1/admin/lancedb/tables",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["tables"], [])
        self.assertEqual(response.json()["source"]["storage"], "local")

    def test_source_headers_are_required_before_scanning_tables(self) -> None:
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        client = TestClient(app)

        response = client.get(
            "/api/v1/admin/lancedb/tables",
            headers=self.headers,
        )

        self.assertEqual(response.status_code, 422)
        self.assertIn("X-LanceDB-Storage", response.text)
        self.assertIn("X-LanceDB-Location", response.text)

    def test_local_directory_browser_does_not_scan_tables(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            child = Path(directory) / "selected.lancedb"
            child.mkdir()

            response = self.client.get(
                "/api/v1/admin/lancedb/sources/local",
                headers=self.headers,
                params={"path": directory},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["current_path"],
            str(Path(directory).resolve()),
        )
        self.assertEqual(
            response.json()["directories"],
            [{"name": "selected.lancedb", "path": str(child.resolve())}],
        )

    def test_all_endpoints_return_expected_contracts(self) -> None:
        tables = self.client.get("/api/v1/admin/lancedb/tables", headers=self.headers)
        self.assertEqual(tables.json()["tables"][0]["name"], "tz-fabric-table")

        details = self.client.get(
            "/api/v1/admin/lancedb/tz-fabric-table", headers=self.headers
        )
        self.assertEqual(details.status_code, 200)
        self.assertEqual(details.json()["vector_columns"][0]["dimension"], 4)

        rows = self.client.get(
            "/api/v1/admin/lancedb/tz-fabric-table/rows",
            headers=self.headers,
            params={"page": 1, "page_size": 2, "tag": "product"},
        )
        self.assertEqual(rows.status_code, 200)
        self.assertEqual(rows.json()["pagination"]["total_rows"], 2)
        self.assertNotIn("values", rows.json()["rows"][0]["vector"])

        detail = self.client.get(
            "/api/v1/admin/lancedb/tz-fabric-table/rows/0", headers=self.headers
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["vector"]["values"], [0.1, 0.2, 0.3, 0.4])

    def test_fastapi_rejects_invalid_query_parameters(self) -> None:
        invalid_sort = self.client.get(
            "/api/v1/admin/lancedb/tz-fabric-table/rows",
            headers=self.headers,
            params={"sort_by": "vector"},
        )
        self.assertEqual(invalid_sort.status_code, 422)
        too_large = self.client.get(
            "/api/v1/admin/lancedb/tz-fabric-table/rows",
            headers=self.headers,
            params={"page_size": 101},
        )
        self.assertEqual(too_large.status_code, 422)

    def test_unknown_and_path_injection_table_names_are_safe(self) -> None:
        unknown = self.client.get("/api/v1/admin/lancedb/missing", headers=self.headers)
        self.assertEqual(unknown.status_code, 404)
        traversal = self.client.get(
            "/api/v1/admin/lancedb/..%2F..%2Fdatabase", headers=self.headers
        )
        self.assertIn(traversal.status_code, (404, 422))

    def test_internal_errors_do_not_expose_database_paths(self) -> None:
        self.app.dependency_overrides[get_lancedb_admin_service] = FailingService
        response = self.client.get("/api/v1/admin/lancedb/tables", headers=self.headers)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("/private", response.text)
        self.assertNotIn("database", response.text.lower())


if __name__ == "__main__":
    unittest.main()
