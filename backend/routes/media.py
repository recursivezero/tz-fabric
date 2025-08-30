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
    skip = (page - 1) * limit

    cursor = (
        db.images.find(
            {},
            {
                "_id": 1,
                "filename": 1,     
                "imageUrl": 1,
                "audioUrl": 1,
                "created_on": 1,
                "basename": 1,        
            }
        )
        .sort("created_on", -1)
        .skip(skip)
        .limit(limit)
    )

    items = []
    for img in cursor:
        image_filename = img.get("filename")
        image_url = img.get("imageUrl") or f"/api/assets/images/{image_filename}"
        created_at = img.get("created_on")

        basename = img.get("basename") or Path(image_filename).stem

        
        audio_doc = db.audios.find_one(
            {"basename": basename},
            {"filename": 1}
        )

        
        if not audio_doc:
            audio_doc = db.audios.find_one(
                {"filename": {"$regex": f"^{basename}\\.", "$options": "i"}},
                {"filename": 1}
            )

        audio_filename = audio_doc["filename"] if audio_doc else None
        audio_url = img.get("audioUrl") or (f"/api/assets/audios/{audio_filename}" if audio_filename else None)

        items.append({
            "_id": str(img["_id"]),
            "imageUrl": image_url,
            "audioUrl": audio_url,
            "createdAt": created_at,
            "basename": basename,                  
            "imageFilename": image_filename,       
            "audioFilename": audio_filename,       
        })

    return {"items": items, "page": page, "limit": limit, "total": total_count}