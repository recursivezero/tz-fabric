import time

from fastapi import APIRouter, HTTPException, Request
from routes.routes_helper import (
    CreateTableResponse,
    UpdateTableResponse,
    table_exists,
)
from image_search.db.create_table import process_table
from image_search.schema import Fabric
from constants import (
    DATABASE_PATH,
    RELATIVE_GENERATED_FOLDER,
    TABLE_NAME,
)
from utils.logger import logThis



router = APIRouter(
    prefix="/database",
)


@router.put("/create/table", response_model=CreateTableResponse)
async def create_table(request: Request):
    """
    Create a new database table with all images from the configured folder.
    Rate limited to 2 requests per hour per IP.
    """
    try:
        start_time = time.time()

        process_table(
            database=DATABASE_PATH,
            table_name=TABLE_NAME,
            root_folder=RELATIVE_GENERATED_FOLDER,
            schema=Fabric,
            force=True,
        )

        create_time = time.time() - start_time
        logThis.info(
            f"Table creation operation took {create_time:.4f} seconds",
            extra={"color": "green"},
        )

        return CreateTableResponse(message="Table created successfully.")
    except Exception as e:
        logThis.error(f"Table creation failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create the table: {str(e)}"
        )


@router.put("/update/table", response_model=UpdateTableResponse)
async def update_table(request: Request):
    """
    Update an existing database table with new images from the configured folder.
    Rate limited to 5 requests per hour per IP.
    """
    if not table_exists(DATABASE_PATH, TABLE_NAME):
        raise HTTPException(
            status_code=404,
            detail="Table not present. Please create the table first using /api/database/create-table",
        )
    try:
        start_time = time.time()
        process_table(
            database=DATABASE_PATH,
            table_name=TABLE_NAME,
            root_folder=RELATIVE_GENERATED_FOLDER,
            schema=Fabric,
            force=False,
        )

        update_time = time.time() - start_time
        logThis.info(
            f"Table update operation took {update_time:.4f} seconds",
            extra={"color": "green"},
        )

        return UpdateTableResponse(message="Table updated successfully.")
    except Exception as e:
        logThis.error(f"Table update failed: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to update the table: {str(e)}"
        )
