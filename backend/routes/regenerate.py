import time

from fastapi import APIRouter, HTTPException
from backend_fabric.utils.cache import get_response

router = APIRouter()

@router.get("/regenerate")
async def regenerate(key: str, index:int):
    try:
        waiting = 0
        interval = 0.5
        timeout = 5

        while waiting < timeout:
            response = get_response(key, index)
            if response:
                return response
            time.sleep(interval)
            waiting += interval

        return {"id": index, "response": None} 

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regenerate failed: {str(e)}")