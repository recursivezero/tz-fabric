# routes/uploads.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil, uuid
from constants import ASSETS

router = APIRouter()

upload_dir = Path(ASSETS)
upload_dir.mkdir(parents=True, exist_ok=True)

@router.post("/uploads/tmp")
async def upload_tmp(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix or ".png"
    fname = f"{uuid.uuid4().hex}{ext}"
    dest = upload_dir / fname

    try:
        with dest.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    image_url = f"http://127.0.0.1:8000/assets/images/{fname}"
    return {"image_url": image_url, "filename": fname}
