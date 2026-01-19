from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image
from services.adhaar import AadhaarCardExtractor
import tempfile
import os

router = APIRouter()

extracter = AadhaarCardExtractor()


@router.post("/adhaar")
async def read_card(file: UploadFile = File(...), side: str = Form(...)):
    try:
        image = Image.open(file.file)
        side = str(side)
        # Save to temporary file for extract_data
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            image.save(tmp.name, format="JPEG")
            tmp_path = tmp.name
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    try:
        data = extracter.extract_data(tmp_path, side)
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

    return data
