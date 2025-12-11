from datetime import datetime
import os
from typing import Optional
from constants import FABRIC_COLLECTION, PROCESSING_TIMES_COLLECTION
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
import io

MONGO_CONFIG = {
    "MONGODB_URI": os.getenv("DATABASE_URI"),
    "DATABASE_NAME": "tz-fabric",
}
print("Using MONGO URI =", os.getenv("DATABASE_URI"))

mongo_client: Optional[MongoClient]
collection: Optional[Collection]
fabric_collection: Optional[Collection]
processing_times_collection: Optional[Collection]

# Initialize MongoDB connections with error handling
mongo_client = MongoClient(MONGO_CONFIG["MONGODB_URI"])
db = mongo_client[MONGO_CONFIG["DATABASE_NAME"]]
fabric_collection = db[FABRIC_COLLECTION]
processing_times_collection = db[PROCESSING_TIMES_COLLECTION]


def save_to_mongodb(data: dict, collection):
    """Insert processed JSON data into MongoDB"""
    try:
        data["created_at"] = datetime.now()
        result = collection.insert_one(data)
        return result.inserted_id
    except Exception as e:
        print("MongoDB Insert Error:", e)
        return False


def pil_to_bytes(pil_image):
    buf = io.BytesIO()
    pil_image.save(buf, format="PNG")
    buf.seek(0)
    return buf
