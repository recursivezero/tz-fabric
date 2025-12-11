import io
import tempfile
import uuid
from pathlib import Path

import cv2
import numpy as np
from image_detection.exif import ExifHandler

UPLOAD_SUCCESS_S3 = "S3 upload✅"
ENVIRONMENT = "development"
GENERATED_IMAGE_EXTENSION = "webp"
from image_detection.oklch import (
    oklch_to_rgb,
    rgb_to_oklch,
)


class ColorTransformer:
    def __init__(self):
        self.color_intensity = 1.1  # Slightly boost color to compensate for blending
        self.texture_preserve = 0.2  # How much original texture to preserve
        self.edge_width = 3  # Edge transition width
        self.detail_boost = 1.05  # Subtle enhancement of details
        self.exif_handler = ExifHandler()

    def color_segment(self, image):
        """Segment fabric by color using k-means clustering with fixed 2 clusters"""
        # Reshape the image
        pixels = image.reshape((-1, 3))
        pixels = np.float32(pixels)

        # Define criteria and apply k-means with exactly 2 clusters
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(
            pixels, 2, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS
        )

        # Convert back to uint8
        centers = np.uint8(centers)
        segmented_image = centers[labels.flatten()]
        segmented_image = segmented_image.reshape(image.shape)

        # Create masks for both clusters
        mask0 = (labels == 0).reshape(image.shape[0], image.shape[1]).astype(
            np.uint8
        ) * 255
        mask1 = (labels == 1).reshape(image.shape[0], image.shape[1]).astype(
            np.uint8
        ) * 255

        # Determine which cluster is likely the fabric (the one with larger area)
        if np.sum(mask0) > np.sum(mask1):
            fabric_mask = mask0
            _ = 0
        else:
            fabric_mask = mask1
            _ = 1

        return fabric_mask

    def extract_texture_detail(self, image):
        """Extract fine texture details from the image using edge-preserving filter"""
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)

        # Apply bilateral filter to smooth while preserving edges
        smooth = cv2.bilateralFilter(gray, 9, 75, 75)

        # Detail layer is the difference between original and smoothed
        detail = gray.astype(np.float32) - smooth.astype(np.float32)

        # Normalize to 0-1 range centered at 0.5
        detail = detail * self.detail_boost  # Enhance details slightly
        detail = detail + 0.5
        detail = np.clip(detail, 0, 1)

        return detail

    def compute_edge_mask(self, image, mask):
        """
        Create a perceptually-balanced soft mask with smooth edge transitions.

        Parameters:
        - image: Unused but kept for potential future use (e.g., edge detection).
        - mask: Binary mask (uint8), where 255 = region of interest, 0 = background.

        Returns:
        - final_mask: Float32 mask in range [0, 1], with soft edges.
        """

        # Step 1: Compute boundaries using morphological operations
        kernel = np.ones((self.edge_width, self.edge_width), np.uint8)
        dilated = cv2.dilate(mask, kernel, iterations=1)
        eroded = cv2.erode(mask, kernel, iterations=1)
        boundary = cv2.subtract(dilated, eroded)

        # Step 2: Compute distance transforms (interior and exterior)
        dist_exterior = cv2.distanceTransform(255 - mask, cv2.DIST_L2, 5)
        dist_interior = cv2.distanceTransform(mask, cv2.DIST_L2, 5)

        # Step 3: Normalize distance maps
        max_dist = max(np.max(dist_exterior), np.max(dist_interior))
        if max_dist > 0:
            dist_exterior = dist_exterior / max_dist
            dist_interior = dist_interior / max_dist

        # Step 4: Create transition weights
        ext_weight = 1.0 - 1.0 / (1.0 + np.exp(-8 * (dist_exterior - 0.2)))
        int_weight = np.ones_like(dist_interior)

        # Step 5: Blend interior and exterior weights
        mask_float = mask.astype(np.float32) / 255.0
        final_mask = mask_float * int_weight + (1.0 - mask_float) * ext_weight

        # Ensure we only keep smooth transitions on the mask edge
        final_mask = np.minimum(final_mask, mask_float)

        # ✅ Step 6: Enhance edges using the boundary mask
        normalized_boundary = boundary.astype(np.float32) / 255.0
        boundary_influence = 0.3  # adjust strength of edge transition
        final_mask = np.clip(
            final_mask + boundary_influence * normalized_boundary, 0.0, 1.0
        )

        return final_mask

    def transform_color(self, image, target_color):
        """Transform regions to target color with natural-looking OKLCH transformation"""
        image_float = image.astype(np.float32) / 255.0
        target_rgb = np.array(target_color).astype(np.float32) / 255.0
        fabric_mask = self.color_segment(image)
        # Check if any area was detected
        if np.sum(fabric_mask) == 0:
            return image, fabric_mask

        mask_bool = fabric_mask > 0

        # Extract texture detail to preserve
        texture_detail = self.extract_texture_detail(image)

        # Convert to OKLCH colorspace
        flat_rgb = image_float.reshape(-1, 3)
        oklch_image = rgb_to_oklch(flat_rgb).reshape(image.shape)
        target_oklch = rgb_to_oklch(target_rgb)

        # Create a new array for the result
        result_oklch = oklch_image.copy()

        # Calculate average lightness of the target area
        avg_lightness = np.mean(oklch_image[mask_bool, 0])
        target_lightness = target_oklch[0]

        # Adjust lightness scaling based on the difference
        lightness_scale = target_lightness / avg_lightness if avg_lightness > 0 else 1.0

        # Apply transformation with texture preservation

        # Transform lightness while preserving texture variations
        texture_expanded = np.expand_dims(texture_detail, axis=2)
        texture_influence = self.texture_preserve * (texture_expanded - 0.5) * 2.0

        # Apply lightness with texture modulation
        base_lightness = oklch_image[mask_bool, 0] * lightness_scale
        result_oklch[mask_bool, 0] = np.clip(
            (1 - texture_influence[mask_bool, 0]) * target_oklch[0]
            + texture_influence[mask_bool, 0] * base_lightness,
            0.01,
            1.0,
        )

        # Apply chroma and hue exactly from target color
        result_oklch[mask_bool, 1] = target_oklch[1] * self.color_intensity
        result_oklch[mask_bool, 2] = target_oklch[2]

        # Convert back to RGB
        rgb_result = oklch_to_rgb(result_oklch.reshape(-1, 3)).reshape(image.shape)
        rgb_result = np.clip(rgb_result, 0, 1)

        # Create natural edge-aware mask
        edge_mask = self.compute_edge_mask(image, fabric_mask)
        edge_mask = np.expand_dims(edge_mask, axis=2)

        # Blend the result
        blended = rgb_result * edge_mask + image_float * (1 - edge_mask)

        return (blended * 255).astype(np.uint8), fabric_mask

    def find_dominant_color(self, image):
        # Image is already in BGR format from OpenCV
        height, width, _ = np.shape(image)
        data = np.reshape(image, (height * width, 3))
        data = np.float32(data)
        number_clusters = 15
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        flags = cv2.KMEANS_RANDOM_CENTERS
        _, _, centers = cv2.kmeans(data, number_clusters, None, criteria, 10, flags)
        return centers[0]  # This is in BGR format

    def change_hue(self, image, target_color):
        # Ensure consistent color format - convert everything to OpenCV's HSV
        img_hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

        # Find dominant color in BGR
        dominant_color = self.find_dominant_color(image)

        # Convert dominant color to HSV using OpenCV
        dominant_color_hsv = cv2.cvtColor(
            np.uint8([[dominant_color]]), cv2.COLOR_BGR2HSV
        )[0][0]

        # Convert target color to HSV using OpenCV (assuming target_color is BGR)
        target_color_hsv = cv2.cvtColor(np.uint8([[target_color]]), cv2.COLOR_BGR2HSV)[
            0
        ][0]

        # Calculate hue shift in OpenCV's range (0-179)
        hue_difference = (target_color_hsv[0] - dominant_color_hsv[0]) % 180

        # Apply the hue shift
        img_hsv[:, :, 0] = (img_hsv[:, :, 0] + hue_difference) % 180

        # Convert back to BGR
        result = cv2.cvtColor(img_hsv, cv2.COLOR_HSV2BGR)

        return result

    def save_image(self, image_np, image_name, image_folder, timestamp):
        generated_filename = (
            f"{image_name}_{timestamp}.{GENERATED_IMAGE_EXTENSION}".replace(
                " ", "_"
            ).lower()
        )
        unique_id = f"TZP-{uuid.uuid4().hex[:4].upper()}"
        if isinstance(image_np, tuple):
            image_np = image_np[0]

        # Convert to uint8 (assuming already normalized or in correct dtype)
        image_uint8 = image_np.astype(np.uint8)

        if ENVIRONMENT == "development":
            # Save locally
            output_path = Path(image_folder) / generated_filename
            cv2.imwrite(output_path, cv2.cvtColor(image_uint8, cv2.COLOR_RGB2BGR))

            # Add EXIF data
            self.exif_handler.add_exif_data(output_path, unique_id)
        else:  # production S3
            # Use a temporary file to apply EXIF data
            with tempfile.NamedTemporaryFile(
                suffix=f".{GENERATED_IMAGE_EXTENSION}", delete=False
            ) as tmp:
                temp_path = tmp.name
                cv2.imwrite(temp_path, cv2.cvtColor(image_uint8, cv2.COLOR_RGB2BGR))

            # Apply EXIF using your existing handler
            self.exif_handler.add_exif_data(temp_path, unique_id)

            # Read final image with EXIF back into memory
            with open(temp_path, "rb") as f:
                image_bytes = io.BytesIO(f.read())

            # Upload to S3
            """
            s3_key = f"{image_folder}/{generated_filename}"
            success = upload_file_to_s3(image_bytes, s3_key)
            if success:
                logThis.info(UPLOAD_SUCCESS_S3, extra={"color": "green"})

            # Clean up temp file
            Path(temp_path).unlink()
            """
        return generated_filename
