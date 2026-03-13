
from box import Box
TABLE_MESSAGES = Box(
    {
        "info": {
            "connecting": "Connecting to the database...",
            "scanning_directory": "Scanning directory: {root_folder}",
            "found_images": "Found {count} images in the root folder.",
            "table_not_exists": "Table doesn't exist.",
            "creating_table": "Creating new table '{table_name}'...",
            "adding_images": "Adding {count} images to the table.",
            "images_added": "Successfully added images to the table.",
            "checking_duplicates": "Checking for duplicates in the table...",
            "no_duplicates": "No duplicates found in the table.",
            "removed_duplicate": "Removed duplicate: {uri}",
            "duplicates_removed": "Successfully removed duplicate entries.",
            "added_modified_images": "Added {count} new or modified images.",
            "removed_missing_images": "Removed {count} missing images.",
            "dropping_table": "Force flag set. Dropping existing table '{table_name}'.",
            "updating_table": "Updating existing table '{table_name}'...",
            "final_preview": "Final table preview:",
            "available_tables": "Available tables: {tables}",
            "looking_for_table": "Looking for table: {table_name}",
            "table_exists_check": "Table exists check: {exists}",
            "processing_s3": "Processing with S3 storage...",
            "processing_local": "Processing with local storage...",
            "table_exists_status": "{exists}",
            "total_images_in_table": "Total {count} images in table",
        },
        "warnings": {
            "no_images_to_add": "No images found to add to the table.",
            "invalid_file_path": "Skipping invalid file path: {path}",
        },
        "errors": {
            "no_images_found": "No images found in the specified directory.",
            "missing_columns": "Required columns not found. Skipping deduplication.",
            "file_processing": "Error processing file {path}: {error}",
        },
    },
    frozen_box=True,
)