import base64
import io

from PIL import Image


def convert_image_to_base64_for_validation(image_bytes: bytes) -> str:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_byte_arr = io.BytesIO()
        image.save(image_byte_arr, format="PNG")
        return base64.b64encode(image_byte_arr.getvalue()).decode("utf-8")
    except Exception as e:
        print("Failed to convert image:", e)
        return None
