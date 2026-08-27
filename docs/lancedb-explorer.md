# LanceDB Admin Explorer

The **LanceDB Admin Explorer** is a read-only administrative interface for inspecting LanceDB databases from:

- Local LanceDB storage
- Amazon S3
- Cloudflare R2

It allows an authenticated administrator to scan a configured LanceDB database, select available tables, inspect schema and metadata, browse paginated rows, and inspect vector information without exposing write operations.

> **Security:** Do not commit real AWS, R2, or administrator credentials to the repository. Use environment variables only.

---

## 1. Admin Explorer URL

For local development, open:

```text
http://localhost:5173/admin/lancedb
```

The first screen requires the backend `INTERNAL_API_KEY`.

![LanceDB Explorer login](./images/lancedb-explorer/01-login.png)

---

## 2. Prerequisites

Make sure the following are installed:

- Python 3.11+
- Poetry
- Node.js
- npm

From the repository root, the project is expected to contain:

```text
backend/
frontend/
docs/
```

---

## 3. Backend Environment Setup

For local development, configure:

```text
backend/.env.development
```

If needed, create it from the sample file:

```bash
cd backend
cp .env.sample .env.development
```

### Common settings

```env
ENVIRONMENT="development"
API_PREFIX="/api/v1"
PORT=8002

# Secret used to open the LanceDB Admin Explorer.
INTERNAL_API_KEY="<your-admin-secret>"

# Enable localhost frontend access during development.
ALLOW_LOCAL_ORIGINS="true"
```

The value of `INTERNAL_API_KEY` is what must be entered on the LanceDB Explorer login screen.

It is **not** an AWS key or R2 key.

---

## 4. Local LanceDB Setup

Local mode uses the backend-configured application database directory.

By default, this project uses:

```text
backend/database
```

A typical local LanceDB structure looks like:

```text
backend/
└── database/
    ├── fabric_table.lance/
    ├── another_table.lance/
    └── ...
```

Verify local tables with:

### macOS / Linux

```bash
find backend/database -type d -name "*.lance"
```

### Windows PowerShell

```powershell
Get-ChildItem -Path .\backend\database -Recurse -Directory -Filter *.lance
```

### Important

The frontend does **not** send a local filesystem path.

For Local mode, simply select:

```text
Storage → Local database
```

and click:

```text
Scan tables
```

The backend uses its configured `DATABASE_PATH`.

Do **not** provide the whole backend directory.

```text
backend/                          ❌
backend/database/                 ✅ database location
backend/database/table.lance/     ✅ physical table
```

The explorer connects to the database location and lists the tables found inside it.

![Local database scan](./images/lancedb-explorer/03-local-scan.png)

---

## 5. Amazon S3 Setup

Add the required S3 settings to `backend/.env.development`:

```env
AWS_ACCESS_KEY_ID="<aws-access-key>"
AWS_SECRET_ACCESS_KEY="<aws-secret-key>"
AWS_REGION="<aws-region>"
AWS_BUCKET_NAME="<bucket-name>"
```

Example:

```env
AWS_REGION="ap-south-1"
```

AWS credentials stay on the backend and are never entered in the browser.

### Database at the bucket root

If the bucket contains LanceDB tables directly:

```text
bucket/
├── table_a.lance/
├── table_b.lance/
└── ...
```

select **Amazon S3**, leave the database URI empty, and click **Scan tables**. The backend will use `AWS_BUCKET_NAME`.

### Database inside a prefix

If the bucket looks like:

```text
bucket/
└── table/
    ├── fabric_table.lance/
    └── another_table.lance/
```

enter:

```text
s3://<bucket-name>/table
```

Example:

```text
s3://my-bucket/table
```

### Correct S3 path rule

The URI must point to the **database directory/prefix that contains the `.lance` table directories**.

Correct:

```text
s3://my-bucket/table
```

Incorrect:

```text
s3://my-bucket/table/fabric_table.lance
```

Incorrect:

```text
s3://my-bucket/table/fabric_table.lance/data
```

If a path inside `.lance/data` is supplied, internal Lance files may be discovered as if they were tables and later fail to open.

![Amazon S3 scan](./images/lancedb-explorer/04-s3-scan.png)

---

## 6. Cloudflare R2 Setup

Cloudflare R2 exposes an S3-compatible API, so LanceDB locations still use the `s3://` URI format.

Add the following values to `backend/.env.development`:

```env
R2_ACCESS_KEY_ID="<r2-access-key>"
R2_SECRET_ACCESS_KEY="<r2-secret-access-key>"
R2_ACCOUNT_ID="<cloudflare-account-id>"
R2_BUCKET_NAME="<r2-bucket-name>"
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_REGION="auto"
```

Optional:

```env
R2_PUBLIC_CDN="https://<your-cdn-domain>"
```

`R2_PUBLIC_CDN` is not required for LanceDB Explorer access.

### Important: R2 endpoint vs LanceDB URI

This:

```text
https://<account-id>.r2.cloudflarestorage.com
```

belongs only in `R2_ENDPOINT`.

Do **not** paste the R2 HTTPS endpoint into the admin-page database URI field.

The admin page expects:

```text
s3://<r2-bucket-name>/<database-prefix>
```

### Database at the R2 bucket root

If the R2 bucket directly contains `.lance` tables, select **Cloudflare R2**, leave the database URI empty, and click **Scan tables**.

The backend uses:

- `R2_BUCKET_NAME`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_REGION=auto`

### Database inside an R2 prefix

For:

```text
bucket/
└── database/
    ├── fabric_table.lance/
    └── another_table.lance/
```

enter:

```text
s3://<r2-bucket-name>/database
```

Provide the **parent database prefix**, not the `.lance` table itself and not its `data` directory.

![Cloudflare R2 scan](./images/lancedb-explorer/05-r2-scan.png)

---

## 7. Verify R2 Credentials Independently

If R2 scanning fails, verify the R2 credentials separately from LanceDB.

From `backend`:

```bash
poetry run python
```

Then:

```python
import os
import boto3
import constants

client = boto3.client(
    "s3",
    endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    region_name="auto",
)

response = client.list_objects_v2(
    Bucket=os.environ["R2_BUCKET_NAME"],
    MaxKeys=5,
)

print([item["Key"] for item in response.get("Contents", [])])
```

If object keys are returned, the endpoint, bucket, credentials, network access, and permissions are valid.

---

## 8. Find the LanceDB Prefix in S3/R2

If the connection succeeds but the explorer reports that no tables were found, the selected bucket/prefix may not contain a LanceDB database.

For R2:

```python
bucket = os.environ["R2_BUCKET_NAME"]
paginator = client.get_paginator("list_objects_v2")

for page in paginator.paginate(Bucket=bucket):
    for item in page.get("Contents", []):
        key = item["Key"]
        if ".lance/" in key or key.endswith(".lance"):
            print(key)
```

Example:

```text
table/fabric_table.lance/_versions/...
table/fabric_table.lance/data/...
```

The correct database URI is therefore:

```text
s3://<bucket-name>/table
```

not:

```text
s3://<bucket-name>/table/fabric_table.lance/data
```

---

## 9. Install and Run the Backend

```bash
cd backend
poetry install --with dev
poetry run fabric dev
```

The development API normally runs at:

```text
http://localhost:8002
```

Verify it:

```bash
curl http://localhost:8002/api/v1/health
```

Verify the admin route:

```bash
curl -i http://localhost:8002/api/v1/admin/lancedb/access
```

Without the secret, a `403` response is expected and confirms the route exists.

> Restart the backend after changing `.env.development`.

---

## 10. Install and Run the Frontend

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

The frontend normally runs at:

```text
http://localhost:5173
```

Open:

```text
http://localhost:5173/admin/lancedb
```

---

## 11. Login

1. Open `/admin/lancedb`.
2. Enter the value configured as `INTERNAL_API_KEY`.
3. Click **Open explorer**.

Authentication only unlocks the explorer. It does not automatically scan a database.

![LanceDB Explorer login](./images/lancedb-explorer/01-login.png)

---

## 12. Choose a Storage Source

After authentication, select:

- Local database
- Amazon S3
- Cloudflare R2

Then click **Scan tables**.

![Storage source selection](./images/lancedb-explorer/02-storage-selection.png)

### Quick reference

| Storage | Database URI field | Backend configuration |
| --- | --- | --- |
| Local | No URI required | Uses backend `DATABASE_PATH` |
| S3 bucket root | Leave empty | `AWS_BUCKET_NAME` + AWS credentials/IAM |
| S3 prefix | `s3://bucket/database-prefix` | AWS credentials/IAM |
| R2 bucket root | Leave empty | `R2_BUCKET_NAME` + R2 endpoint/credentials |
| R2 prefix | `s3://bucket/database-prefix` | R2 endpoint/credentials |

---

## 13. Select and Inspect a Table

After a successful scan, select the required table from the **Table** dropdown.

![Table explorer](./images/lancedb-explorer/06-table-explorer.png)

The explorer can show:

- Available tables
- Row count
- Arrow schema
- Schema metadata
- Embedding functions
- Vector columns
- Vector dimensions
- Paginated rows
- Tag filters
- Scalar sorting
- Row details
- Full vector inspection
- Rescan
- Change source
- Lock explorer

---

## 14. Read-Only Behavior

The explorer does not expose UI operations for:

- Creating tables
- Deleting tables
- Inserting rows
- Updating rows
- Deleting rows
- Vacuuming
- Optimizing
- Modifying production data

It is intended only for administrative inspection and debugging.

---

## 15. Troubleshooting

### Administrator access was rejected

Verify that the value entered in the browser matches `INTERNAL_API_KEY`.

### Unable to read the LanceDB administrator resource

Check that the backend is running and `/api/v1/admin/lancedb/access` exists.

### Cloudflare R2 is not configured on the backend

Verify that the running backend sees:

```env
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT
R2_REGION="auto"
```

Restart the backend after editing `.env.development`.

### R2 returns `InvalidRegionName`

Use:

```env
R2_REGION="auto"
```

Do not use a normal AWS region such as `ap-south-1` for R2.

### R2 returns `SignatureDoesNotMatch`

Verify that `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` belong to the same Cloudflare R2 S3 API credential.

### No LanceDB tables were found

Confirm that the selected location contains directories such as:

```text
fabric_table.lance/
another_table.lance/
```

If they are under a prefix, provide the parent prefix.

### Scan succeeds but opening a table fails

Check that the URI does not point inside a table.

Incorrect:

```text
s3://bucket/table/fabric_table.lance/data
```

Correct:

```text
s3://bucket/table
```

### Works on one developer machine but not another

Check that:

1. `backend/.env.development` exists.
2. Required credentials are configured.
3. The backend was restarted after env changes.
4. `ALLOW_LOCAL_ORIGINS="true"` is set for local frontend development.
5. The database URI points to the parent database prefix.
6. No credentials exist only in frontend environment files.
7. R2 uses `R2_REGION="auto"` and R2-specific credentials.

---

## 16. Security Notes

Never commit real values for:

```text
INTERNAL_API_KEY
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_SESSION_TOKEN
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Do not expose them in:

- Frontend code/environment available to the browser
- Admin Explorer inputs
- PR comments
- Documentation
- Screenshots
- Test fixtures

Use backend environment variables or the deployment platform's secret manager.

If a credential is accidentally exposed, revoke/rotate it immediately.

---

## 17. Screenshot Files

Store screenshots under:

```text
docs/images/lancedb-explorer/
```

Recommended filenames:

```text
01-login.png
02-storage-selection.png
03-local-scan.png
04-s3-scan.png
05-r2-scan.png
06-table-explorer.png
```

Before committing screenshots, confirm that they do not expose credentials, secrets, or sensitive production data.

---

## 18. Final Setup Summary

### Local

```text
Storage: Local database
URI: Not required
Backend source: DATABASE_PATH
```

### Amazon S3

```text
Storage: Amazon S3
URI: Leave empty for AWS_BUCKET_NAME

or

s3://<bucket>/<database-prefix>
```

### Cloudflare R2

```text
Storage: Cloudflare R2
URI: Leave empty for R2_BUCKET_NAME

or

s3://<r2-bucket>/<database-prefix>
```

For S3 and R2, always provide the **database-level prefix containing the `.lance` tables**, not the individual `.lance` table or its internal `data` directory.
