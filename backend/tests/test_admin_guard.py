from __future__ import annotations

import asyncio
import unittest
from unittest.mock import patch

import tests.bootstrap  # noqa: F401
from fastapi import HTTPException

from auth.admin_guard import validate_admin_configuration, verify_admin_access


class AdminGuardTests(unittest.TestCase):
    def test_missing_configuration_returns_service_unavailable(self) -> None:
        with patch("auth.admin_guard.API_KEY", ""):
            with self.assertRaises(HTTPException) as context:
                asyncio.run(verify_admin_access("attempt"))
        self.assertEqual(context.exception.status_code, 503)

    def test_constant_time_guard_accepts_only_the_exact_secret(self) -> None:
        with patch("auth.admin_guard.API_KEY", "expected-secret"):
            self.assertEqual(
                asyncio.run(verify_admin_access("expected-secret")),
                "expected-secret",
            )
            with self.assertRaises(HTTPException) as context:
                asyncio.run(verify_admin_access("expected-secrex"))
        self.assertEqual(context.exception.status_code, 403)

    def test_production_requires_an_explicit_secret(self) -> None:
        with (
            patch("auth.admin_guard.IS_PROD", True),
            patch("auth.admin_guard.API_KEY", ""),
        ):
            with self.assertRaisesRegex(RuntimeError, "INTERNAL_API_KEY"):
                validate_admin_configuration()


if __name__ == "__main__":
    unittest.main()
