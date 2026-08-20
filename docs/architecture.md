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


## LanceDB Source Selection

Administrator login validates only the `X-Internal-Secret`; it does not open the
configured database or call the tables endpoint. After authentication, the
administrator explicitly chooses a source and starts a scan.

Supported sources:

- `local`: the backend's configured LanceDB database (`DATABASE_PATH`). The
  frontend cannot browse arbitrary server directories or override that path.
- `s3`: an optional `s3://bucket/path/to/database` URI. When omitted, the backend
  uses `AWS_BUCKET_NAME`. LanceDB uses the backend process' standard AWS
  environment variables or IAM role.
- `r2`: an optional S3-compatible URI. When omitted, the backend uses
  `R2_BUCKET_NAME` and connects with the R2 endpoint, `auto` region, and separate
  R2 credentials configured only on the server.

Every table, schema, row, and vector request carries the selected source in the
`X-LanceDB-Storage` header and, only for an explicit cloud path,
`X-LanceDB-Location`. The API remains read-only. Cloud credentials are never
accepted from or stored in the frontend.

## Python Dependency Management

`backend/pyproject.toml` and `backend/poetry.lock` are the dependency source of
truth. Add runtime dependencies with `poetry add <package>` and development-only
dependencies with `poetry add --group dev <package>`. Do not hand-edit
`backend/requirements.txt`; it is an exported artifact rather than the package
manifest.
