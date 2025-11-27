from fastapi import APIRouter, UploadFile, File, Request, BackgroundTasks, Form
from pathlib import Path
from datetime import datetime
import shutil

from utils.filename import sanitize_filename
from constants import IMAGE_DIR, AUDIO_DIR
from core.embedder import embed_image_bytes
from core.store import get_index

router = APIRouter()


IMAGE_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def _process_index_job(
    db,
    image_path: Path,
    basename: str,
    image_filename: str,
    audio_filename: str,
    created_on: str,
):
    db.images.update_one(
        {"filename": image_filename, "status": "queued"},
        {"$set": {"status": "processing"}},
    )

    try:
        image_bytes = image_path.read_bytes()
        embedding = embed_image_bytes(image_bytes)

        collection = get_index()
        metadata = {
            "basename": basename,
            "imageFilename": image_filename,
            "audioFilename": audio_filename,
            "createdAt": created_on,
        }
        collection.add(
            ids=[image_filename], embeddings=[embedding], metadatas=[metadata]
        )

        db.images.update_one(
            {"filename": image_filename},
            {
                "$set": {
                    "status": "indexed",
                    "indexedAt": datetime.utcnow().isoformat(),
                },
                "$unset": {"errorMessage": ""},
            },
        )
    except Exception as e:
        db.images.update_one(
            {"filename": image_filename},
            {"$set": {"status": "failed", "errorMessage": str(e)}},
        )


@router.post("/submit")
async def submit_file(
    request: Request,
    background: BackgroundTasks,
    image: UploadFile = File(...),
    audio: UploadFile = File(...),
    name: str = Form(None),
):
    db = request.app.database

    # pick base name
    if name and name.strip():
        base_name = sanitize_filename(name)
    else:
        base_name = sanitize_filename(image.filename)

    image_ext = Path(image.filename).suffix.lower().lstrip(".")
    audio_ext = Path(audio.filename).suffix.lower().lstrip(".")

    image_filename = f"{base_name}.{image_ext}"
    audio_filename = f"{base_name}.{audio_ext}"

    image_path = IMAGE_DIR / image_filename
    audio_path = AUDIO_DIR / audio_filename

    # save files
    image.file.seek(0)
    with image_path.open("wb") as out:
        shutil.copyfileobj(image.file, out)

    audio.file.seek(0)
    with audio_path.open("wb") as out:
        shutil.copyfileobj(audio.file, out)

    created_on = datetime.utcnow().isoformat()

    # store only clean metadata in DB
    db.images.insert_one(
        {
            "basename": base_name,
            "filename": image_filename,
            "created_on": created_on,
            "file_type": image.content_type,
            "status": "queued",
            "indexedAt": None,
            "errorMessage": None,
        }
    )

    db.audios.insert_one(
        {
            "basename": base_name,
            "filename": audio_filename,
            "created_on": created_on,
            "file_type": audio.content_type,
        }
    )

    # schedule background indexing
    background.add_task(
        _process_index_job,
        db=db,
        image_path=image_path,
        basename=base_name,
        image_filename=image_filename,
        audio_filename=audio_filename,
        created_on=created_on,
    )

    return {
        "message": "Uploaded",
        "base": base_name,
        "status": "queued",
        "filename": image_filename,
    }
