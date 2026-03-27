# routes/media.py
from pathlib import Path
from typing import Optional


from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse

from constants import AUDIO_DIR, IMAGE_DIR, IS_PROD
from utils.paths import build_audio_url, build_image_url

router = APIRouter(tags=["media"])


@router.get("/assets/images/{filename}")
def get_image(filename: str):
    if IS_PROD:
        raise HTTPException(status_code=404)

    path = IMAGE_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404)

    return FileResponse(path)


@router.get("/assets/audios/{filename}")
def get_audio(filename: str):
    if IS_PROD:
        raise HTTPException(status_code=404)

    path = AUDIO_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path)


def _image_exists(filename: Optional[str], is_prod: bool) -> bool:
    if not filename:
        return False

    # environment mismatch → reject
    if IS_PROD and not is_prod:
        return False

    if not IS_PROD and is_prod:
        return False

    # dev environment → verify local file
    if not IS_PROD:
        return (IMAGE_DIR / filename).exists()

    # production → trust metadata
    return True


def _audio_exists(filename: Optional[str], is_prod: bool) -> bool:
    if not filename:
        return False

    if IS_PROD and not is_prod:
        return False

    if not IS_PROD and is_prod:
        return False

    if not IS_PROD:
        return (AUDIO_DIR / filename).exists()

    return True


@router.get("/media/content")
def list_media_content(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(4, ge=1, le=100),
):

    db = request.app.database

    images = list(
        db.images.find(
            {}, {"_id": 1, "filename": 1, "created_on": 1, "basename": 1, "is_prod": 1}
        ).sort("created_on", -1)
    )

    # build audio map once
    audio_map = {
        a["basename"]: a["filename"]
        for a in db.audios.find({}, {"basename": 1, "filename": 1, "is_prod": 1})
    }

    valid_items = []

    for img in images:

        image_filename = img.get("filename")
        if not image_filename:
            continue

        is_prod = img.get("is_prod")
        basename = img.get("basename") or Path(image_filename).stem

        audio_filename = audio_map.get(basename)

        # fabric must have audio
        if not audio_filename:
            continue

        if not _image_exists(image_filename, is_prod):
            continue

        if not _audio_exists(audio_filename, is_prod):
            continue

        valid_items.append((img, image_filename, audio_filename))
    print(f"Found {len(valid_items)} valid media items")

    start = (page - 1) * limit
    page_items = valid_items[start : start + limit]

    items = []

    for img, image_filename, audio_filename in page_items:

        basename = img.get("basename") or Path(image_filename).stem
        created_at = img.get("created_on")

        items.append(
            {
                "_id": str(img["_id"]),
                "imageUrl": build_image_url(image_filename),
                "audioUrl": build_audio_url(audio_filename),
                "createdAt": created_at,
                "basename": basename,
                "imageFilename": image_filename,
                "audioFilename": audio_filename,
            }
        )
    import math

    total = len(valid_items)
    total_pages = math.ceil(total / limit)

    return {
        "items": items,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": total_pages,
    }
