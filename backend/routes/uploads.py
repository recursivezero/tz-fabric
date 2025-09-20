# routes/uploads.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
import shutil, uuid
from constants import ASSETS

router = APIRouter()

upload_dir = Path(ASSETS)
images_dir = upload_dir / "images"
audio_dir = upload_dir / "audios"
images_dir.mkdir(parents=True, exist_ok=True)
audio_dir.mkdir(parents=True, exist_ok=True)

@router.post("/uploads/tmp_media")
async def upload_tmp_media(image: UploadFile = File(None), audio: UploadFile = File(None)):
    """
    Accepts multipart form with fields:
      - image (optional): UploadFile
      - audio (optional): UploadFile
    Returns accessible URLs for saved assets and a generated filename (basename).
    """
    if not image and not audio:
        raise HTTPException(status_code=400, detail="No files provided. Provide at least image or audio.")

    # pick a basename from the image filename if present, else audio, else uuid
    if image and image.filename:
        stem = Path(image.filename).stem
    elif audio and audio.filename:
        stem = Path(audio.filename).stem
    else:
        stem = uuid.uuid4().hex[:12]

    saved_image_url = None
    saved_audio_url = None
    saved_image_name = None
    saved_audio_name = None

    # Save image if present
    if image:
        img_ext = Path(image.filename).suffix or ".jpg"
        img_name = f"{uuid.uuid4().hex}{img_ext}"
        img_path = images_dir / img_name
        try:
            with img_path.open("wb") as out:
                shutil.copyfileobj(image.file, out)
            saved_image_url = f"http://127.0.0.1:8000/assets/images/{img_name}"
            saved_image_name = img_name
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save image: {e}")

    # Save audio if present
    if audio:
        aud_ext = Path(audio.filename).suffix or ".mp3"
        aud_name = f"{uuid.uuid4().hex}{aud_ext}"
        aud_path = audio_dir / aud_name
        try:
            with aud_path.open("wb") as out:
                shutil.copyfileobj(audio.file, out)
            saved_audio_url = f"http://127.0.0.1:8000/assets/images/../audio/{aud_name}"
            # NOTE: the above path is a quick way; consider mounting audio dir at /assets/audio for clarity
            saved_audio_name = aud_name
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save audio: {e}")

    return {
        "image_url": saved_image_url,
        "audio_url": saved_audio_url,
        "filename": stem,
        "image_filename": saved_image_name,
        "audio_filename": saved_audio_name,
    }
