import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pymongo import MongoClient, errors
from pymongo.database import Database
from routes.card_reader import router as card_router
from routes.adhaar_reader import router as aadhar_router
from routes.upload_category import router as uploads_router
from routes.database import router as database_router
from routes.resume import router as resume_router
from constants import (
    API_PREFIX,
    ASSETS,
    AUDIO_DIR,
    IMAGE_DIR,
    IS_DEV,
    IS_PROD,
)
from routes import (
    analysis,
    chat,
    media,
    regenerate,
    search,
    submit,
    uploads,
    validate_image,
    contact,
)
from tools.mcpserver import sse_app
from utils.emoji_logger import get_logger
from utils.db_utils import mongo_client, db
from auth.admin_guard import validate_admin_configuration, verify_admin_access
from routes.admin_lancedb import router as admin_lancedb_router

print(f"IS DEV : {IS_DEV}")
print(f"IS PROD : {IS_PROD}")


class MyApp(FastAPI):
    mongo_client: MongoClient
    database: Database


logger = get_logger(__name__)

ALLOW_LOCAL = os.getenv("ALLOW_LOCAL_ORIGINS", "false").lower() == "true"

DEV_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:8000",
    "http://localhost:3000",
]

PROD_ORIGINS = [
    "https://pro.threadzip.com",  # Change this to your actual Astro/React URL
    "https://lab.threadzip.com",
    "https://app.threadzip.com",
    "https://threadzip.com",
    "https://recursivezero.github.io",
]

# Select origins based on the environment
origins = (
    DEV_ORIGINS
    if IS_DEV
    else (PROD_ORIGINS + DEV_ORIGINS if ALLOW_LOCAL else PROD_ORIGINS)
)

print(f"Allowed CORS origins: {origins}")


@asynccontextmanager
async def lifespan(app: MyApp):
    validate_admin_configuration()

    # Attach the client and db to the app so routes can access them
    app.mongo_client = mongo_client  # type: ignore[assignment]
    app.database = db

    # Startup: perform a simple health check
    try:
        if mongo_client is not None:
            mongo_client.admin.command("ping")
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
        if mongo_client is not None:
            mongo_client.close()
            logger.info("MongoDB connection closed")
    except Exception as e:
        logger.warning(f"Error while closing MongoDB client: {e}")


# Create the app using your MyApp subclass and wire the lifespan manager
app: MyApp = MyApp(
    title="TZ Fabric Assistant (with MCP Agent)",
    lifespan=lifespan,
    docs_url="/docs" if IS_DEV else None,
    redoc_url="/redoc" if IS_DEV else None,
    openapi_url="/openapi.json" if IS_DEV else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(ASSETS, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/mcp/", sse_app())
app.mount("/assets/images", StaticFiles(directory=IMAGE_DIR), name="assets_images")
app.mount("/assets/audios", StaticFiles(directory=AUDIO_DIR), name="assets_audios")

templates = Jinja2Templates(directory="templates")


@app.get("/__routes", tags=["Meta"])
def _routes():
    return [getattr(r, "path", str(r)) for r in app.routes]


@app.get("/", tags=["Meta"], response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request, "index.html")


# Include routers after app creation
app.include_router(analysis.router, prefix=API_PREFIX, tags=["V1"])
app.include_router(regenerate.router, prefix=API_PREFIX, tags=["V1"])
app.include_router(validate_image.router, prefix=API_PREFIX, tags=["V1"])
app.include_router(search.router, prefix=API_PREFIX, tags=["V1"])
app.include_router(submit.router, prefix=API_PREFIX, tags=["V1"])
app.include_router(media.router, prefix=API_PREFIX, tags=["V1"])
app.include_router(chat.router, prefix=API_PREFIX, tags=["V1"])
app.include_router(uploads.router, prefix=API_PREFIX, tags=["V1"])
app.include_router(contact.router, prefix=API_PREFIX, tags=["V1"])
app.include_router(uploads_router, prefix=API_PREFIX, tags=["V1"])
app.include_router(card_router, prefix=API_PREFIX, tags=["V1"])
app.include_router(aadhar_router, prefix=API_PREFIX, tags=["V1"])
app.include_router(database_router, prefix=API_PREFIX, tags=["V1", "Database"])
app.include_router(
    resume_router,
    prefix=API_PREFIX,
    tags=["V1", "Resume"],
    dependencies=[Security(verify_admin_access)],  # THE SECURITY LOCK
)

app.include_router(
    admin_lancedb_router,
    prefix=API_PREFIX,
    tags=["V1", "Admin", "LanceDB"],
)
