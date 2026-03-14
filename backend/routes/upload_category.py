from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from enum import Enum
from constants import IS_PROD
from utils.aws_helper import upload_file
import uuid
import os

router = APIRouter()


class Category(str, Enum):
    stocks = "stock"
    fabrics = "fabric"
    design = "design"
    single = "single"
    group = "group"


@router.post("/upload-image")
async def upload_image(category: Category = Form(...), image: UploadFile = File(...)):
    if not IS_PROD:
        raise HTTPException(
            status_code=403, detail="Uploads allowed only in production"
        )

    ext = os.path.splitext(image.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"

    image_key = f"uploaded/{category.value}/{filename}"

    upload_file(image.file, image_key)

    return {"success": True, "category": category, "image_key": image_key}
