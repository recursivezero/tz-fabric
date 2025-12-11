from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS
from image_detection.logger import logThis

logger = logThis


class ExifHandler:
    def __init__(self):
        pass

    def add_exif_data(self, image_path, unique_id):
        image = Image.open(image_path)
        exif_data = image.getexif()

        # Store unique ID in ImageUniqueID tag (0xA420)
        exif_data[0xA420] = unique_id

        # Save with EXIF metadata
        image.save(image_path, exif=exif_data)

    def get_exif_unique_id(self, image):
        """Extracts ImageUniqueID from EXIF data if available."""
        try:
            image = Image.open(image)
            exif_data = image.getexif()
            unique_id = exif_data.get(0xA420, None)  # 0xA420 is ImageUniqueID
            if (
                unique_id
                and isinstance(unique_id, str)
                and unique_id.startswith("TZP-")
            ):
                return unique_id
        except Exception as e:
            print(f"Error reading EXIF: {e}")
        return None

    def get_gps_data(self, exif_data):
        """Extract and format GPS data from EXIF."""
        try:
            gps_data = {}
            for tag_id, value in exif_data.items():
                tag_name = TAGS.get(tag_id, tag_id)
                if tag_name == "GPSInfo":
                    for gps_tag_id in value:
                        gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                        gps_data[gps_tag] = value[gps_tag_id]
            return gps_data
        except Exception as e:
            logger.error(f"Error extracting GPS data: {str(e)}")
            return None
