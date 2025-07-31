from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from services.threaded import analyse_all_variations
from PIL import Image
from io import BytesIO

router = APIRouter()

@router.post("/analyse")
async def analyse(
    image: UploadFile = File(...),
    analysis_type: str = Form(...)
):
    try:
        print("📁 Filename:", image.filename)
        print("📦 Content type:", image.content_type)

        contents = await image.read()

        image_stream = BytesIO(contents)
        image_stream.seek(0)
        img = Image.open(image_stream)

        print("Image validated as fabric. Starting analysis...")
        response = analyse_all_variations(img, analysis_type)
        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
