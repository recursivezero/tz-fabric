"""Optional real-driver contract test.

The repository pins LanceDB and PyArrow for Python 3.11/3.12.  This test runs in
CI or a supported local environment where those packages are installed and is
skipped on lightweight environments that only run the service fakes.
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import tests.bootstrap  # noqa: F401

from services.lancedb_admin_service import LanceDBAdminService


class LanceDBRealIntegrationTests(unittest.TestCase):
    def test_real_local_table_supports_the_admin_contract(self) -> None:
        try:
            import lancedb
            import pyarrow as pa
        except ImportError as error:
            self.skipTest(f"Real LanceDB dependencies are unavailable: {error}")

        with tempfile.TemporaryDirectory() as directory:
            database_path = str(Path(directory) / "admin-test.lancedb")
            connection = lancedb.connect(database_path)
            schema = pa.schema(
                [
                    pa.field("vector", pa.list_(pa.float32(), 4)),
                    pa.field("image_uri", pa.string(), nullable=False),
                    pa.field("tag", pa.string(), nullable=False),
                    pa.field("hash", pa.string(), nullable=False),
                    pa.field("mtime", pa.float64(), nullable=False),
                ],
                metadata={b"source": b"integration-test"},
            )
            data = pa.Table.from_pylist(
                [
                    {
                        "vector": [0.1, 0.2, 0.3, 0.4],
                        "image_uri": "images/a.webp",
                        "tag": "product",
                        "hash": "hash-a",
                        "mtime": 10.0,
                    },
                    {
                        "vector": [0.5, 0.6, 0.7, 0.8],
                        "image_uri": "images/b.webp",
                        "tag": "product",
                        "hash": "hash-b",
                        "mtime": 30.0,
                    },
                    {
                        "vector": [0.9, 1.0, 1.1, 1.2],
                        "image_uri": "images/c.webp",
                        "tag": "archive",
                        "hash": "hash-c",
                        "mtime": 20.0,
                    },
                ],
                schema=schema,
            )
            connection.create_table("admin-test", data=data)

            service = LanceDBAdminService(
                connection_factory=lambda _path: lancedb.connect(database_path),
                table_factory=lambda _path, name: lancedb.connect(
                    database_path
                ).open_table(name),
            )

            self.assertEqual(
                [table.name for table in service.list_tables().tables],
                ["admin-test"],
            )
            details = service.get_table_details("admin-test")
            self.assertEqual(details.row_count, 3)
            self.assertEqual(details.vector_columns[0].dimension, 4)

            page = service.get_rows(
                "admin-test",
                page=1,
                page_size=1,
                tag="product",
                sort_by="mtime",
                sort_order="desc",
            )
            self.assertEqual(page.pagination.total_rows, 2)
            self.assertEqual(page.rows[0].hash, "hash-b")
            self.assertFalse(page.rows[0].vector.included)

            detail = service.get_row("admin-test", page.rows[0].row_id)
            self.assertEqual(detail.vector.length, 4)
            self.assertEqual(detail.hash, "hash-b")


if __name__ == "__main__":
    unittest.main()
