# routes/uploads.py
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pathlib import Path
import shutil, uuid
from constants import IMAGE_DIR, AUDIO_DIR
from utils.filename import sanitize_filename   

router = APIRouter()

IMAGE_DIR.mkdir(parents=True, exist_ok=True)
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/uploads/tmp_media")
async def upload_tmp_media(
    image: UploadFile = File(None),
    audio: UploadFile = File(None),
    filename: str | None = Form(None)          # <-- 👈 accept provided name
):
    if not image and not audio:
        raise HTTPException(status_code=400, detail="No files provided. Provide at least image or audio.")

    # 1) Decide the base name (prefer provided filename)
    if filename and filename.strip():
        stem = filename.strip()
    elif image and image.filename:
        stem = Path(image.filename).stem
    elif audio and audio.filename:
        stem = Path(audio.filename).stem
    else:
        stem = uuid.uuid4().hex[:12]

    base = sanitize_filename(stem) or "upload"
    base = base[:80]
    uniq = uuid.uuid4().hex[:6]   # avoid collisions

    saved_image_url = saved_audio_url = None
    saved_image_name = saved_audio_name = None

    # 2) Save image (keep readable base)
    if image and image.filename:
        img_ext = Path(image.filename).suffix or ".jpg"
        img_name = f"{base}-{uniq}{img_ext}"
        img_path = IMAGE_DIR / img_name
        try:
            with img_path.open("wb") as out:
                shutil.copyfileobj(image.file, out)
            saved_image_url = f"http://127.0.0.1:8000/assets/images/{img_name}"
            saved_image_name = img_name
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save image: {e}")

    # 3) Save audio (same readable base)
    if audio and audio.filename:
        aud_ext = Path(audio.filename).suffix or ".mp3"
        aud_name = f"{base}-{uniq}{aud_ext}"
        aud_path = AUDIO_DIR / aud_name
        try:
            with aud_path.open("wb") as out:
                shutil.copyfileobj(audio.file, out)
            saved_audio_url = f"http://127.0.0.1:8000/assets/audios/{aud_name}"
            saved_audio_name = aud_name
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save audio: {e}")

    # 4) Return the human-readable base (frontend uses this as finalBasename)
    return {
        "image_url": saved_image_url,
        "audio_url": saved_audio_url,
        "basename": base,          
        "filename": base,          
        "image_filename": saved_image_name,
        "audio_filename": saved_audio_name,
    }
