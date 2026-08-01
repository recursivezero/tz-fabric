# Architecture Principles

## Separation of Concerns

Keep business logic, presentation, and data access separated.

## Single Source of Truth

Avoid duplicating ownership of the same data.

## Predictability

Prefer explicit flows over hidden side effects.

## Backward Compatibility

Consider impact on existing users and integrations before making breaking changes.

## Security First

Validate all external input.

Never trust client-provided data.

## Reuse Existing Patterns

Before introducing a new pattern, evaluate whether an existing project pattern already solves the problem.

## LanceDB Administrator Authentication

The LanceDB Explorer does not create a browser login session or issue a token.
Administrator access is checked on every request with the server-side
`X-Internal-Secret` header.

Use `GET /api/v1/admin/lancedb/access` to validate the configured secret without
opening LanceDB. A successful response returns `200` with the authentication
mode and header name. Invalid credentials return `403`, and a missing production
configuration returns `503`.

An authenticated database with no tables is a valid state. The tables endpoint
returns `200` with `{ "tables": [] }`, and the frontend keeps the Explorer
unlocked while showing an empty state. Generic storage or network failures must
not clear a valid secret; only an actual `403` locks the Explorer.

## Python Dependency Management

`backend/pyproject.toml` and `backend/poetry.lock` are the dependency source of
truth. Add runtime dependencies with `poetry add <package>` and development-only
dependencies with `poetry add --group dev <package>`. Do not hand-edit
`backend/requirements.txt`; it is an exported artifact rather than the package
manifest.
