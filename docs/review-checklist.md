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
- Python dependency changes are made through Poetry (`pyproject.toml` and
  `poetry.lock`), not by hand-editing `requirements.txt`.

If something is unclear, request clarification rather than making assumptions.
