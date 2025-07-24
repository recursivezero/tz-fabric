import base64
import io

def convert_image_to_base64(image) -> str:
    try:
        image_byte_arr = io.BytesIO()
        image.save(image_byte_arr, format="PNG")
        img_byte_arr = image_byte_arr.getvalue()
        return base64.b64encode(img_byte_arr).decode()
    except Exception as e:
        print("Failed to convert image:", e)