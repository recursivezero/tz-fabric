from fastapi import APIRouter, UploadFile, File, Request
from pathlib import Path
from datetime import datetime
import shutil
from utils.filename import sanitize_filename
from constants import UPLOAD_ROOT 

router = APIRouter()

UPLOAD_IMAGE_DIR = Path(UPLOAD_ROOT) / "images"
UPLOAD_AUDIO_DIR = Path(UPLOAD_ROOT) / "audios"
UPLOAD_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/submit")
async def submit_file(request: Request, image: UploadFile = File(...), audio: UploadFile = File(...)):
    db = request.app.database

    base_name = sanitize_filename(image.filename)

    image_ext = image.filename.rsplit(".", 1)[-1]
    image_filename = f"{base_name}.{image_ext}"

    audio_ext = audio.filename.rsplit(".", 1)[-1]
    audio_filename = f"{base_name}.{audio_ext}"

    image_path = UPLOAD_IMAGE_DIR / image_filename
    audio_path = UPLOAD_AUDIO_DIR / audio_filename  

    image.file.seek(0)
    with image_path.open("wb") as out:
        shutil.copyfileobj(image.file, out)

    audio.file.seek(0)
    with audio_path.open("wb") as out:
        shutil.copyfileobj(audio.file, out)

    db.images.insert_one({
        "original_filename": image.filename,         
        "filename": image_filename,
        "created_on": datetime.utcnow(),
        "file_type": image.content_type
    })

    db.audios.insert_one({
        "filename": audio_filename,
        "created_on": datetime.utcnow(),
        "file_type": audio.content_type
    })

    return {"message": "Uploaded", "base": base_name}
