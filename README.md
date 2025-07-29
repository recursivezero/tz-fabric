🧵 Fabric Analyzer
```text
**Fabric Analyzer** is an AI-powered web application that analyzes fabric images to provide insightful textual descriptions. 
```

🚀 Features

```text
🖼  Upload your own fabric images or use curated sample images
🔍 Choose between **Short** or **Long** analysis
🤖 Powered by Google Gemini Vision API for detailed AI responses
🧠 Response caching for fast navigation (Prev/Next)
✅ Validates whether uploaded image is a proper fabric image
🧭 Drawer and navigation UI for enhanced experience
```

🛠️ Tech Stack of Frontend

```text
React
css

Prerequisites to use react
->Node.js(v16 or later)
->npm(comes with the node)
```

🛠️ Tech Stack of Backend

```text
Fastapi
google-generative(gemini-api)
Pillow
base64
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
│   │── components/
│   │    │──descriptionBox.jsx        # Fabric sample images
│   │    │──drawerToggle.jsx
│   │    │──Header.jsx
│   │    │──imagePreviewPanel.jsx
│   │    │──Loader.jsx
│   │    │──SampleImageGalleryCard.jsx
│   │    │──SearchBar.jsx
│
│   ├── hooks/                 
│   │    ├── useImageAnalysis.js
│   
│   │── Pages/
│   │    ├── Home.jsx
│     
│   ├── Services/  
│   │    ├── analyze_Api.js 
│     
│   │── components/
│   │    │──DescriptionBox.css        # Fabric sample images
│   │    │──DrawerToggle.css
│   │    │──Header.css
│   │    │──ImagePreviewPanel.css
│   │    │──Loader.css
│   │    │──SampleImageGalleryCard.css
│   │    │──SearchBar.css
│     
│
│   ├── utils/                       # Page-level logic
│   │   └── imageUtils.js
│
│   ├── services/                    # API interaction logic
│   │   └── analyze_Api.js
│
├── App.css                       # Custom hooks
├── App.js
├── App.test.js
├── index.css                    # Utility functions
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
├── .env               
├── routes/
│   ├── analysis.py        
│   ├── regenerate.py         
│   ├── validate_image.py     
│              
├── services/
│   ├── generate_response.py
│   ├── threaded.py
│   
├── utils/
│   ├── cache.py       
│   ├── gemini_ap_initialize.py             
│   └── gemini_client.py          
│   ├── image_utils.py       
│   ├── prompt_generator.py             
│   └── validate_image_base64.py            
```
    
🔄 API Flow

```text
POST /api/validate-image — Validates if uploaded image is a fabric
POST /api/analyze-image — Runs Gemini analysis (short or long)
POST /api/regenerate — Regenerates response set for same image + mode
```

🛋️ Setup & Installation of backend

```text
git clone https://github.com/recursivezero/tz-fabric.git
cd backend
curl -sSL https://install.python-poetry.org | python3 -
poetry install - to install all the dependencies
uvicorn main:app --reload --port 8000 or you can choose another ports also
```

🛋️ Setup & Installation of frontend

```text
git clone https://github.com/recursivezero/tz-fabric.git
cd frontend_image_Search
npm install  -> to downlaod the nod modules
npm axios -> for backend integration
npm start -> if you find errors then remove the node modules and again run the insatll command
```

📡 API Endpoints

```text
Endpoint              Method     Description

/api/analysis          POST      Runs Gemini analysis (short or long)
/api/regenerate        POST      Regenerates response (cache)
/api/validate_image    POST      Validates if uploaded image is a fabric
```

🖼️ Screenshots

```text
Homepage
```

![Homepage](https://github.com/recursivezero/tz-fabric/blob/develop/frontend/src/assests/screenshots/Screenshot%20(219).png)

```text
SampleImageResult
```

![Results](https://github.com/recursivezero/tz-fabric/blob/develop/frontend/src/assests/screenshots/Screenshot%20(228).png)

```text
UploadImage - When the image is not a valid fabric
```

![UploadImage](https://github.com/recursivezero/tz-fabric/blob/develop/frontend/src/assests/screenshots/Screenshot%20(230).png)

```text
UploadedImageResults
```

![Results](https://github.com/recursivezero/tz-fabric/blob/develop/frontend/src/assests/screenshots/Screenshot%20(229).png)