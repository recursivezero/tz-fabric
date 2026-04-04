import base64
import io
from typing import Any


def convert_image_to_base64(image) -> str:
    try:
        image_byte_arr = io.BytesIO()
        image.save(image_byte_arr, format="PNG")
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
