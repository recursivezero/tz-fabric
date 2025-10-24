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
            try:
                os.remove(tmp)
            except Exception:
                pass


def _background_index_job(
    db,
    image_path: Path,
    basename: str,
    image_filename: str,
    audio_filename: Optional[str],
    created_on: str,
):
    # Mark processing
    try:
        if db is not None:
            db.images.update_one(
                {"filename": image_filename, "status": "queued"},
                {"$set": {"status": "processing"}}
            )
    except Exception:
        pass

    # Embed + add to vector store
    try:
        image_bytes = image_path.read_bytes()
        embedding = embed_image_bytes(image_bytes)

        metadata = {
            "basename": str(basename),
            "imageFilename": str(image_filename),
            "createdAt": str(created_on),
        }
        if audio_filename:
            metadata["audioFilename"] = str(audio_filename)

        collection = get_index()
        collection.add(ids=[image_filename], embeddings=[embedding], metadatas=[metadata])

        if db is not None:
            db.images.update_one(
                {"filename": image_filename},
                {
                    "$set": {"status": "indexed", "indexedAt": datetime.utcnow().isoformat()},
                    "$unset": {"errorMessage": ""},
                },
            )
    except Exception as e:
        if db is not None:
            try:
                db.images.update_one(
                    {"filename": image_filename},
                    {"$set": {"status": "failed", "errorMessage": str(e)}},
                )
            except Exception:
                pass
        print("Indexing job failed:", e)


def redirect_to_media_analysis(
    image_path: Optional[str] = None,
    audio_path: Optional[str] = None,
    filename: Optional[str] = None,
    image_url: Optional[str] = None,
    audio_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Persist image (+optional audio), write DB rows, and queue indexing.
    Preference order for media sources:
      1) *path* (absolute server path) if provided
      2) download from *url* if path not provided

    Returns a unified envelope:
      { ok: bool, action, bot_messages, analysis_responses, error?, _via }
    """
    bot_messages: List[str] = []

    # Guard: need an image by path or URL
    if not image_path and not image_url:
        return {
            "ok": False,
            "error": {"code": "no_image", "message": "Provide image_path or image_url."},
            "bot_messages": ["❌ No image provided."],
            "_via": "media_tool",
        }

    # Decide human-friendly basename
    raw_basename = filename or (
        (Path(image_path).stem if image_path else None)
        or (Path(image_url).stem if image_url else None)
        or uuid.uuid4().hex[:8]
    )
    basename = sanitize_filename(raw_basename)

    # Save / copy IMAGE to IMAGE_DIR
    try:
        if image_path:
            src = Path(image_path)
            if not src.exists():
                return {
                    "ok": False,
                    "error": {"code": "image_missing", "message": f"image_path not found: {image_path}"},
                    "_via": "media_tool",
                }
            image_filename = src.name
            final_image_path = IMAGE_DIR / image_filename
            # Copy only if not already in target dir
            if str(src.resolve()) != str(final_image_path.resolve()):
                _atomic_write(final_image_path, src.read_bytes())
        else:
            img_ext = Path(image_url).suffix or ".jpg"
            image_filename = f"{basename}.{img_ext.lstrip('.')}"
            final_image_path = IMAGE_DIR / image_filename
            data = _safe_download(image_url)
            _atomic_write(final_image_path, data)
    except Exception as e:
        return {
            "ok": False,
            "error": {"code": "image_save_failed", "message": str(e)},
            "_via": "media_tool",
        }

    # Save / copy AUDIO to AUDIO_DIR (optional)
    audio_filename: Optional[str] = None
    saved_audio_path: Optional[Path] = None
    try:
        if audio_path:
            src = Path(audio_path)
            if src.exists():
                audio_filename = src.name
                final_audio_path = AUDIO_DIR / audio_filename
                if str(src.resolve()) != str(final_audio_path.resolve()):
                    _atomic_write(final_audio_path, src.read_bytes())
                saved_audio_path = final_audio_path
            else:
                bot_messages.append(f"Warning: audio_path not found: {audio_path}")
        elif audio_url:
            aud_ext = Path(audio_url).suffix or ".mp3"
            audio_filename = f"{basename}.{aud_ext.lstrip('.')}"
            final_audio_path = AUDIO_DIR / audio_filename
            try:
                data = _safe_download(audio_url)
                _atomic_write(final_audio_path, data)
                saved_audio_path = final_audio_path
            except Exception as e:
                bot_messages.append(f"Warning: failed to download/save audio: {e}")
                audio_filename = None
                saved_audio_path = None
    except Exception as e:
        bot_messages.append(f"Audio handling error: {e}")
        audio_filename = None
        saved_audio_path = None

    # Connect DB (best-effort)
    db = None
    try:
        from pymongo import MongoClient, uri_parser
        DATABASE_URI = os.getenv("DATABASE_URI")
        parsed_uri = uri_parser.parse_uri(DATABASE_URI)
        db_name = parsed_uri.get("database") or "tz-fabric"
        client = MongoClient(DATABASE_URI)
        db = client[db_name]
        print("✅ Connected to MongoDB, using database:", db.name)
    except Exception as e:
        db = None
        print("MongoDB not available:", e)
        bot_messages.append("Warning: MongoDB not available; files saved but DB insert skipped.")

    # Insert docs (if DB available)
    created_on = datetime.utcnow().isoformat()
    if db is not None:
        try:
            db.images.insert_one({
                "basename": basename,
                "filename": final_image_path.name,
                "created_on": created_on,
                "file_type": "image",
                "status": "queued",
                "indexedAt": None,
                "errorMessage": None,
            })
        except Exception as e:
            bot_messages.append(f"DB warning (image insert): {e}")
        if audio_filename:
            try:
                db.audios.insert_one({
                    "basename": basename,
                    "filename": saved_audio_path.name if saved_audio_path else audio_filename,
                    "created_on": created_on,
                    "file_type": "audio",
                })
            except Exception as e:
                bot_messages.append(f"DB warning (audio insert): {e}")

    # Background indexing
    try:
        t = threading.Thread(
            target=_background_index_job,
            args=(db, final_image_path, basename, final_image_path.name, (saved_audio_path.name if saved_audio_path else None), created_on),
            daemon=True
        )
        t.start()
    except Exception as e:
        bot_messages.append(f"Failed to schedule indexing job: {e}")

    return {
        "ok": True,
        "action": {
            "type": "redirect_to_media_analysis",
            "params": {
                "filename": basename,
                "saved_image": str(final_image_path),
                "saved_audio": str(saved_audio_path) if saved_audio_path else None,
            },
        },
        "bot_messages": bot_messages + [f"Uploaded and queued as basename='{basename}', image='{final_image_path.name}'"],
        "analysis_responses": None,
        "_via": "media_tool",
    }
