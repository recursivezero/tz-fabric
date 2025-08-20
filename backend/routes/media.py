from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from constants import UPLOAD_ROOT

router = APIRouter(tags=["media"])

IMAGES_DIR = Path(UPLOAD_ROOT) / "images"
AUDIOS_DIR = Path(UPLOAD_ROOT) / "audios"

@router.get("/assets/images/{filename}")
def get_image(filename: str):
    path = IMAGES_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)

@router.get("/assets/audios/{filename}")
def get_audio(filename: str):
    path = AUDIOS_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path)

@router.get("/media/content")
def list_media_content(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(4, ge=1)
):
    db = request.app.database

    total_count = db.images.count_documents({})

    images = list(db.images.find().sort("created_on", -1).skip((page - 1) * limit).limit(limit))
    items = []

    for img in images:
        img_name = img["filename"]
        base_name = Path(img_name).stem

        audio_doc = db.audios.find_one({"filename": {"$regex": f"^{base_name}"}})
        audio_url = f"/api/assets/audios/{audio_doc['filename']}" if audio_doc else None

        items.append({
            "_id": str(img["_id"]),
            "imageUrl": f"/api/assets/images/{img_name}",
            "audioUrl": audio_url,
            "createdAt": img["created_on"]
        })

    return {"items": items, "page": page, "limit": limit, "total": total_count}