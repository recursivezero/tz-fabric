from fastapi import APIRouter, UploadFile, File, Request
import uuid
import datetime

router = APIRouter()

@router.post("/submit")
async def submit_file(request: Request, image: UploadFile = File(...), audio: UploadFile = File(...)):
    db = request.app.database
    fs = request.app.fs
    pair_id = str(uuid.uuid4())


    image_data = await image.read()
    audio_data = await audio.read()

    image_file_id = fs.put(image_data, filename=image.filename, content_type=image.content_type)
    audio_file_id = fs.put(audio_data, filename=audio.filename, content_type=audio.content_type)

    db.images.insert_one({
        "pair_id": pair_id, 
        "gridFsId": image_file_id,
        "filename": image.filename,
        "content_type": image.content_type,
        "timestamp": datetime.datetime.utcnow()
    })

    db.audios.insert_one({
        "pair_id": pair_id, 
        "gridFsId": audio_file_id,
        "filename": audio.filename,   
        "content_type": audio.content_type,
        "timestamp": datetime.datetime.utcnow()
    })

    return {"message": "Files uploaded", "pairId": pair_id}
        