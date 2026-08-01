"""Secure, read-only administrator endpoints for LanceDB inspection."""

from collections.abc import Callable
from typing import TypeVar

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    Response,
    Security,
    status,
)

from auth.admin_guard import verify_admin_access
from models.admin_lancedb import (
    LanceAdminAccessResponse,
    LanceRowDetailResponse,
    LanceRowsResponse,
    LanceTableDetailsResponse,
    LanceTablesResponse,
    SortColumn,
    SortOrder,
)
from services.lancedb_admin_service import (
    LanceDBAdminError,
    LanceDBAdminService,
    LanceDBRowNotFound,
    LanceDBTableNotFound,
    LanceDBUnavailable,
    LanceDBValidationError,
)
from utils.logger import logThis

_OperationResult = TypeVar("_OperationResult")


def _disable_admin_caching(response: Response) -> None:
    """Keep private database inspection responses out of shared caches."""

    response.headers["Cache-Control"] = "no-store, max-age=0"
    response.headers["Pragma"] = "no-cache"


router = APIRouter(
    prefix="/admin/lancedb",
    tags=["Admin"],
    dependencies=[
        Security(verify_admin_access),
        Depends(_disable_admin_caching),
    ],
)


def get_lancedb_admin_service() -> LanceDBAdminService:
    return LanceDBAdminService()


def _run_admin_operation(
    operation: Callable[[], _OperationResult],
) -> _OperationResult:
    try:
        return operation()
    except LanceDBValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    except (LanceDBTableNotFound, LanceDBRowNotFound) as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except LanceDBUnavailable as error:
        logThis.error("LanceDB administrator operation failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to read the selected LanceDB resource.",
        ) from error
    except LanceDBAdminError as error:
        logThis.error("LanceDB administrator request failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process the LanceDB administrator request.",
        ) from error
    except Exception as error:  # pragma: no cover - defensive route boundary
        logThis.exception("Unexpected LanceDB administrator error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to process the LanceDB administrator request.",
        ) from error


@router.get(
    "/access",
    response_model=LanceAdminAccessResponse,
    summary="Validate administrator access",
)
def validate_lancedb_admin_access() -> LanceAdminAccessResponse:
    """Validate the internal-secret header without touching LanceDB storage."""

    return LanceAdminAccessResponse()


@router.get("/tables", response_model=LanceTablesResponse)
def list_lancedb_tables(
    service: LanceDBAdminService = Depends(get_lancedb_admin_service),
) -> LanceTablesResponse:
    return _run_admin_operation(service.list_tables)


@router.get("/{table_name}", response_model=LanceTableDetailsResponse)
def get_lancedb_table_details(
    table_name: str,
    service: LanceDBAdminService = Depends(get_lancedb_admin_service),
) -> LanceTableDetailsResponse:
    return _run_admin_operation(lambda: service.get_table_details(table_name))


@router.get("/{table_name}/rows", response_model=LanceRowsResponse)
def get_lancedb_rows(
    table_name: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    tag: str | None = Query(default=None, max_length=128),
    sort_by: SortColumn | None = Query(default=None),
    sort_order: SortOrder = Query(default="asc"),
    service: LanceDBAdminService = Depends(get_lancedb_admin_service),
) -> LanceRowsResponse:
    return _run_admin_operation(
        lambda: service.get_rows(
            table_name,
            page=page,
            page_size=page_size,
            tag=tag,
            sort_by=sort_by,
            sort_order=sort_order,
        )
    )


@router.get("/{table_name}/rows/{row_id}", response_model=LanceRowDetailResponse)
def get_lancedb_row(
    table_name: str,
    row_id: int = Path(ge=0),
    service: LanceDBAdminService = Depends(get_lancedb_admin_service),
) -> LanceRowDetailResponse:
    return _run_admin_operation(lambda: service.get_row(table_name, row_id))
