from __future__ import annotations

import tests.bootstrap  # noqa: F401

import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

from constants import API_KEY
from routes.admin_lancedb import get_lancedb_admin_service, router
from services.lancedb_admin_service import LanceDBAdminService, LanceDBUnavailable
from tests.lancedb_fakes import FakeConnection, FakeTable


class FailingService(LanceDBAdminService):
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

    def test_all_endpoints_return_expected_contracts(self) -> None:
        tables = self.client.get(
            "/api/v1/admin/lancedb/tables", headers=self.headers
        )
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
        unknown = self.client.get(
            "/api/v1/admin/lancedb/missing", headers=self.headers
        )
        self.assertEqual(unknown.status_code, 404)
        traversal = self.client.get(
            "/api/v1/admin/lancedb/..%2F..%2Fdatabase", headers=self.headers
        )
        self.assertIn(traversal.status_code, (404, 422))

    def test_internal_errors_do_not_expose_database_paths(self) -> None:
        self.app.dependency_overrides[get_lancedb_admin_service] = FailingService
        response = self.client.get(
            "/api/v1/admin/lancedb/tables", headers=self.headers
        )
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("/private", response.text)
        self.assertNotIn("database", response.text.lower())


if __name__ == "__main__":
    unittest.main()
