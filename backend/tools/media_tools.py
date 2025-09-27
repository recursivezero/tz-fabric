# tools/media_tool.py
from typing import Optional, Dict, Any, List
from pathlib import Path
from datetime import datetime
import os, uuid, threading, tempfile, requests
from dotenv import load_dotenv

from core.embedder import embed_image_bytes
from core.store import get_index
from utils.filename import sanitize_filename
from constants import IMAGE_DIR, AUDIO_DIR

load_dotenv()


IMAGE_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def _safe_download(url: str, timeout: int = 20) -> bytes:
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    return r.content

def _atomic_write(path: Path, data: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, str(path))
    finally:
        if os.path.exists(tmp):
            try: os.remove(tmp)
            except Exception: pass


# --------------------
# Background job
# --------------------
def _background_index_job(db, image_path: Path, basename: str, image_filename: str,
                          audio_filename: Optional[str], created_on: str):
    try:
        if db is not None:
            db.images.update_one(
                {"filename": image_filename, "status": "queued"},
                {"$set": {"status": "processing"}}
            )
    except Exception:
        pass

    try:
        image_bytes = image_path.read_bytes()
        embedding = embed_image_bytes(image_bytes)

        metadata = {
            "basename": str(basename),
            "imageFilename": str(image_filename),
            "createdAt": str(created_on)
        }
        if audio_filename:
            metadata["audioFilename"] = str(audio_filename)

        collection = get_index()
        collection.add(ids=[image_filename], embeddings=[embedding], metadatas=[metadata])

        if db is not None:
            db.images.update_one(
                {"filename": image_filename},
                {"$set": {"status": "indexed", "indexedAt": datetime.utcnow().isoformat()},
                 "$unset": {"errorMessage": ""}}
            )
    except Exception as e:
        if db is not None:
            try:
                db.images.update_one(
                    {"filename": image_filename},
                    {"$set": {"status": "failed", "errorMessage": str(e)}}
                )
            except Exception:
                pass
        print("Indexing job failed:", e)


# --------------------
# Main tool
# --------------------
def redirect_to_media_analysis(image_url: Optional[str] = None,
                               audio_url: Optional[str] = None,
                               filename: Optional[str] = None) -> Dict[str, Any]:
    params = {"image_url": image_url, "audio_url": audio_url, "filename": filename}
    bot_messages: List[str] = []

    if not image_url:
        return {"action": {"type":"redirect_to_media_analysis", "params": params},
                "bot_messages": ["No image_url provided."]}

    # Basename
    raw_basename = filename or Path(image_url).stem or uuid.uuid4().hex[:8]
    basename = sanitize_filename(raw_basename)

    # Filenames
    img_ext = Path(image_url).suffix or ".jpg"
    image_filename = f"{basename}.{img_ext.lstrip('.')}"
    image_path = IMAGE_DIR / image_filename

    audio_filename = None
    audio_path = None
    if audio_url:
        aud_ext = Path(audio_url).suffix or ".mp3"
        audio_filename = f"{basename}.{aud_ext.lstrip('.')}"
        audio_path = AUDIO_DIR / audio_filename

    # Save image
    try:
        b = _safe_download(image_url)
        _atomic_write(image_path, b)
        bot_messages.append(f"Saved image as {image_filename}")
    except Exception as e:
        return {"action": {"type":"redirect_to_media_analysis", "params": params},
                "bot_messages": [f"Failed to download/save image: {e}"]}

    # Save audio
    if audio_url:
        try:
            b = _safe_download(audio_url)
            _atomic_write(audio_path, b)
            bot_messages.append(f"Saved audio as {audio_filename}")
        except Exception as e:
            bot_messages.append(f"Warning: failed to download/save audio: {e}")
            audio_filename = None
            audio_path = None

    # MongoDB
    db = None
    try:
        from pymongo import MongoClient, uri_parser
        DATABASE_URI = os.getenv("DATABASE_URI")
        parsed_uri = uri_parser.parse_uri(DATABASE_URI)
        db_name = parsed_uri.get("database") or "tz-fabric"
        client = MongoClient(DATABASE_URI)
        db = client[db_name]
        print("Connected to MongoDB, using database:", db.name)
    except Exception as e:
        db = None
        print("MongoDB not available:", e)

    # Insert docs
    created_on = datetime.utcnow().isoformat()
    if db is not None:
        try:
            db.images.insert_one({
                "basename": basename,
                "filename": image_filename,
                "created_on": created_on,
                "file_type": "image",
                "status": "queued",
                "indexedAt": None,
                "errorMessage": None,
            })
            bot_messages.append("Inserted image metadata into DB (status=queued).")
        except Exception as e:
            bot_messages.append(f"DB warning: failed to insert image metadata: {e}")
        if audio_filename:
            try:
                db.audios.insert_one({
                    "basename": basename,
                    "filename": audio_filename,
                    "created_on": created_on,
                    "file_type": "audio"
                })
                bot_messages.append("Inserted audio metadata into DB.")
            except Exception as e:
                bot_messages.append(f"DB warning: failed to insert audio metadata: {e}")
    else:
        bot_messages.append("Warning: MongoDB not available; files saved but DB insert skipped.")

    # Background indexing
    try:
        t = threading.Thread(
            target=_background_index_job,
            args=(db, image_path, basename, image_filename, audio_filename, created_on),
            daemon=True
        )
        t.start()
        bot_messages.append("Indexing scheduled in background.")
    except Exception as e:
        bot_messages.append(f"Failed to schedule indexing job: {e}")

    return {
        "action": {"type": "redirect_to_media_analysis",
                   "params": {"image_url": image_url, "audio_url": audio_url,
                              "filename": basename,
                              "saved_image": str(image_path),
                              "saved_audio": str(audio_path) if audio_path else None}},
        "bot_messages": bot_messages + [f"Uploaded and queued as basename='{basename}', image='{image_filename}'"],
        "analysis_responses": None,
    }
