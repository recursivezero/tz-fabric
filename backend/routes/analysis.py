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
        result = analyse_all_variations(img, analysis_type)
        print("ANALYSIS RESULT:", result)

        return {
            "status": "partial",
            "cache_key": result["cache_key"],
            "response": result["first"]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
