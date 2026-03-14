import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional, cast


from utils.aws_helper import upload_file
from fastapi import APIRouter, BackgroundTasks, File, Form, Request, UploadFile

from constants import AUDIO_DIR, IMAGE_DIR, IS_PROD
from core.embedder import embed_image_bytes
from core.store import get_index
from utils.filename import sanitize_filename

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
        # Chromadb stubs are strict about ndarray vs list; cast to Any so mypy accepts it.
        collection.add(
            ids=[image_filename],
            embeddings=cast(Any, [embedding]),
            metadatas=[metadata],
        )

        db.images.update_one(
            {"filename": image_filename},
            {
                "$set": {
                    "status": "indexed",
                    "indexedAt": datetime.now(timezone.utc).isoformat(),
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
    name: Optional[str] = Form(None),
):
    db = request.app.database

    # pick base name
    if name and name.strip():
        base_name = sanitize_filename(name)
    else:
        # UploadFile.filename may be typed Optional[str] in some stubs — narrow for mypy
        assert image.filename is not None
        base_name = sanitize_filename(image.filename)
    assert image.filename is not None
    assert audio.filename is not None

    image_ext = Path(image.filename).suffix.lower().lstrip(".")
    audio_ext = Path(audio.filename).suffix.lower().lstrip(".")

    image_filename = f"{base_name}.{image_ext}"
    audio_filename = f"{base_name}.{audio_ext}"

    if IS_PROD:
        # upload to S3

        image.file.seek(0)
        image_key = f"uploaded/fabric/{image_filename}"
        if upload_file(image.file, image_key):
            print(f"Uploaded {image_filename} to S3")
        image_path = None

        audio.file.seek(0)
        audio_key = f"uploaded/audios/{audio_filename}"
        if upload_file(audio.file, audio_key):
            print(f"Uploaded {audio_filename} to S3")
        audio_path = None

    else:
        # save locally

        image_path = IMAGE_DIR / image_filename
        audio_path = AUDIO_DIR / audio_filename

        image.file.seek(0)
        with image_path.open("wb") as out:
            shutil.copyfileobj(image.file, out)

        audio.file.seek(0)
        with audio_path.open("wb") as out:
            shutil.copyfileobj(audio.file, out)

    created_on = datetime.now(timezone.utc).isoformat()

    # store only clean metadata in DB
    db.images.insert_one(
        {
            "basename": base_name,
            "filename": image_filename,
            "created_on": created_on,
            "file_type": image.content_type,
            "is_prod": IS_PROD,
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
            "is_prod": IS_PROD,
            "file_type": audio.content_type,
        }
    )

    # schedule background indexing
    background.add_task(
        _process_index_job,
        db=db,
        image_path=cast(Path, image_path),
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
