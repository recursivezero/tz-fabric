import sys
from pathlib import Path
from typing import List, Optional

from constants import ALLOWED_EXTENSIONS
from pydantic import BaseModel, Field


sys.path.append(str(Path(__file__).resolve().parent.parent))
from image_search.db.connection import get_table


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


def table_exists(database_path: str, table_name: str) -> bool:
    """Check if the table exists in the database."""
    try:
        table = get_table(database_path, table_name)
        return table is not None
    except Exception:
        return False


