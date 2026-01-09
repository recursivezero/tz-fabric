import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pymongo import MongoClient, errors, uri_parser
from pymongo.database import Database
from typing import Collection, Optional
from routes.card_reader import router as card_router
from routes.adhaar_reader import router as aadhar_router

from constants import (
    API_PREFIX,
    ASSETS,
    AUDIO_DIR,
    GENERATED_IMAGE_FOLDER,
    IMAGE_DIR,
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


class MyApp(FastAPI):
    mongo_client: MongoClient
    database: Database


load_dotenv()

logger = get_logger(__name__)

origins = [
    "http://localhost:4173",
    "http://localhost:5173",  # Allow requests from your frontend origin
    # You can add more origins here if needed
]


@asynccontextmanager
async def lifespan(app: MyApp):
    # Attach the client and db to the app so routes can access them
    app.mongo_client = mongo_client
    app.database = db

    # Startup: perform a simple health check
    try:
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
        mongo_client.close()
        logger.info("MongoDB connection closed")
    except Exception as e:
        logger.warning(f"Error while closing MongoDB client: {e}")


# Create the app using your MyApp subclass and wire the lifespan manager
app: MyApp = MyApp(title="TZ Fabric Assistant (with MCP Agent)", lifespan=lifespan)

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
app.mount("/generated", StaticFiles(directory=GENERATED_IMAGE_FOLDER), name="generated")

templates = Jinja2Templates(directory="templates")

# Include routers after app creation
app.include_router(analysis.router, prefix=API_PREFIX)
app.include_router(regenerate.router, prefix=API_PREFIX)
app.include_router(validate_image.router, prefix=API_PREFIX)
app.include_router(search.router, prefix=API_PREFIX)
app.include_router(submit.router, prefix=API_PREFIX)
app.include_router(media.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=API_PREFIX)
app.include_router(uploads.router, prefix=API_PREFIX)
app.include_router(contact.router, prefix=API_PREFIX)

app.include_router(card_router, prefix=API_PREFIX)

app.include_router(aadhar_router, prefix=API_PREFIX)


@app.get("/__routes")
def _routes():
    return [getattr(r, "path", str(r)) for r in app.routes]


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})
