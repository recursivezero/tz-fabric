# 🧵 Fabric Analyzer

![MIT](https://badgen.net/github/license/recursivezero/tz-fabric)
![Tag](https://badgen.net/github/tag/recursivezero/tz-fabric)
![check](https://badgen.net/github/checks/recursivezero/tz-fabric)
![Release](https://badgen.net/github/releases/recursivezero/tz-fabric)

> AI-powered web application that analyzes and search fabric images.

live on <https://pro.threadzip.com>

🚀 Features

```text
🖼  Upload your own fabric images or use curated sample images
🔍 Choose between **Short** or **Long** analysis
🧠 Response caching for fast navigation (Prev/Next)
✅ Validates whether uploaded image is a proper fabric image
🧭 Drawer and navigation UI for enhanced experience
📤 Upload and record of fabric images and related audios
🔎 Search Similar images through a query
🤖 An agentic chatbot for fabric queries and task
```

🛠️ Tech Stack of Frontend

```text
React
Typescript
css

Prerequisites to use react
->Node.js(v16 or later)
->npm(comes with the node)
```

🛠️ Tech Stack of Backend

```text
Fastapi
Langchain agents
MCP
Groq
Pillow
CLIP
```

🛠️ Tech Stack of Databases

```text
-> MongoDB
-> Vector DB
```

## How to start

Clone the repo

🛋️ Frontend

```sh
cd tz-fabric
npm install  -> to download the node modules
npm run dev
```

🛋️ Backend

```sh
cd backend
curl -sSL https://install.python-poetry.org | python3 -
poetry install --all-extras --with dev
poetry run tzfabric dev
```

## Sample .env

backend/.env

```text
PORT=8000
GRQ_API_KEY=""
MONGODB_URI="mongodb://localhost:27017"
```

frontend/.env

```text
VITE_API_URL="http://localhost:8000"
```

🖼️ Screenshots

### Homepage

![Homepage](/assets/screenshots/homepage.png)

---

### Analysis Page

![Analysis](/assets/screenshots/analysis-page.png)
![Analysis Feature](/assets/screenshots/analysis-feature.png)

---

### Upload Page

![Upload](/assets/screenshots/upload-page.png)
![UploadFeature](/assets/screenshots/upload-page-feature.png)

---

### List Page

![ListPage](/assets/screenshots/list-page.png)

---

### Search Page

![Search Page](/assets/screenshots/search-page.png)
![Search Crop Feature](/assets/screenshots/search-page-crop.png)
![Search Page Feature](/assets/screenshots/search-page-action.png)

---

### Chat Page

![Chat Page](/assets/screenshots/chat-page.png)
![Chat feature](/assets/screenshots/chat-page-feature.png)

## 📄 License

[MIT](https://github.com/recursivezero/tz-fabric/blob/main/LICENSE)
