from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pymongo import MongoClient, errors, uri_parser
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from constants import API_PREFIX, ASSETS
import os

app = FastAPI()
logger = get_logger(__name__)

origins = [
    "http://localhost:5173", 
]
from routes import analysis, regenerate, validate_image, search, submit, media, chat
from tools.mcpserver import sse_app

app = FastAPI(title="TZ Fabric Assistant (with MCP Agent)")
load_dotenv()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URI = os.getenv(
    "DATABASE_URI",
    "mongodb://127.0.0.1:27017/tz-fabric?authSource=admin&retryWrites=true&w=majority",
)
if not DATABASE_URI:
    raise RuntimeError(
        "DATABASE_URI is not set in environment variables. Please configure it in .env"
    )
# Parse the URI to extract db name
parsed_uri = uri_parser.parse_uri(DATABASE_URI)
db_name = parsed_uri.get("database")
if not db_name:
    db_name = "tz-fabric"  # Default database name if not specified in URI

client = MongoClient(DATABASE_URI)
default_db = client.get_default_database()
if default_db is not None:
    db = default_db
elif db_name is not None:
    db = client[db_name]
else:
    raise ValueError("No database specified in URI and no default database available")
print("Connected to MongoDB, using database:", db.name)

app.mongo_client = client
client = MongoClient(os.getenv("MongoDB_URI"))
db = client.get_database("tz-fabric")

app.mongo_client = client   
app.database = db

os.makedirs(ASSETS, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Attach the client and db to the app so routes can access them
    app.mongo_client = client
    app.database = db

    # Startup: perform a simple health check
    try:
        client.admin.command("ping")
        logger.info("successfully connected to MongoDB!")
    except errors.OperationFailure as e:
        # Authentication or operation errors
        logger.error(f"MongoDB operation failed during startup: {e}")
    except errors.ConnectionFailure as e:
        logger.error(f"Could not connect to MongoDB during startup: {e}")
    except Exception as e:
        logger.error(f"Unexpected error when connecting to MongoDB: {e}")

    yield

    try:
        client.close()
        logger.info("MongoDB connection closed")
    except Exception as e:
        logger.warning(f"Error while closing MongoDB client: {e}")


app.include_router(analysis.router, prefix=API_PREFIX)
app.include_router(regenerate.router, prefix=API_PREFIX)
app.include_router(validate_image.router, prefix=API_PREFIX)
app.include_router(search.router, prefix=API_PREFIX)
app.include_router(submit.router, prefix=API_PREFIX)
app.include_router(media.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)


app.mount("/mcp", sse_app())

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
