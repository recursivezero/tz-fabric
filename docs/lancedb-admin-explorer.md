# LanceDB Administrator Explorer

The application includes a private, read-only LanceDB inspection page at:

```text
/admin/lancedb
```

It supports the application-local LanceDB database, Amazon S3, and Cloudflare
R2. The page keeps the active admin/storage credentials only in browser memory
for the current page session; it does not write them to localStorage,
sessionStorage, cookies, or public frontend environment variables.

> The explorer still uses the backend API as the LanceDB execution layer. This is
> required for the server-local database and avoids putting LanceDB/native
> database access in the browser. What moved out of backend configuration is the
> S3/R2 credential setup: those credentials are entered on the admin page and
> supplied only with the selected storage requests.

## Step 1: session credentials

Open `/admin/lancedb`. The first screen asks for:

- `INTERNAL_API_KEY` (administrator access secret);
- Amazon S3 credentials, region, bucket, and optional session token;
- Cloudflare R2 credentials, bucket, endpoint/account ID, and region.

Only the administrator secret is required to unlock the page. S3 and R2 fields
are optional until that storage type is selected.

The administrator secret is still validated server-side for every private API
request. This is intentional: putting the expected administrator secret in the
frontend bundle would make it public and would not provide authentication.

## Local database

Local scanning remains pinned to the application's configured `DATABASE_PATH`
(`backend/database` by default). The browser does not send or select an arbitrary
server filesystem path.

Select **Local database** and choose **Scan tables**.

## Amazon S3

Enter the S3 values on the first page:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_BUCKET_NAME
AWS_SESSION_TOKEN (optional)
```

After unlocking, select **Amazon S3**. If the LanceDB database is at the bucket
root, leave the database URI blank. If it is under a prefix, enter the parent
prefix containing the `.lance` tables, for example:

```text
s3://example-bucket/table
```

Do not point the database URI at an individual table or its internal `data`
directory.

```text
s3://example-bucket/table                         correct
s3://example-bucket/table/fabric_table.lance      incorrect
s3://example-bucket/table/fabric_table.lance/data incorrect
```

## Cloudflare R2

Enter the R2 values on the first page:

```text
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT or R2_ACCOUNT_ID
R2_REGION (normally auto)
```

R2 uses the S3-compatible LanceDB URI format. If the database is at the R2
bucket root, leave the URI blank. Otherwise enter its parent database prefix:

```text
s3://example-r2-bucket/database
```

`R2_ENDPOINT` is connection configuration and is entered in Step 1; it is not a
LanceDB database URI.

## API transport

The browser sends only the credentials required by the selected storage type to
the private LanceDB endpoints over the current HTTP(S) connection. The backend
uses them for that request and does not persist them.

Read-only endpoints:

```http
GET /api/v1/admin/lancedb/access
GET /api/v1/admin/lancedb/scan
GET /api/v1/admin/lancedb/{table_name}
GET /api/v1/admin/lancedb/{table_name}/rows
GET /api/v1/admin/lancedb/{table_name}/rows/{row_id}
```

The old `/tables` route remains as a compatibility alias.

## Read-only behavior

The explorer provides table discovery, schema/metadata inspection, paginated
rows, filters, sorting, and explicit vector inspection. It exposes no create,
update, delete, optimize, vacuum, indexing, or maintenance operations.

Other safeguards include:

- table-name validation;
- local-path isolation;
- scalar-only normal row browsing;
- page size capped at 100;
- `Cache-Control: no-store` and `Pragma: no-cache` responses;
- lazy full-vector loading;
- redaction of metadata keys that look like credentials/secrets;
- request cancellation/revision checks in the UI to avoid stale responses.

## Security notes

Do not hardcode credentials in source code, screenshots, documentation, or
frontend environment files. The credential form intentionally keeps values only
in React memory and clears them when the explorer is locked, refreshed, or
closed.

Use HTTPS outside local development because S3/R2 credentials are supplied by
the browser to the private backend API for the current request.

The expected `INTERNAL_API_KEY` must remain a server-side value so the backend
can authenticate the entered administrator secret. Moving that expected value
into a Vite/frontend environment variable would expose it in the built bundle
and remove the security boundary.
