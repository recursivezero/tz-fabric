# routes/media.py
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

from constants import AUDIO_DIR, IMAGE_DIR
from utils.paths import build_audio_url, build_image_url

router = APIRouter(tags=["media"])


@router.get("/assets/images/{filename}")
def get_image(filename: str):
    path = IMAGE_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@router.get("/assets/audios/{filename}")
def get_audio(filename: str):
    path = AUDIO_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path)


def _image_exists(filename: str | None) -> bool:
    return bool(filename) and (IMAGE_DIR / filename).exists()


def _audio_exists(filename: str | None) -> bool:
    return bool(filename) and (AUDIO_DIR / filename).exists()


@router.get("/media/content")
def list_media_content(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(4, ge=1, le=100),
):

    db = request.app.database

    total_valid = 0
    for doc in db.images.find({}, {"filename": 1}):
        if _image_exists(doc.get("filename")):
            total_valid += 1

    want_start = (page - 1) * limit

    q = db.images.find({}, {"_id": 1, "filename": 1, "created_on": 1, "basename": 1}).sort("created_on", -1)

    valid_index = 0
    items: list[dict] = []

    for img in q:
        image_filename = img.get("filename")
        if not _image_exists(image_filename):
            continue

        if valid_index >= want_start and len(items) < limit:
            basename = img.get("basename") or Path(image_filename).stem
            created_at = img.get("created_on")

            image_url = build_image_url(image_filename)

            audio_doc = db.audios.find_one({"basename": basename}, {"filename": 1})
            audio_filename = audio_doc["filename"] if audio_doc else None
            audio_url = build_audio_url(audio_filename) if _audio_exists(audio_filename) else None

            items.append(
                {
                    "_id": str(img["_id"]),
                    "imageUrl": image_url,
                    "audioUrl": audio_url,
                    "createdAt": created_at,
                    "basename": basename,
                    "imageFilename": image_filename,
                    "audioFilename": audio_filename if audio_url else None,
                }
            )

        valid_index += 1
        if len(items) >= limit:
            break

    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total_valid,
        "total_pages": (total_valid + limit - 1) // limit,
    }
