import chromadb
from chromadb.api.models.Collection import Collection

client = chromadb.PersistentClient(path="./vector_store")


collection: Collection = client.get_or_create_collection("fabric", metadata={"hnsw:space": "cosine"})


def get_index() -> Collection:
    return collection


def reindex():
    pass
