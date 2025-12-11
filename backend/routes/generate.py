import uuid
from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from typing import Optional
from pathlib import Path
from PIL import Image
import numpy as np
import time

from routes.routes_helper import (
    FabricProcessingResponse,
    ProcessingTimes,
    detect_fabrics_and_extract_colors,
    generate_color_variations_api,
    save_and_process_images,
    validate_fabric_images,
    validate_uploaded_files,
)
from image_detection.logger import logThis


from constants import ALLOWED_EXTENSIONS
from utils.db_utils import (
    save_to_mongodb,
    fabric_collection,
    processing_times_collection,
)


router = APIRouter()


@router.post("/generate", response_model=FabricProcessingResponse)
async def process_fabric_images(
    request: Request,
    single_image: Optional[UploadFile] = File(None),
    group_image: Optional[UploadFile] = File(None),
    mode: Optional[str] = Form(None),
):
    """
    Single endpoint for fabric processing - supports both JSON (MCP) and form data (web uploads).

    For JSON requests (MCP): Send file paths for both images and mode in JSON body
    For form requests (web): Upload both files with mode as form parameter
    """

    start_time = time.time()
    processing_times: dict[str, float] = {}

    try:
        logThis.info("Starting fabric processing workflow", extra={"color": "green"})

        # Check if request is JSON (MCP tools)
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            # Parse JSON body for MCP requests
            body = await request.json()

            # Extract file paths
            single_image_path_raw = body.get("single_image_path")
            group_image_path_raw = body.get("group_image_path")

            if not single_image_path_raw or not group_image_path_raw:
                raise HTTPException(
                    status_code=400,
                    detail="Missing 'single_image_path' or 'group_image_path' in JSON body",
                )

            # Explicitly narrow the type for mypy
            single_image_path: str = single_image_path_raw
            group_image_path: str = group_image_path_raw

            # Validate and load images from file paths
            try:
                # Step 1: File validation (for consistency)
                validation_start = time.time()
                single_path = Path(single_image_path)
                group_path = Path(group_image_path)

                if not single_path.exists():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Single image not found: {single_image_path}",
                    )
                if not group_path.exists():
                    raise HTTPException(
                        status_code=400,
                        detail=f"Group image not found: {group_image_path}",
                    )

                # Validate image extensions
                if single_path.suffix.lower().lstrip(".") not in ALLOWED_EXTENSIONS:
                    raise HTTPException(
                        status_code=400,
                        detail="Single image must be a valid image file",
                    )
                if group_path.suffix.lower().lstrip(".") not in ALLOWED_EXTENSIONS:
                    raise HTTPException(
                        status_code=400, detail="Group image must be a valid image file"
                    )

                processing_times["file_validation"] = time.time() - validation_start

                # Step 2: Load images
                load_start = time.time()
                single_img = Image.open(single_path)
                group_img = Image.open(group_path)
                processing_times["image_load"] = time.time() - load_start

            except Exception as e:
                raise HTTPException(
                    status_code=400, detail=f"Error loading images: {str(e)}"
                )

        else:
            # Form data request (web upload)
            if not single_image or not group_image:
                raise HTTPException(
                    status_code=400,
                    detail="Both single_image and group_image files are required",
                )

            if not single_image.filename or not group_image.filename:
                raise HTTPException(
                    status_code=400, detail="Both files must have filenames"
                )
            assert isinstance(single_image.filename, str)
            assert isinstance(group_image.filename, str)

            single_uploaded_filename: str = single_image.filename
            group_uploaded_filename: str = group_image.filename

            mode = mode or "Fabric Mask (Smooth Blend)"

            # Step 1: Validate uploaded files
            validation_start = time.time()
            validate_uploaded_files(single_image, group_image)
            processing_times["file_validation"] = time.time() - validation_start

            # Step 2: Save and load images
            load_start = time.time()
            single_img, group_img = save_and_process_images(single_image, group_image)
            processing_times["image_load"] = time.time() - load_start

        # Validate mode
        valid_modes = ["Fabric Mask (Smooth Blend)", "Hue Shift (HSV)"]
        if mode not in valid_modes:
            raise HTTPException(
                status_code=400, detail=f"Mode must be one of: {valid_modes}"
            )

        # Convert to numpy arrays for validation (common for both request types)
        single_image_array = np.array(single_img.convert("RGB"))
        group_image_array = np.array(group_img.convert("RGB"))

        # Validate fabric images
        validate_fabric_images(single_image_array, group_image_array)

        # Step 3: Run detection and extract colors
        detection_start = time.time()
        dominant_colors, _, _ = detect_fabrics_and_extract_colors(group_img)
        processing_times["model_inference"] = time.time() - detection_start

        if not dominant_colors:
            raise HTTPException(
                status_code=400, detail="No fabrics detected in group image"
            )

        # Step 4: Extract crops and colors (already done above)
        crop_start = time.time()
        # Colors are already extracted in the detection step
        processing_times["crop_color_extraction"] = time.time() - crop_start

        # Step 5: Generate color variations
        generation_start = time.time()
        generated_paths, timestamp_folder = generate_color_variations_api(
            single_img, dominant_colors, mode
        )
        processing_times["color_generation"] = time.time() - generation_start

        total_time = time.time() - start_time
        processing_times["total_time"] = total_time

        logThis.info(
            f"Fabric processing completed successfully in {total_time:.4f} seconds",
            extra={"color": "green"},
        )
        if single_image:
            single_image_name = Path(single_uploaded_filename).name
        else:
            single_image_name = Path(single_image_path).name

        if group_image:
            group_image_name = Path(group_uploaded_filename).name
        else:
            group_image_name = Path(group_image_path).name

        image_id = uuid.uuid4().hex[:8]
        response = FabricProcessingResponse(
            success=True,
            message=f"Successfully processed images and generated {len(generated_paths)} color variations",
            image_id=image_id,
            uploaded_images={
                "single_image": single_image_name,
                "group_image": group_image_name,
            },
            dominant_colors=dominant_colors,
            generated_images=[
                Path(p).name for p in generated_paths
            ],  # Keep full paths for API response
            parent_folder=timestamp_folder,
        )

        # Convert response to dict for MongoDB
        data_to_store = response.model_dump()
        data_to_store.pop("message", None)
        data_to_store.pop("success", None)
        processing_doc = ProcessingTimes(
            image_id=image_id, **processing_times
        ).model_dump()

        try:
            save_to_mongodb(data_to_store, fabric_collection)
            save_to_mongodb(processing_doc, processing_times_collection)
            return response  # Return full paths as-is
        except Exception as e:
            print("MongoDB insert error:", e)

    except HTTPException:
        raise
    except Exception as e:
        logThis.error(f"Error in fabric processing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
