import re
from unittest import result
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException
from PIL import Image
import easyocr

router = APIRouter()

# EasyOCR reader
reader = easyocr.Reader(["en","hi"], gpu=False)

PAN_REGEX = r"[A-Z]{5}[0-9]{4}[A-Z]"
AADHAAR_REGEX = r"\d{12}"
DOB_REGEX = r"\b\d{2}[/-]\d{2}[/-]\d{4}\b"
NAME_REGEX = r"[A-Z]{3,}(?:\s[A-Z]{3,})+"


def extract_text(image: Image.Image) -> str:
    """
    EasyOCR-based text extraction
    """
    img = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    results = reader.readtext(img, detail=0, paragraph=True)
    print(results)
    return " ".join(results)


def normalize(text: str) -> str:
    return re.sub(r"\s+", "", text.upper())


def parse_pan(text: str):
    match = re.search(PAN_REGEX, normalize(text))
    return match.group() if match else None


def parse_aadhaar(text: str):
    match = re.search(AADHAAR_REGEX, normalize(text))
    return match.group() if match else None


def parse_dob(text: str):
    match = re.search(DOB_REGEX, text)
    return match.group() if match else None


def parse_name(text: str):
    match = re.search(NAME_REGEX, text.upper())
    return match.group() if match else None


@router.post("/read-card")
async def read_card(file: UploadFile = File(...)):
    try:
        image = Image.open(file.file).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    text = extract_text(image)

    pan = parse_pan(text)
    aadhaar = parse_aadhaar(text)

    return {
        "type": "PAN" if pan else "AADHAAR" if aadhaar else "UNKNOWN",
        "id_number": pan or aadhaar,
        "name": parse_name(text),
        "dob": parse_dob(text),
        "raw_text": text,
    }
