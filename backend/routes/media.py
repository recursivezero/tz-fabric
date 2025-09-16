from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from constants import IMAGE_DIR, AUDIO_DIR
from utils.paths import build_image_url, build_audio_url

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


@router.get("/media/content")
def list_media_content(
    request: Request, page: int = Query(1, ge=1), limit: int = Query(4, ge=1)
):
    db = request.app.database

    total_count = db.images.count_documents({})
    skip = (page - 1) * limit

    cursor = (
        db.images.find(
            {},
            {
                "_id": 1,
                "filename": 1,
                "created_on": 1,
                "basename": 1,
            },
        )
        .sort("created_on", -1)
        .skip(skip)
        .limit(limit)
    )

    items = []
    for img in cursor:
        image_filename = img.get("filename")
        basename = img.get("basename") or Path(image_filename).stem
        created_at = img.get("created_on")

        image_url = build_image_url(image_filename) if image_filename else None
        print("Image URL:", image_url)

        # find matching audio by basename
        audio_doc = db.audios.find_one({"basename": basename}, {"filename": 1})
        audio_filename = audio_doc["filename"] if audio_doc else None
        audio_url = build_audio_url(audio_filename) if audio_filename else None
        print("Audio URL:", audio_url)

        items.append(
            {
                "_id": str(img["_id"]),
                "imageUrl": image_url,
                "audioUrl": audio_url,
                "createdAt": created_at,
                "basename": basename,
                "imageFilename": image_filename,
                "audioFilename": audio_filename,
            }
        )

    return {"items": items, "page": page, "limit": limit, "total": total_count}
