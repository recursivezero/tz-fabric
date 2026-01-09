import re
from unittest import result
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File,Form, HTTPException
from PIL import Image
from services.adhaar import AadhaarCardExtractor

router = APIRouter()

extracter=AadhaarCardExtractor()


@router.post("/adhaar_card")
async def read_card(file: UploadFile = File(...), side: str = Form(...)):
    try:
        image = Image.open(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    data = extracter.extract_data(image,side)


    return data
