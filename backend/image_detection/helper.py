import base64
from io import BytesIO
from typing import Any, Tuple

import numpy as np
import skimage
from PIL import Image
from sklearn.cluster import KMeans

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "avif", "bmp"}

# allowed_file helper function.


def allowed_file(filename):
    """Check if the file extension is allowed.

    Args:
        filename (str): The name of the file to check.

    Returns:
        bool: True if the file extension is allowed, False otherwise.
    """
    # Accept pathlib.Path / os.PathLike as well as str
    if filename is None:
        return False
    name = str(filename)
    return "." in name and name.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# streamlit_app.py(helper function)
def image_to_base64(image):
    buffered = BytesIO()
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()


"""
Fabric image validation utilities.

This module contains functions for validating fabric images based on 
pattern dimension consistency and spatial distribution.
"""


def validate_fabric_dimensions(img_array: np.ndarray, model: Any) -> Tuple[bool, str]:
    """
    Validates fabric images based on pattern dimension consistency.

    Args:
        img_array (np.ndarray): numpy array of the image
        model: detection model to identify fabric patterns

    Returns:
        tuple: (is_valid, message) where is_valid is boolean and message is string
    """
    # Run detection model with moderate confidence
    result = model(img_array, conf=0.7)[0]

    # Reject if no patterns detected
    if len(result.boxes) == 0:
        return False, "No fabric patterns detected"

    # Extract box dimensions
    box_widths = [box.xywh[0][2] for box in result.boxes]
    box_heights = [box.xywh[0][3] for box in result.boxes]
    box_areas = [w * h for w, h in zip(box_widths, box_heights)]
    aspect_ratios = [w / h if h > 0 else 0 for w, h in zip(box_widths, box_heights)]

    # Calculate variation metrics
    width_cv = (
        np.std(box_widths) / np.mean(box_widths) if np.mean(box_widths) > 0 else 0
    )
    height_cv = (
        np.std(box_heights) / np.mean(box_heights) if np.mean(box_heights) > 0 else 0
    )
    area_cv = np.std(box_areas) / np.mean(box_areas) if np.mean(box_areas) > 0 else 0
    aspect_cv = (
        np.std(aspect_ratios) / np.mean(aspect_ratios)
        if np.mean(aspect_ratios) > 0
        else 0
    )

    # Dimension consistency checks
    if width_cv > 0.3:
        return False, "Inconsistent pattern widths detected"

    if height_cv > 0.3:
        return False, "Inconsistent pattern heights detected"

    if area_cv > 0.4:
        return False, "Inconsistent pattern sizes detected"

    if aspect_cv > 0.25:
        return False, "Inconsistent pattern shapes detected"

    # Check for extreme aspect ratios
    for aspect in aspect_ratios:
        if aspect < 0.2 or aspect > 5:  # Very narrow or very wide patterns
            return False, "Invalid fabric pattern shape detected"

    # Calculate spatial distribution metrics
    center_x = [box.xywh[0][0] for box in result.boxes]
    center_y = [box.xywh[0][1] for box in result.boxes]

    # Check if patterns are well-distributed across the image
    if len(center_x) > 1:
        x_range = max(center_x) - min(center_x)
        y_range = max(center_y) - min(center_y)
        img_diag = np.sqrt(img_array.shape[0] ** 2 + img_array.shape[1] ** 2)
        spread_ratio = max(x_range, y_range) / img_diag

        # If detections are too clustered, likely not a repeating fabric pattern
        if spread_ratio < 0.2 and len(result.boxes) > 2:
            return False, "Pattern distribution not consistent with fabric"

    # Calculate coverage
    img_area = img_array.shape[0] * img_array.shape[1]
    coverage = sum(box_areas) / img_area

    # Accept if good coverage and dimensions are consistent
    if coverage > 0.25:
        return True, "Valid fabric pattern detected"

    # For low coverage, try with lower confidence threshold
    if coverage < 0.25:
        low_conf_result = model(img_array, conf=0.5)[0]
        if len(low_conf_result.boxes) >= 3:
            # Check dimensions consistency at lower confidence
            low_conf_areas = [
                box.xywh[0][2] * box.xywh[0][3] for box in low_conf_result.boxes
            ]
            low_conf_coverage = sum(low_conf_areas) / img_area

            if low_conf_coverage > 0.3:
                return True, "Valid fabric pattern detected"

    return False, "Insufficient fabric pattern coverage"


def validate_fabric_count(
    img_array: np.ndarray,
    model: Any,
    *,
    max_fabrics: int,
    mode: str,  # "single" or "group"
) -> Tuple[bool, str]:
    """
    Validates that the image contains the expected number of fabric patterns.

    Args:
        img_array (np.ndarray): Image as a numpy array.
        model (Any): Fabric detection model.
        max_fabrics (int): Max fabrics allowed for single mode.
        mode (str): Validation mode: "single" or "group".

    Returns:
        tuple: (is_valid, message)
    """
    result = model(img_array)[0]

    fabric_count = len(result.boxes)

    if mode == "single":
        if fabric_count >= max_fabrics:
            return (
                False,
                "This image contains multiple fabrics. Please upload a single fabric image.",
            )
        return True, "Single fabric detected"

    elif mode == "group":
        if fabric_count == 1:
            return (
                False,
                "This image contains a single fabric. Please upload a group fabric image.",
            )
        return True, "Group fabric detected"

    else:
        return False, f"Unknown validation mode: {mode}"


def get_dominant_color(image, k=5, central_weight=1.5):
    """
    Extracts the dominant color from an image using optimized K-Means clustering
    with improvements for bounding box crops.

    Args:
        image: PIL Image, numpy array, or path to image
        k: Number of clusters for k-means
        central_weight: Weight multiplier for central pixels

    Returns:
        tuple: (R, G, B) of the dominant color
    """
    # Ensure the image is a PIL Image, then convert to RGB
    if isinstance(image, str):
        image = Image.open(image).convert("RGB")
    elif isinstance(image, np.ndarray):
        image = Image.fromarray(image).convert("RGB")
    elif isinstance(image, Image.Image):
        image = image.convert("RGB")
    else:
        raise ValueError("Unsupported image type passed to get_dominant_color")

    # Skip resizing for very small images (< 5000 pixels)
    width, height = image.size
    if width * height > 5000:
        # Resize larger images for efficiency but maintain aspect ratio
        image = image.resize((100, 100), Image.Resampling.LANCZOS)

    # Convert to LAB color space for better perceptual representation
    # LAB is more aligned with human perception than RGB
    rgb_image = np.array(image)
    lab_image = skimage.color.rgb2lab(rgb_image)

    # Create a weighting mask that emphasizes central pixels
    y, x = np.ogrid[: lab_image.shape[0], : lab_image.shape[1]]
    center_y, center_x = lab_image.shape[0] // 2, lab_image.shape[1] // 2

    # Calculate distance from center (normalized)
    dist_from_center = np.sqrt((x - center_x) ** 2 + (y - center_y) ** 2)
    max_dist = np.sqrt(center_x**2 + center_y**2)
    normalized_dist = dist_from_center / max_dist

    # Create weight mask (higher weight for central pixels)
    weights = central_weight - normalized_dist * (central_weight - 1.0)

    # Flatten the image and weights
    pixels = lab_image.reshape(-1, 3)
    flat_weights = weights.flatten()

    # Apply K-Means clustering with sample weights
    # Adaptively choose k based on image size
    if width * height < 1000:
        k = min(k, 3)  # Use fewer clusters for very small images

    kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
    kmeans.fit(pixels, sample_weight=flat_weights)

    # Get cluster centers and sort by weighted frequency
    centers = kmeans.cluster_centers_
    labels = kmeans.labels_

    # Calculate weighted histogram
    weighted_counts = np.zeros(k)
    for i in range(k):
        mask = labels == i
        weighted_counts[i] = np.sum(flat_weights[mask])

    # Sort clusters by weighted frequency
    sorted_indices = np.argsort(-weighted_counts)

    # Check if brightest color among top 2 clusters should be chosen instead
    # (For cases where a bright object is smaller than background)
    if len(sorted_indices) >= 2:
        # Get top two clusters
        top1_idx = sorted_indices[0]
        top2_idx = sorted_indices[1]

        # Calculate luminance (L in LAB)
        l1 = centers[top1_idx][0]
        l2 = centers[top2_idx][0]

        # If second cluster is significantly brighter and not too small
        if l2 > l1 + 20 and weighted_counts[top2_idx] > weighted_counts[top1_idx] * 0.4:
            dominant_cluster = centers[top2_idx]
        else:
            dominant_cluster = centers[top1_idx]
    else:
        dominant_cluster = centers[sorted_indices[0]]

    # Convert back to RGB
    lab_color = np.array([dominant_cluster])
    rgb_color = skimage.color.lab2rgb(lab_color)[0]

    # Return as integer RGB tuple
    return tuple(map(int, rgb_color * 255))  # Convert to integer RGB values
