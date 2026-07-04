import base64
import io
from typing import Any

from PIL import Image


def convert_image_to_base64(image, max_side: int = 960, quality: int = 82) -> str:
    try:
        # Normalize and compress uploads before sending them to the vision model.
        # Large phone/downloaded images encoded as PNG were making analysis slow
        # and sometimes caused empty model responses. JPEG is enough for fabric
        # colour/pattern/texture inspection and is much faster to transmit.
        image = image.copy()
        try:
            from PIL import ImageOps

            image = ImageOps.exif_transpose(image)
        except Exception:
            pass

        if image.mode in ("RGBA", "LA"):
            background = Image.new("RGB", image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[-1])
            image = background
        else:
            image = image.convert("RGB")

        image.thumbnail((max_side, max_side))
        image_byte_arr = io.BytesIO()
        image.save(image_byte_arr, format="JPEG", quality=quality, optimize=True)
        img_byte_arr = image_byte_arr.getvalue()
        return base64.b64encode(img_byte_arr).decode()
    except Exception as e:
        print("Failed to convert image:", e)
        return ""


# return [] or list of strings
def parse_list(value: Any) -> list:
    parsed_list = []
    if value is None or value == [""] or value == [] or value == "" or value == "null":
        return []
    elif isinstance(value, str):
        parsed_list = [value]
    elif isinstance(value, list):
        parsed_list = list(filter(None, value))
    return parsed_list


def replace_with_multiple(lst, target, replacements):
    result = []
    for item in lst:
        if item == target:
            result.extend(replacements)
        else:
            result.append(item)
    return result
