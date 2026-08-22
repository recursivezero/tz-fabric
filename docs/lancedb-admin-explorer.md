# LanceDB Administrator Explorer

The application includes a private, read-only LanceDB inspection page at:

```text
/admin/lancedb
```

It is intentionally absent from the public navigation. Direct URL discovery is
not the security boundary; every backend endpoint independently requires the
existing internal administrator secret.

## Access configuration

Set a strong server-side value in the backend environment:

```env
INTERNAL_API_KEY="replace-with-a-random-secret"
```

Generate a suitable value with a secret manager or, for local development:

```bash
openssl rand -hex 24
```

Production startup fails when `INTERNAL_API_KEY` is missing. The frontend does
not use `VITE_ADMIN_SECRET`, local storage, or session storage. An administrator
enters the secret on the page and it remains only in React memory until the page
is locked, refreshed, or closed.

## API

All requests require:

```http
X-Internal-Secret: <configured secret>
```

Read-only endpoints:

```http
GET /api/v1/admin/lancedb/access
GET /api/v1/admin/lancedb/scan
GET /api/v1/admin/lancedb/{table_name}
GET /api/v1/admin/lancedb/{table_name}/rows
GET /api/v1/admin/lancedb/{table_name}/rows/{row_id}
```

`/access` validates administrator authentication only; it does not connect to or
scan LanceDB. The administrator then chooses the configured local database,
Amazon S3, or Cloudflare R2 and explicitly calls `/scan`. The local mode is
intentionally pinned to the backend's configured `DATABASE_PATH`; the admin UI
does not expose a general server filesystem browser. The frontend local-source
object therefore carries no machine-specific filesystem path, and local requests
do not send `X-LanceDB-Location`.
The old `/tables` route remains as a non-documented compatibility alias so
existing clients are not broken while the UI and public API terminology move to
"scanner" / `/scan`.

For S3, credentials stay on the backend. LanceDB accepts the standard
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_SESSION_TOKEN`, and
AWS region environment configuration (or an IAM role). The browser never asks
for or receives AWS credentials. If the administrator leaves the S3 URI empty,
the backend scans `AWS_BUCKET_NAME`.

R2 uses the same `s3://` LanceDB URI contract with a Cloudflare endpoint and its
own backend-only credentials: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_ENDPOINT` (or `R2_ACCOUNT_ID`), `R2_BUCKET_NAME`, and `R2_REGION` (normally
`auto`). `R2_ENDPOINT` is backend connection configuration, not a database URI
for the admin page. An explicit R2 database location still uses the S3-compatible
form `s3://<bucket>/<database-prefix>`. The service passes R2 credentials,
endpoint, and region explicitly to LanceDB, so an AWS profile or `AWS_*`
environment variables on the same machine cannot be reused for R2. This keeps
AWS and R2 credentials independent when both are configured on the same backend
process.

Row-list parameters:

```text
page        integer, minimum 1, default 1
page_size   integer, 1–100, default 25
tag         optional exact tag, maximum 128 characters
sort_by     image_uri | tag | hash | mtime
sort_order  asc | desc
```

## Performance and safety model

- Table names are validated and resolved only from the active LanceDB
  connection.
- Local scanning cannot be redirected to arbitrary backend directories from the
  browser.
- Standard row requests select scalar columns only; vectors are not included.
- Filtering, counting, pagination, and supported sorting are executed by the
  backend.
- Page size is capped at 100.
- API responses send `Cache-Control: no-store` and `Pragma: no-cache`.
- Full vectors are fetched only from the explicit row-detail endpoint.
- Metadata keys that look like secrets, tokens, passwords, API keys, or
  credentials are redacted before returning them.
- The explorer exposes no create, update, delete, optimize, vacuum, index, or
  maintenance operation.
- `_rowid` is used only as a temporary inspection identifier. It must not be
  stored as a permanent application identifier because LanceDB may change row
  IDs after table updates or compaction.

## User interface

The explorer provides:

- private access gate;
- database scanner, table picker, and rescan;
- row count, schema-field count, and vector dimension summaries;
- Arrow schema, schema metadata, and embedding metadata panels;
- exact tag filter, scalar sort, and page-size controls;
- desktop data grid and mobile row cards;
- collapsed vector dimensions in normal rows;
- lazy full-vector dialog;
- copy row JSON, image URI, hash, complete row, and vector actions;
- loading, empty, access-denied, missing-table, and backend-error states.

## Verification

Backend tests:

```bash
cd backend
PYTHONPATH=. python -m unittest discover -s tests -v
```

Frontend checks:

```bash
cd frontend
npm ci --no-audit --no-fund
npm run lint
npm run test
npm run build
```

The real LanceDB integration test automatically skips when the pinned LanceDB
and PyArrow packages are unavailable. Use Python 3.11 or 3.12, which matches the
repository dependency markers, to run that integration test.
