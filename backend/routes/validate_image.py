from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse
from utils.gemini_client import gemini_vision_check
from utils.validate_image_base64 import convert_image_to_base64_for_validation

router = APIRouter()

VALIDATION_PROMPT = """
You are a visual validator for fabric analysis.

Accept only if:
- Fabric texture, weave, or material is clearly visible and fills the image.
- The image shows a close-up or crop of fabric only — not a full product.

Reject and respond with exactly:
Invalid image: [reason]

Reject if the image contains:
- Human faces, hands, or any body part
- Clothing being worn or on mannequins
- Shoes, bags, curtains with rods, or any full object
- Backgrounds, furniture, rooms, scenes
- Fabric that is too blurry or distant to inspect texture

### Rules:
- Respond with exactly: Valid fabric image OR Invalid image: [reason]
- No extra text or explanation.
"""


@router.post("/validate-image")
async def validate_image(image: UploadFile = File(...)):
    try:
        # Read and convert to base64
        image_data = await image.read()
        base64_img = convert_image_to_base64_for_validation(image_data)

        response = gemini_vision_check(base64_img, VALIDATION_PROMPT)

        if "Invalid image" in response:
            return JSONResponse(content={"valid": False})

        return JSONResponse(content={"valid": True})

    except Exception as e:
        print("Validation error:", e)
        return JSONResponse(status_code=500, content={"valid": False, "error": str(e)})
