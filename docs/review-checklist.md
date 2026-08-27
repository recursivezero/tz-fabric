# Review Checklist

Before approving a Pull Request, verify:

- Requirements are satisfied.
- Code follows project conventions.
- No unnecessary complexity introduced.
- Error handling is present.
- Security implications considered.
- Existing functionality remains unaffected.
- Documentation updated if necessary.
- No dead code or debug code remains.
- Screenshots or testing evidence provided.
- Performance impact considered.
- Admin endpoints appear under one OpenAPI tag only.
- Empty LanceDB databases return a successful empty response and do not log the
  administrator out.
- Administrator login does not scan tables; local, S3, or R2 must be selected
  explicitly first.
- Local LanceDB inspection uses only the configured database and does not expose
  a backend filesystem browser.
- S3/R2 credentials entered on the admin page are kept only in page memory, are
  sent only to the private LanceDB API for the selected source, and are never
  persisted or included in URLs/log messages.
- The expected administrator secret remains server-side; the frontend only holds
  the value entered by the administrator for the current page session.
- Python dependency changes are made through Poetry (`pyproject.toml` and
  `poetry.lock`), not by hand-editing `requirements.txt`.

If something is unclear, request clarification rather than making assumptions.
