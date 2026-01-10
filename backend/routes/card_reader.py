import re
from unittest import result
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
from services.pan_extracter import PANCardExtractor

router = APIRouter()

extracter = PANCardExtractor()


@router.post("/pan")
async def read_card(file: UploadFile = File(...)):
    try:
        image = Image.open(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    data = extracter.extract_data(image)

    return data
