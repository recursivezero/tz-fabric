from pathlib import Path
from typing import Dict, Optional, List
from pydantic import BaseModel, Field
import base64
import io
from google.genai import Client
from datetime import datetime
import sys
from PIL import Image
import numpy as np
from fastapi import HTTPException, UploadFile, requests
from image_detection.color_transformer import ColorTransformer

from image_detection.exif import ExifHandler
from image_detection.helper import (
    get_dominant_color,
    validate_fabric_count,
    validate_fabric_dimensions,
)
from image_detection.model_manager import ModelManager
from ultralytics import YOLO
from constants import (
    ALLOWED_EXTENSIONS,
    ENVIRONMENT,
    GENERATED_IMAGE_FOLDER,
    GROUP_IMAGE_FOLDER,
    SINGLE_IMAGE_FOLDER,
)
from image_detection.logger import logThis

sys.path.append(str(Path(__file__).resolve().parent.parent))


from werkzeug.utils import secure_filename


sys.path.append(str(Path(__file__).resolve().parent.parent))


# Pydantic models for better documentation
class PaginationResponse(BaseModel):
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Number of items per page")
    total_results: int = Field(..., description="Total number of results")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_prev: bool = Field(..., description="Whether there is a previous page")


class SearchResponse(BaseModel):
    results: List[str] = Field(
        ..., description="List of image paths matching the search"
    )
    pagination: PaginationResponse = Field(..., description="Pagination information")
    message: Optional[str] = Field(None, description="Success message for file uploads")


class CreateTableResponse(BaseModel):
    message: str = Field(..., description="Success message")


class UpdateTableResponse(BaseModel):
    message: str = Field(..., description="Success message")


class ErrorResponse(BaseModel):
    detail: str = Field(..., description="Error message")


# Description response
class FabricAnalysisResponse(BaseModel):
    name: Optional[str] = None
    success: bool
    analysis: Optional[str] = None
    error: Optional[str] = None
    analysis_type: str
    image_size: Optional[tuple] = None


# Fabric generator
class FabricDetection(BaseModel):
    x: float
    y: float
    width: float
    height: float


class ProcessingTimes(BaseModel):
    image_id: Optional[str] = None
    file_validation: float
    image_load: float
    model_inference: float
    crop_color_extraction: float
    color_generation: float
    total_time: float


class FabricProcessingResponse(BaseModel):
    image_id: Optional[str] = None
    success: bool
    message: str
    dominant_colors: List[str]
    generated_images: List[str]
    parent_folder: str
    uploaded_images: Optional[Dict[str, str]] = None


# Load the YOLO model
try:
    model_path = ModelManager().get_model_path("best.pt")
    logThis.info(f"Model path resolved: {model_path}")

    model = YOLO(model_path)
    logThis.info("YOLO model loaded successfully")


except Exception as e:
    logThis.error(f"❌ Failed to load YOLO model: {e}")


exif_handle = ExifHandler()
color_transformer = ColorTransformer()


def validate_uploaded_files(single_image: UploadFile, group_image: UploadFile):
    """Validate uploaded files for format and EXIF uniqueness."""
    # Check file extensions
    if not single_image.filename or not group_image.filename:
        raise HTTPException(
            status_code=400, detail="No filename provided for one or both files."
        )

    single_ext = single_image.filename.split(".")[-1].lower()
    group_ext = group_image.filename.split(".")[-1].lower()

    if single_ext not in ALLOWED_EXTENSIONS or group_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file format. Allowed formats: {list(ALLOWED_EXTENSIONS)}",
        )

    # Check EXIF uniqueness
    single_image.file.seek(0)
    group_image.file.seek(0)

    if exif_handle.get_exif_unique_id(single_image.file):
        raise HTTPException(
            status_code=400, detail="Single image already exists in inventory"
        )

    if exif_handle.get_exif_unique_id(group_image.file):
        raise HTTPException(
            status_code=400, detail="Group image already exists in inventory"
        )


def validate_fabric_images(
    single_image_array: np.ndarray, group_image_array: np.ndarray
):
    """Validate fabric dimensions and counts."""

    # Validate single image dimensions
    is_valid_single, single_message = validate_fabric_dimensions(
        single_image_array, model
    )
    if not is_valid_single:
        raise HTTPException(
            status_code=400, detail=single_message or "Invalid single fabric image"
        )

    # Validate single image fabric count (should be 1-3 fabrics)
    is_single_fabric, single_fabric_message = validate_fabric_count(
        single_image_array, model, max_fabrics=3, mode="single"
    )
    if not is_single_fabric:
        raise HTTPException(status_code=400, detail=single_fabric_message)

    # Validate group image fabric count (should have multiple fabrics)
    is_group_fabric, group_fabric_message = validate_fabric_count(
        group_image_array, model, max_fabrics=1, mode="group"
    )
    if not is_group_fabric:
        raise HTTPException(status_code=400, detail=group_fabric_message)


def save_and_process_images(single_image: UploadFile, group_image: UploadFile):
    """Save images and return PIL Image objects."""
    if not single_image.filename or not group_image.filename:
        raise HTTPException(
            status_code=400, detail="No filename provided for one or both files."
        )
    single_image.file.seek(0)
    group_image.file.seek(0)

    if ENVIRONMENT == "development":
        # Save locally for development
        single_image_path = Path(SINGLE_IMAGE_FOLDER) / secure_filename(
            single_image.filename
        )
        group_image_path = Path(GROUP_IMAGE_FOLDER) / secure_filename(
            group_image.filename
        )

        single_image_path.parent.mkdir(parents=True, exist_ok=True)
        group_image_path.parent.mkdir(parents=True, exist_ok=True)

        with single_image_path.open("wb") as f:
            f.write(single_image.file.read())

        with group_image_path.open("wb") as f:
            f.write(group_image.file.read())

        group_img = Image.open(group_image_path)
        single_img = Image.open(single_image_path)

    else:
        pass
        """
        # Upload to S3 for production
        single_s3_key = f"{SINGLE_IMAGE_FOLDER}{secure_filename(single_image.filename)}"
        group_s3_key = f"{GROUP_IMAGE_FOLDER}{secure_filename(group_image.filename)}"

        single_image.file.seek(0)
        group_image.file.seek(0)

        upload_success_1 = upload_file_to_s3(single_image.file, single_s3_key)
        upload_success_2 = upload_file_to_s3(group_image.file, group_s3_key)

        if not (upload_success_1 and upload_success_2):
            raise HTTPException(status_code=500, detail="Failed to upload images to S3")

        # Download group image from S3 for processing
        file_url = generate_presigned_url(group_s3_key)
        if not file_url:
            raise HTTPException(status_code=500, detail="Failed to generate access URL")

        response = requests.get(file_url, timeout=30)
        response.raise_for_status()

        group_img = Image.open(io.BytesIO(response.content))

        # For single image, read from the uploaded file
        single_image.file.seek(0)
        single_img = Image.open(single_image.file)
        """

    return single_img, group_img


def detect_fabrics_and_extract_colors(group_img: Image.Image):
    """Run YOLO detection and extract dominant colors."""

    group_array = np.array(group_img)

    # Run model inference
    results = model(group_array)[0]

    # Extract crops and dominant colors
    crops = []
    colors = []
    predictions = []

    for i, box in enumerate(results.boxes):
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        # Crop detected object
        cropped_img = group_img.crop((x1, y1, x2, y2))
        crops.append(cropped_img)

        # Get dominant color
        dominant_color = get_dominant_color(np.array(cropped_img))

        # Convert color tuple to string format for JSON serialization
        if isinstance(dominant_color, tuple):
            color_str = (
                f"rgb({dominant_color[0]},{dominant_color[1]},{dominant_color[2]})"
            )
        else:
            color_str = str(dominant_color)

        colors.append(color_str)

        # Store prediction data
        predictions.append(
            {
                "x": (x1 + x2) / 2,
                "y": (y1 + y2) / 2,
                "width": x2 - x1,
                "height": y2 - y1,
            }
        )

    return colors, predictions, crops


def generate_color_variations_api(
    single_img: Image.Image,
    dominant_colors: List[str],
    mode: str = "Fabric Mask (Smooth Blend)",
):
    """Generate color variations based on detected dominant colors."""

    original_img_name_without_ext = Path(single_img.filename).stem
    # Create timestamp folder
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if ENVIRONMENT == "development":
        output_folder = Path(GENERATED_IMAGE_FOLDER) / timestamp
        output_folder = output_folder.resolve()
        output_folder.mkdir(parents=True, exist_ok=True)
    else:
        output_folder = Path(GENERATED_IMAGE_FOLDER) / timestamp

    # Convert to numpy array
    image_np = np.array(single_img)
    output_paths = []

    # Generate variations for each dominant color
    for idx, color_str in enumerate(dominant_colors):
        # Convert color string back to tuple for processing
        # Extract RGB values from "rgb(214,211,204)" format
        if color_str.startswith("rgb(") and color_str.endswith(")"):
            rgb_values = color_str[4:-1].split(",")
            current_color = tuple(int(val.strip()) for val in rgb_values)
        else:
            # Fallback: try to parse as tuple string or use as-is
            try:
                current_color = (
                    eval(color_str) if isinstance(color_str, str) else color_str
                )
            except:  # noqa: E722
                current_color = (128, 128, 128)  # Default gray if parsing fails

        # Process the image based on mode
        if mode == "Fabric Mask (Smooth Blend)":
            generated_image_np, _ = color_transformer.transform_color(
                image_np, current_color
            )
        elif mode == "Hue Shift (HSV)":
            generated_image_np = color_transformer.change_hue(image_np, current_color)
        else:
            generated_image_np, _ = color_transformer.transform_color(
                image_np, current_color
            )

        # Save the generated image

        image_name_without_ext = f"{original_img_name_without_ext}_{idx}_{timestamp}"

        output_filename = color_transformer.save_image(
            generated_image_np, image_name_without_ext, output_folder, timestamp
        )

        if ENVIRONMENT == "development":
            output_path = str(Path(output_folder) / output_filename)
        else:
            output_path = f"{output_folder}{output_filename}"

        output_paths.append(output_path)

        logThis.info(f"Generated color variation {idx + 1} with color {current_color}")

    return output_paths, timestamp
