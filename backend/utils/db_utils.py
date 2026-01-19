from datetime import datetime
import os
from typing import Optional, Dict
from constants import FABRIC_COLLECTION, PROCESSING_TIMES_COLLECTION
from pymongo import MongoClient
from pymongo.collection import Collection
import io

MONGO_CONFIG: Dict[str, Optional[str]] = {
    "MONGODB_URI": os.getenv("DATABASE_URI", "mongodb://localhost:27017"),
    "DATABASE_NAME": "tz-fabric",
}


mongo_client: Optional[MongoClient] = None
collection: Optional[Collection] = None
fabric_collection: Optional[Collection] = None
processing_times_collection: Optional[Collection] = None

# Initialize MongoDB connections with error handling
mongo_uri: str = MONGO_CONFIG["MONGODB_URI"] or "mongodb://localhost:27017"
mongo_client = MongoClient(mongo_uri)
db_name: str = MONGO_CONFIG["DATABASE_NAME"] or "tz-fabric"
db = mongo_client[db_name]
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
