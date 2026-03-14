# LanceDB Data Viewer (Docker)

This guide explains how to run the **LanceDB Data Viewer** using Docker to inspect LanceDB tables in a browser.

Docker is assumed to already be installed.

---

## 1. Pull the Data Viewer Image

```bash
docker pull ghcr.io/gordonmurray/lance-data-viewer:lancedb-0.24.3
```

This version supports modern LanceDB datasets.

---

## 2. Prepare Your LanceDB Folder

Your LanceDB directory should contain table folders.

Example structure:

```
lancedb/
   images/
      data/
      _versions
   products/
      data/
      _versions
```

Give read permissions so the container can access the data:

```bash
chmod -R o+rx /path/to/your/lancedb
```

Example:

```bash
chmod -R o+rx ~/lancedb
```

---

## 3. Run the Viewer

Replace the path with your LanceDB directory.

```bash
docker run --rm -p 8080:8080 \
-v /path/to/your/lancedb:/data:ro \
ghcr.io/gordonmurray/lance-data-viewer:lancedb-0.24.3
```

Example:

```bash
docker run --rm -p 8080:8080 \
-v ~/lancedb:/data:ro \
ghcr.io/gordonmurray/lance-data-viewer:lancedb-0.24.3
```

---

## 4. Open the Web Interface

Open your browser and go to:

```
http://localhost:8080
```

The UI will display:

* Available LanceDB tables
* Table schema
* Stored rows
* Vector columns
* Pagination and filtering

---

## 5. Optional: API Endpoints

Health check:

```bash
curl http://localhost:8080/healthz
```

List datasets:

```bash
curl http://localhost:8080/datasets
```

---

## 6. Stop the Viewer

Press:

```
Ctrl + C
```

The container stops automatically because `--rm` removes it after exit.

---

## Notes

If your dataset was created with an older Lance version, use a compatible container tag:

```
ghcr.io/gordonmurray/lance-data-viewer:lancedb-0.16.0
```

or

```
ghcr.io/gordonmurray/lance-data-viewer:lancedb-0.3.4
```
