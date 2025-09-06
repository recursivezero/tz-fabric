from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pymongo import MongoClient, errors, uri_parser
from dotenv import load_dotenv
from constants import ASSETS
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

database_uri = os.getenv("DATABASE_URI","mongodb://127.0.0.1:27017/tz-fabric?authSource=admin&retryWrites=true&w=majority")
# Parse the URI to extract db name
parsed_uri = uri_parser.parse_uri(database_uri)
db_name = parsed_uri.get("database")
print(f"Database URI: {database_uri}")
if not db_name:
    db_name = "tz-fabric"  # Default database name if not specified in URI

client = MongoClient(database_uri)
default_db = client.get_default_database()
if default_db is not None:
    db = default_db
elif db_name is not None:
    db = client[db_name]
else:
    raise ValueError("No database specified in URI and no default database available")

print("Connected to database:", db.name)

app.mongo_client = client
app.database = db

os.makedirs(ASSETS, exist_ok=True)
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
        logger.info("successfully connected to MongoDB!")
    except errors.ConnectionFailure as e:
        logger.error(f"Could not connect to MongoDB: {e}")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})