import hashlib
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Type
from urllib.parse import urlparse

import lancedb
import pandas as pd
from image_search.schema import Fabric
from utils.aws_helper import generate_cdn_url, s3_client as s3
from constants import ALLOWED_EXTENSIONS
from utils.messages import TABLE_MESSAGES

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s]: %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def validate_file_path(file_path: str) -> bool:
    """Validate that the file path is a local file or an HTTP/HTTPS URL.

    Args:
        file_path (str): The file path to validate.

    Returns:
        bool: True if the file path is valid, False otherwise.
    """
    if file_path.startswith(("http://", "https://")):
        return True
    if Path(file_path).exists():
        return True
    return False


def get_file_info(image_path: str) -> Optional[Dict[Any, Any]]:
    """Compute the SHA256 hash and modification time of an image.

    Args:
        image_path (str): The path to the image file.

    Returns:
        Optional[Dict[Any, Any]]: A dictionary containing the hash and modification time,
                                  or None if the file cannot be processed.
    """
    if not validate_file_path(image_path):
        logger.warning(
            TABLE_MESSAGES.warnings.invalid_file_path.format(path=image_path)
        )
        return None

    hasher = hashlib.sha256()
    path = Path(image_path)

    try:
        with path.open("rb") as f:
            while chunk := f.read(8192):
                hasher.update(chunk)

        mtime = path.stat().st_mtime
        return {"hash": hasher.hexdigest(), "mtime": mtime}
    except Exception as e:
        logger.error(
            TABLE_MESSAGES.errors.file_processing.format(path=image_path, error=str(e))
        )
        return None


ALLOWED_ROOTS = {"stock", "fabric", "design", "product"}


def collect_image_data(root_folder: str) -> list:
    """Collect image info from local or S3, supports nested folders."""
    image_data = []

    if root_folder.startswith("s3://"):
        parsed = urlparse(root_folder)
        print(f"Parsed S3 URI: {parsed}")
        bucket_name = parsed.netloc
        base_prefix = parsed.path.lstrip("/")

        if not base_prefix.endswith("/"):
            base_prefix += "/"

        paginator = s3.get_paginator("list_objects_v2")

        for category in ALLOWED_ROOTS:
            prefix = f"{base_prefix}{category}/"

            for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
                for obj in page.get("Contents", []):
                    key = obj["Key"]

                    if key.lower().endswith(tuple(ALLOWED_EXTENSIONS)):
                        image_data.append(
                            {
                                "image_uri": generate_cdn_url(key),
                                "tag": category,
                                "hash": obj["ETag"].strip('"'),
                                "mtime": obj["LastModified"].timestamp(),
                            }
                        )

    else:
        root_path = Path(root_folder).expanduser()
        root_name = root_path.name

        if root_name not in ALLOWED_ROOTS:
            raise ValueError(f"Invalid root folder: {root_name}")

        for ext in ALLOWED_EXTENSIONS:
            for img_path in root_path.rglob(f"*.{ext}"):
                file_info = get_file_info(str(img_path))
                if file_info:
                    image_data.append(
                        {
                            "image_uri": str(img_path),
                            "hash": file_info["hash"],
                            "mtime": file_info["mtime"],
                        }
                    )

    return image_data


def deduplicate_table_by_hash(table):
    """Remove duplicate entries in the table based on the 'hash' column.
    Keep the entry with the most recent modification time.

    Args:
        table: The LanceDB table to deduplicate.
    """
    logger.info(TABLE_MESSAGES.info.checking_duplicates)
    df = table.to_pandas()

    if "hash" not in df.columns or "mtime" not in df.columns:
        logger.error(TABLE_MESSAGES.errors.missing_columns)
        return

    # For each hash, keep only the row with the most recent mtime
    duplicates = df[df.duplicated(subset="hash", keep=False)]
    if duplicates.empty:
        logger.info(TABLE_MESSAGES.info.no_duplicates)
        return

    # Group by hash and find entries to remove
    for hash_value in duplicates["hash"].unique():
        hash_group = df[df["hash"] == hash_value].sort_values("mtime", ascending=False)
        if len(hash_group) > 1:
            # Keep the most recent entry, delete others
            entries_to_remove = hash_group.iloc[1:]
            for _, row in entries_to_remove.iterrows():
                table.delete(
                    f"hash == '{row['hash']}' and image_uri == '{row['image_uri']}'"
                )
                logger.info(
                    TABLE_MESSAGES.info.removed_duplicate.format(uri=row["image_uri"])
                )
    logger.info(TABLE_MESSAGES.info.duplicates_removed)


def create_table(db, table_name: str, schema: Type[Fabric], image_data: list):
    """Create a new table with the given image data.

    Args:
        db: The LanceDB database connection.
        table_name (str): The name of the table to create.
        schema (Fabric): The schema to use for the table.
        image_data (list): A list of image metadata dictionaries.

    Returns:
        The created LanceDB table.
    """
    logger.info(TABLE_MESSAGES.info.creating_table.format(table_name=table_name))
    table = db.create_table(table_name, schema=schema, mode="overwrite")

    if image_data:
        logger.info(TABLE_MESSAGES.info.adding_images.format(count=len(image_data)))
        table.add(pd.DataFrame(image_data))
        df = table.to_pandas()

        # modify column
        df["image_uri"] = df["image_uri"].str.replace(r".*uploaded/", "", regex=True)

        # recreate table with vectors still inside df
        db.drop_table(table_name)

        table = db.create_table(
            table_name,
            data=df,
            schema=schema,
        )

        logger.info(TABLE_MESSAGES.info.images_added)
        deduplicate_table_by_hash(table)
    else:
        logger.warning(TABLE_MESSAGES.warnings.no_images_to_add)

    return table


def normalize_key(uri: str) -> str:
    if "uploaded/" in uri:
        return uri.split("uploaded/")[1]
    return uri


def update_existing_table(table, current_images: list):
    """Update an existing table with new or modified image data.

    Args:
        table: The LanceDB table to update.
        current_images (list): A list of image metadata dictionaries.
    """
    existing_data = table.to_pandas()

    # Convert current images to a DataFrame for easier comparison
    current_df = pd.DataFrame(current_images)

    # Find new or modified images
    new_or_modified = []
    for _, row in current_df.iterrows():
        row_key = normalize_key(row["image_uri"])

        existing_row = existing_data[
            existing_data["image_uri"].apply(normalize_key) == row_key
        ]

        if existing_row.empty or (
            not existing_row.empty and existing_row.iloc[0]["hash"] != row["hash"]
        ):
            new_or_modified.append(row.to_dict())
            if not existing_row.empty:
                # Delete the old entry if it exists
                table.delete(f"hash == '{row['hash']}'")

    # Add new or modified images
    if new_or_modified:
        table.add(pd.DataFrame(new_or_modified))
        logger.info(
            TABLE_MESSAGES.info.added_modified_images.format(count=len(new_or_modified))
        )

    # Remove entries for missing images
    current_uris = set(current_df["image_uri"].apply(normalize_key))
    existing_uris = set(existing_data["image_uri"].apply(normalize_key))

    missing_uris = existing_uris - current_uris

    if missing_uris:
        for uri in missing_uris:
            table.delete(f"image_uri == '{uri}'")
        logger.info(
            TABLE_MESSAGES.info.removed_missing_images.format(count=len(missing_uris))
        )

    deduplicate_table_by_hash(table)


def process_table(
    database: str,
    table_name: str,
    root_folder: str,
    schema: Type[Fabric],
    force: bool = False,
):
    """Process images and manage the database table.

    Args:
        database (str): The path to the LanceDB database.
        table_name (str): The name of the table to create or update.
        root_folder (str): The root folder containing images.
        schema (Fabric): The schema to use for the table.
        force (bool): If True, force recreation of the table.
    """
    logger.info(TABLE_MESSAGES.info.connecting)

    db = lancedb.connect(database)
    if not hasattr(db, "list_tables"):
        db.list_tables = db.table_names
    logger.info(TABLE_MESSAGES.info.available_tables.format(tables=db.list_tables()))
    logger.info(TABLE_MESSAGES.info.looking_for_table.format(table_name=table_name))
    logger.info(
        TABLE_MESSAGES.info.table_exists_check.format(
            exists=table_name in db.list_tables()
        )
    )

    if database.startswith("s3://"):
        logger.info(TABLE_MESSAGES.info.processing_s3)
    else:
        logger.info(TABLE_MESSAGES.info.processing_local)

    logger.info(TABLE_MESSAGES.info.scanning_directory.format(root_folder=root_folder))
    current_images = collect_image_data(root_folder)

    if not current_images:
        logger.error(TABLE_MESSAGES.errors.no_images_found)
        return

    logger.info(TABLE_MESSAGES.info.found_images.format(count=len(current_images)))

    # Check if table exists
    table_exists = table_name in db.table_names()
    logger.info(TABLE_MESSAGES.info.table_exists_status.format(exists=table_exists))

    if force:
        # Force create new table
        if table_exists:
            logger.info(
                TABLE_MESSAGES.info.dropping_table.format(table_name=table_name)
            )
            db.drop_table(table_name)
        table = create_table(db, table_name, schema, current_images)

    elif not table_exists:
        # Create new table if it doesn't exist
        logger.info(TABLE_MESSAGES.info.table_not_exists)
        table = create_table(db, table_name, schema, current_images)

    else:
        # Update existing table
        table = db.open_table(table_name)
        total_images = len(table)
        logger.info(
            TABLE_MESSAGES.info.total_images_in_table.format(count=total_images)
        )
        logger.info(TABLE_MESSAGES.info.updating_table.format(table_name=table_name))
        update_existing_table(table, current_images)

    # Show final table preview
    logger.info(TABLE_MESSAGES.info.final_preview)
    print(table.to_pandas())
