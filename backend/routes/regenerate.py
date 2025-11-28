import asyncio

from fastapi import APIRouter, HTTPException

from utils.cache import get_response

router = APIRouter()


@router.get("/regenerate")
async def regenerate(key: str, index: int):
    try:
        waiting = 0
        interval = 0.5
        timeout = 30  # seconds

        while waiting < timeout:
            response = get_response(key, index)
            if response is not None:
                return response
            await asyncio.sleep(interval)
            waiting += interval

        print(f"Timeout: No response for key={key}, index={index}")
        return {"id": index, "response": None}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Regenerate failed: {str(e)}")
