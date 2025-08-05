from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from bson import ObjectId

router = APIRouter()

@router.get("/search")
async def search_files(request: Request, image_name: str):
    db = request.app.database
    fs = request.app.fs

    image_doc = db.images.find_one({"filename": image_name})
    if not image_doc:
        return {"message": "Image not found"}   
    
    audio_doc = db.audios.find_one({"pair_id": image_doc["pair_id"]})
    if not audio_doc:   
        return {"message": "Audio not found for the given image"}
    
    audio_file = fs.get(ObjectId(audio_doc["gridFsId"]))
    return StreamingResponse(audio_file, media_type=audio_doc["content_type"])