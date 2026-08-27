"""Secure, read-only administrator endpoints for LanceDB inspection."""

from collections.abc import Callable
from typing import Annotated, TypeVar

from fastapi import (
    APIRouter,
    Depends,
    Header,
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
    LanceDataSource,
    LanceRowDetailResponse,
    LanceRowsResponse,
    LanceStorageType,
    LanceTableDetailsResponse,
    LanceTablesResponse,
    SortColumn,
    SortOrder,
)
from services.lancedb_admin_service import (
    LanceAdminCredentials,
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


def get_lancedb_admin_service(
    storage: Annotated[
        LanceStorageType,
        Header(alias="X-LanceDB-Storage"),
    ],
    location: Annotated[
        str | None,
        Header(alias="X-LanceDB-Location", max_length=2048),
    ] = None,
    s3_access_key_id: Annotated[
        str | None, Header(alias="X-LanceDB-AWS-Access-Key-ID", max_length=256)
    ] = None,
    s3_secret_access_key: Annotated[
        str | None, Header(alias="X-LanceDB-AWS-Secret-Access-Key", max_length=512)
    ] = None,
    s3_session_token: Annotated[
        str | None, Header(alias="X-LanceDB-AWS-Session-Token", max_length=4096)
    ] = None,
    s3_region: Annotated[
        str | None, Header(alias="X-LanceDB-AWS-Region", max_length=128)
    ] = None,
    s3_bucket_name: Annotated[
        str | None, Header(alias="X-LanceDB-AWS-Bucket", max_length=255)
    ] = None,
    r2_access_key_id: Annotated[
        str | None, Header(alias="X-LanceDB-R2-Access-Key-ID", max_length=256)
    ] = None,
    r2_secret_access_key: Annotated[
        str | None, Header(alias="X-LanceDB-R2-Secret-Access-Key", max_length=512)
    ] = None,
    r2_account_id: Annotated[
        str | None, Header(alias="X-LanceDB-R2-Account-ID", max_length=256)
    ] = None,
    r2_bucket_name: Annotated[
        str | None, Header(alias="X-LanceDB-R2-Bucket", max_length=255)
    ] = None,
    r2_endpoint: Annotated[
        str | None, Header(alias="X-LanceDB-R2-Endpoint", max_length=2048)
    ] = None,
    r2_region: Annotated[
        str | None, Header(alias="X-LanceDB-R2-Region", max_length=128)
    ] = None,
) -> LanceDBAdminService:
    """Build a read-only service from request-scoped admin credentials.

    Object-storage credentials are supplied by the admin page for the current
    browser session; the LanceDB explorer does not read them from backend env.
    """

    credentials = LanceAdminCredentials(
        s3_access_key_id=s3_access_key_id or "",
        s3_secret_access_key=s3_secret_access_key or "",
        s3_session_token=s3_session_token or "",
        s3_region=s3_region or "",
        s3_bucket_name=s3_bucket_name or "",
        r2_access_key_id=r2_access_key_id or "",
        r2_secret_access_key=r2_secret_access_key or "",
        r2_account_id=r2_account_id or "",
        r2_bucket_name=r2_bucket_name or "",
        r2_endpoint=r2_endpoint or "",
        r2_region=r2_region or "auto",
    )

    try:
        return LanceDBAdminService(
            source=LanceDataSource(storage=storage, location=location or ""),
            credentials=credentials,
        )
    except LanceDBValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


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


@router.get(
    "/scan",
    response_model=LanceTablesResponse,
    summary="Scan a selected LanceDB source for tables",
)
def scan_lancedb_tables(
    service: LanceDBAdminService = Depends(get_lancedb_admin_service),
) -> LanceTablesResponse:
    return _run_admin_operation(service.list_tables)


@router.get(
    "/tables",
    response_model=LanceTablesResponse,
    include_in_schema=False,
)
def list_lancedb_tables_legacy(
    service: LanceDBAdminService = Depends(get_lancedb_admin_service),
) -> LanceTablesResponse:
    """Compatibility route for older clients; new clients should use /scan."""

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
