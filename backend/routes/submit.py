from fastapi import APIRouter, UploadFile, File, Request, BackgroundTasks, Form
from pathlib import Path
from datetime import datetime
import shutil

from utils.filename import sanitize_filename
from constants import UPLOAD_ROOT
from core.embedder import embed_image_bytes
from core.store import get_index

router = APIRouter()

UPLOAD_IMAGE_DIR = Path(UPLOAD_ROOT) / "images"
UPLOAD_AUDIO_DIR = Path(UPLOAD_ROOT) / "audios"
UPLOAD_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def _process_index_job(
    db,
    image_path: Path,
    rel_path: str,
    image_url: str,
    audio_url: str,
    created_on: str,
    basename: str,               
    image_filename: str,         
    audio_filename: str          
):
    db.images.update_one(
        {"relPath": rel_path, "status": "queued"},
        {"$set": {"status": "processing"}}
    )

    try:
        image_bytes = image_path.read_bytes()
        embedding = embed_image_bytes(image_bytes)

        collection = get_index()
        metadata = {
            "imageUrl": image_url,
            "audioUrl": audio_url,
            "createdAt": created_on,
            "relPath": rel_path,
            "basename": basename,
            "imageFilename": image_filename,
            "audioFilename": audio_filename,
        }
        collection.add(
            ids=[rel_path],
            embeddings=[embedding],
            metadatas=[metadata]
        )

        db.images.update_one(
            {"relPath": rel_path},
            {"$set": {"status": "indexed", "indexedAt": datetime.utcnow().isoformat()},
             "$unset": {"errorMessage": ""}}
        )
    except Exception as e:
        db.images.update_one(
            {"relPath": rel_path},
            {"$set": {"status": "failed", "errorMessage": str(e)}}
        )


@router.post("/submit")
async def submit_file(
    request: Request,
    background: BackgroundTasks,
    image: UploadFile = File(...),
    audio: UploadFile = File(...),
    name: str = Form(None)  
):
    db = request.app.database

    if name and name.strip():
        base_name = sanitize_filename(name)
    else:
        base_name = sanitize_filename(image.filename)

    
    image_ext = Path(image.filename).suffix.lower().lstrip(".")
    audio_ext = Path(audio.filename).suffix.lower().lstrip(".")

    image_filename = f"{base_name}.{image_ext}"
    audio_filename = f"{base_name}.{audio_ext}"

    image_path = UPLOAD_IMAGE_DIR / image_filename
    audio_path = UPLOAD_AUDIO_DIR / audio_filename

    image.file.seek(0)
    with image_path.open("wb") as out:
        shutil.copyfileobj(image.file, out)

    audio.file.seek(0)
    with audio_path.open("wb") as out:
        shutil.copyfileobj(audio.file, out)

    rel_path = f"images/{image_filename}"  
    image_url = f"/api/assets/images/{image_filename}"
    audio_url = f"/api/assets/audios/{audio_filename}"
    created_on = datetime.utcnow().isoformat()

    db.images.insert_one({
        "basename": base_name,             
        "filename": image_filename,
        "created_on": created_on,
        "file_type": image.content_type,
        "relPath": rel_path,
        "imageUrl": image_url,
        "audioUrl": audio_url,
        "status": "queued",
        "indexedAt": None,
        "errorMessage": None
    })

    db.audios.insert_one({
        "basename": base_name,             
        "filename": audio_filename,
        "created_on": created_on,
        "file_type": audio.content_type
    })

    background.add_task(
        _process_index_job,
        db=db,
        image_path=image_path,
        rel_path=rel_path,
        image_url=image_url,
        audio_url=audio_url,
        created_on=created_on,
        basename=base_name,                
        image_filename=image_filename,      
        audio_filename=audio_filename
    )

    return {
        "message": "Uploaded",
        "base": base_name,      
        "status": "queued",
        "relPath": rel_path
    }
