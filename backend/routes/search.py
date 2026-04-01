import io
import time
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from PIL import Image
from routes.routes_helper import SearchResponse, sanitize
from image_search.db.connection import get_table, warm_up_table_model
from image_search.schema import Fabric
from image_search.vector_search import run_vector_search
from utils.aws_helper import generate_cdn_url, upload_file
from constants import (
    DATABASE_PATH,
    ENVIRONMENT,
    TABLE_NAME,
    UPLOAD_FOLDER_FABRIC,
)
from routes.routes_helper import allowed_file
from utils.logger import logThis
from utils.profanity import ProfanityError, filter_profanity_from_query
from werkzeug.utils import secure_filename


router = APIRouter(
    prefix="/search",
)


@router.post("", response_model=SearchResponse)
async def image_search(
    request: Request,
    file: Optional[UploadFile] = File(None),
    search_term: Optional[str] = Form(None),
    category: Optional[List[str]] = Form(None),
    limit: Optional[int] = Form(None),
    page: Optional[int] = Form(None),
    per_page: Optional[int] = Form(None),
):
    """
    Unified search endpoint.
    - Supports JSON requests (MCP tools)
    - Supports multipart form-data (file upload + search_term)

    Rate limited to 30 searches per minute per IP.
    """

    try:
        # Handle JSON vs Form
        content_type = request.headers.get("content-type", "")
        parsed_categories = category or []

        parsed_categories = sanitize(category)

        if "application/json" in content_type:
            body = await request.json()
            search_term = body.get("search_term")
            limit = body.get("limit", 5)
            page = body.get("page", 1)
            per_page = body.get("per_page", 10)
            file = body.get("file")
        else:
            # Normalize empty file from Swagger UI
            if file is not None and getattr(file, "filename", "") == "":
                file = None

            # Use form defaults
            limit = limit or 20
            page = page or 1
            per_page = per_page or 10

        # Ensure per_page is never None for arithmetic operations
        per_page = per_page or 10
        page = page or 1

        # Profanity filter
        if search_term:
            try:
                search_term = filter_profanity_from_query(search_term, mode="api")
            except ProfanityError as e:
                raise HTTPException(status_code=400, detail=str(e))

        # Validate pagination
        if per_page < 1 or per_page > 50:
            per_page = 10
        if page < 1:
            page = 1

        table = get_table(DATABASE_PATH, TABLE_NAME)
        warm_up_table_model(table)

        # IMAGE SEARCH
        if file and file.filename:
            if not allowed_file(file.filename):
                raise HTTPException(status_code=400, detail="Unsupported file type.")

            filename = secure_filename(file.filename)
            image_bytes = await file.read()
            image = Image.open(io.BytesIO(image_bytes))

            search_start = time.time()
            limit = limit or 20
            _, image_paths = run_vector_search(
                table, Fabric, image, limit=limit, category=parsed_categories
            )
            search_time = time.time() - search_start
            logThis.info(
                f"Vector search took {search_time:.4f}s", extra={"color": "green"}
            )

            # Pagination
            total_results = len(image_paths)
            total_pages: int = max(1, (total_results + per_page - 1) // per_page)
            if page is None:
                page = 1
            if page > total_pages:
                page = total_pages

            offset = (page - 1) * per_page
            paginated_results = image_paths[offset : offset + per_page]

            # Save file (local vs S3)
            if ENVIRONMENT == "development":
                file_path = Path(UPLOAD_FOLDER_FABRIC) / filename
                with file_path.open("wb") as f:
                    f.write(image_bytes)
                logThis.info(
                    f"File saved locally at {file_path}", extra={"color": "green"}
                )
            else:
                s3_key = f"uploaded/search/{filename}"
                await file.seek(0)
                upload_success = upload_file(await file.read(), s3_key)
                if upload_success:
                    file_url = generate_cdn_url(s3_key)
                    logThis.info(
                        f"File saved to S3 at {file_url}", extra={"color": "green"}
                    )

            return {
                "message": "File uploaded successfully after search",
                "results": paginated_results,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total_results": total_results,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_prev": page > 1,
                },
            }

        # TEXT SEARCH
        elif search_term:
            search_start = time.time()
            limit = limit or 20
            _, all_results = await run_vector_search(
                table, Fabric, search_term, limit=limit, category=parsed_categories
            )

            search_time = time.time() - search_start
            logThis.info(
                f"Text search took {search_time:.4f}s", extra={"color": "green"}
            )

            total_results = len(all_results)
            total_pages = max(1, (total_results + per_page - 1) // per_page)
            if page is None:
                page = 1
            if page > total_pages:
                page = total_pages

            offset = (page - 1) * per_page
            paginated_results = all_results[offset : offset + per_page]

            return {
                "message": "success",
                "results": paginated_results,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total_results": total_results,
                    "total_pages": total_pages,
                    "has_next": page < total_pages,
                    "has_prev": page > 1,
                },
            }

        # Invalid request
        else:
            raise HTTPException(status_code=400, detail="Missing search term or file.")

    except HTTPException:
        raise
    except Exception as e:
        logThis.error(f"Search failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
