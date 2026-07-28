"""Response models for the read-only LanceDB administrator explorer."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


SortColumn = Literal["image_uri", "tag", "hash", "mtime"]
SortOrder = Literal["asc", "desc"]


class LanceTableItem(BaseModel):
    name: str


class LanceTablesResponse(BaseModel):
    tables: list[LanceTableItem]


class LanceSchemaField(BaseModel):
    name: str
    type: str
    nullable: bool
    is_vector: bool = False


class LanceEmbeddingFunction(BaseModel):
    name: str
    source_column: str
    vector_column: str


class LanceVectorColumn(BaseModel):
    name: str
    dimension: int


class LanceTableDetailsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    name: str
    row_count: int = Field(ge=0)
    table_schema: list[LanceSchemaField] = Field(alias="schema")
    schema_metadata: dict[str, Any]
    embedding_functions: list[LanceEmbeddingFunction]
    vector_columns: list[LanceVectorColumn]


class LanceVectorSummary(BaseModel):
    length: int = Field(ge=0)
    included: bool = False


class LanceRowSummary(BaseModel):
    row_id: int = Field(ge=0)
    image_uri: str | None = None
    tag: str | None = None
    hash: str | None = None
    mtime: float | int | str | None = None
    vector: LanceVectorSummary


class LancePagination(BaseModel):
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total_rows: int = Field(ge=0)
    total_pages: int = Field(ge=0)
    has_next: bool
    has_previous: bool


class LanceFilterState(BaseModel):
    tag: str | None = None


class LanceSortState(BaseModel):
    column: SortColumn | None = None
    order: SortOrder = "asc"


class LanceRowsResponse(BaseModel):
    table: str
    rows: list[LanceRowSummary]
    pagination: LancePagination
    filter: LanceFilterState
    sort: LanceSortState


class LanceVectorValues(BaseModel):
    length: int = Field(ge=0)
    values: list[float | None]


class LanceRowDetailResponse(BaseModel):
    row_id: int = Field(ge=0)
    image_uri: str | None = None
    tag: str | None = None
    hash: str | None = None
    mtime: float | int | str | None = None
    vector: LanceVectorValues
