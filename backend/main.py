from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pymongo import MongoClient
from dotenv import load_dotenv
from constants import UPLOAD_ROOT

import os
from routes import analysis, regenerate, validate_image, search, submit, media, delete

app = FastAPI()
load_dotenv()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient(os.getenv("MongoDB_URI"))
db  = client.get_database("tz-fabric")

app.monogo_client = client
app.database = db

os.makedirs(UPLOAD_ROOT, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

app.include_router(analysis.router, prefix="/api")
app.include_router(regenerate.router, prefix="/api")
app.include_router(validate_image.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(submit.router, prefix="/api")    
app.include_router(media.router, prefix="/api")


# if __name__ == "__main__":
    
#     port = int(os.getenv("PORT"))
#     uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
