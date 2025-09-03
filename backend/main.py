from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pymongo import MongoClient, errors
from dotenv import load_dotenv
from constants import UPLOAD_ROOT
import logging
import os
from routes import analysis, regenerate, validate_image, search, submit, media

app = FastAPI()
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


origins = [
    "http://localhost:5173",  # Allow requests from your frontend origin
    # You can add more origins here if needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mongo_uri = os.getenv("MongoDB_URI")
if not mongo_uri:
    raise RuntimeError("MongoDB_URI is not set in environment variables. Please configure it in .env")

try:
    client = MongoClient(mongo_uri)
    db = client.get_database("tz-fabric")
except errors.ConnectionFailure as e:
    raise RuntimeError(f"Could not connect to MongoDB: {e}")

app.mongo_client = client
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


@app.on_event("startup")
async def startup_db_client():
    try:
        client.admin.command("ping")  # simple health check
        logger.info("Successfully connected to MongoDB!")
    except errors.ConnectionFailure as e:
        logger.error(f"Could not connect to MongoDB: {e}")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
