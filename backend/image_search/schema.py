from typing import Type

from utils.aws_helper import generate_cdn_url
from lancedb.pydantic import LanceModel, Vector
from PIL import Image
from image_search.embedding_model import register_model

# Register the OpenAI CLIP model
siglip = register_model("siglip")


class Fabric(LanceModel):
    """
    Represents a Schema.

    Attributes:
        vector (Vector): The vector representation of the item.
        image_uri (str): The URI of the item's image.
    """

    vector: Vector(siglip.ndims()) = siglip.VectorField()  # type: ignore
    image_uri: str = siglip.SourceField()
    tag:str
    hash: str  # Add the hash field
    mtime: float

    @property
    @property
    def image(self):
        url = generate_cdn_url(self.image_uri)
        return Image.open(url)


# Function to map schema name to schema class
def get_schema_by_name(schema_name: str) -> Type[Fabric] | None:
    """
    Retrieves the schema object based on the given schema name.

    Args:
        schema_name (str): The name of the schema.

    Returns:
        object: The schema object corresponding to the given schema name, or None if not found.
    """
    schema_map = {
        "Fabric": Fabric,
    }
    return schema_map.get(schema_name)
