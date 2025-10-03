# 🧵 Fabric Analyzer

```text
Fabric Analyzer is an AI-powered web application that analyzes fabric 
images to provide insightful textual descriptions.
```

🚀 Features

```text
🖼  Upload your own fabric images or use curated sample images
🔍 Choose between **Short** or **Long** analysis
🤖 Powered by Google Gemini Vision API for detailed AI responses
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
google-generative(gemini-api)
Langchain agents
MCP
Groq
Pillow
base64
```

🛠️ Tech Stack of Databases

```text
-> MongoDB
```

📁 Folder Structure of Frontend

```text
frontend/
├── public/
│   ├── 20250312_224758__10_45_28_PM.jpeg
│   ├── 20250323_093907__10_24_31_PM.jpeg
│   ├── 20250323_094209__10_22_53_PM.jpeg
│   ├── Gemini_Generated_Image_9m5wh59m5wh59m5w.png
│   ├── index.html
│   ├── manifest.json
│   ├── robots.txt
│
├── src/
│   ├── assets/
│   ├── components/
│   ├── hooks/
│   ├── Pages/
│   ├── Services/
│   ├── utils/                       
│   ├── services/                    
│
├── App.css                     
├── App.js
├── App.test.js
├── index.css                    
├── index.js
├── logo.svg
├── reportWebVitals.js
├── setupTests.js
│
```

📁 Folder Structure of Backend

```text
backend/
├── main.py
├── cli.py
├── LICENSE-PYTHON
├── .env
├── agent/
├── core/
├── routes/
├── services/
├── static/
├── templates/
├── tools/
├── utils/
├── pyproject.toml/
├── README.md/
```

🔄 API Flow

```text
POST /api/validate-image — Validates if uploaded image is a fabric
POST /api/analyze-image — Runs Gemini analysis (short or long)
POST /api/regenerate — Regenerates response set for same image + mode
POST /api/chat - chatbot
GET  /api/assets/images/{filename} - for getting the images
GET  /api/assets/audios/{filename} - for getting the audios
GET  /api/media/content - for listing the uploaded media
POST /api/search - for searching the similar images
POST /api/submit - for uploading the media
POST /api/uploads/tmp_media - for storing the media in chat 
```

## How to start

🛋️ Backend

```sh
git clone https://github.com/recursivezero/tz-fabric.git
cd backend
curl -sSL https://install.python-poetry.org | python3 -
poetry install - to install all the dependencies
poetry run dev
```

🛋️ Frontend

```sh
git clone https://github.com/recursivezero/tz-fabric.git
cd frontend_image_Search
npm install  -> to download the node modules
npm install axios -> for backend integration
npm install react-icons // if react-icons is not installed
npm run dev
```

🖼️ Screenshots

```text
Homepage
```

![Homepage](<https://github.com/recursivezero/tz-fabric/blob/feature/RZF-250003/frontend/src/assets/Screenshots/Screenshot%20(364).png>)

```text
Image Analysis Page
```

![Results](<https://github.com/recursivezero/tz-fabric/blob/feature/RZF-250003/frontend/src/assets/Screenshots/Screenshot%20(365).png>)

```text
Upload Media Page
```

![UploadImage](<https://github.com/recursivezero/tz-fabric/blob/feature/RZF-250003/frontend/src/assets/Screenshots/Screenshot%20(366).png>)

```text
List Page
```

![Results](<https://github.com/recursivezero/tz-fabric/blob/feature/RZF-250003/frontend/src/assets/Screenshots/Screenshot%20(367).png>)

```text
Search Page
```

![Results](<https://github.com/recursivezero/tz-fabric/blob/feature/RZF-250003/frontend/src/assets/Screenshots/Screenshot%20(369).png>)

```text
Chat Page
```

![Results](<https://github.com/recursivezero/tz-fabric/blob/feature/RZF-250003/frontend/src/assets/Screenshots/Screenshot%20(370).png>)
