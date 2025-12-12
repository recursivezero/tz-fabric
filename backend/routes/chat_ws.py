# routes/chat_ws.py
import os
import secrets
import uuid
import asyncio
from fastapi import APIRouter, UploadFile, File, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pathlib import Path
from typing import Dict, Any

from routes.routes_helper import (
    detect_fabrics_and_extract_colors,
    generate_color_variations_api,
    save_and_process_images,
    validate_uploaded_files,
)
from image_detection.logger import logThis

router = APIRouter()


# 1) Simple temp upload endpoint: saves files under backend/assets/temp/<session_id>/
@router.post("/upload_temp")
async def upload_temp(single_image: UploadFile = File(...), group_image: UploadFile = File(...)):
    session_id = secrets.token_hex(4)
    base = Path(__file__).resolve().parents[1] / "assets" / "temp" / session_id
    os.makedirs(base, exist_ok=True)

    single_path = base / single_image.filename
    group_path = base / group_image.filename

    # IMPORTANT: Proper async read
    with open(single_path, "wb") as f:
        f.write(await single_image.read())

    with open(group_path, "wb") as f:
        f.write(await group_image.read())
    print("Saved single:", single_path, "size:", os.path.getsize(single_path))
    print("Saved group:", group_path, "size:", os.path.getsize(group_path))

    return {
    "session_id": session_id,
    "single_filename": single_image.filename,
    "group_filename": group_image.filename
}



# 2) WebSocket endpoint: client connects, sends a start command with session_id + mode,
#    server processes and streams progress messages and final result.
@router.websocket("/ws/chat")
async def websocket_chat(ws: WebSocket):
    await ws.accept()
    logThis.info("Websocket connected", extra={"color": "blue"})
    try:
        while True:
            msg = await ws.receive_json()
            # Expect messages like: {"type":"start", "session_id":"abc123", "mode":"Fabric Mask (Smooth Blend)"}
            if not isinstance(msg, dict) or "type" not in msg:
                await ws.send_json({"type": "error", "message": "Invalid message format"})
                continue

            if msg["type"] == "start":
                session_id = msg.get("session_id")
                mode = msg.get("mode")
                await ws.send_json({"type": "status", "message": "Starting processing..."})

                # Validate mode
                valid_modes = ["Fabric Mask (Smooth Blend)", "Hue Shift (HSV)"]
                if mode not in valid_modes:
                    await ws.send_json({"type": "error", "message": f"Mode must be one of {valid_modes}"})
                    continue

                # Resolve stored file paths
                base = Path(__file__).resolve().parents[1] / "assets" / "temp" / session_id
                single_path = base / msg.get("single_filename", "")
                group_path = base / msg.get("group_filename", "")

                if not single_path.exists() or not group_path.exists():
                    await ws.send_json({"type": "error", "message": "Uploaded files not found on server."})
                    continue

                # Do the heavy work in background so websocket remains responsive.
                # We'll use asyncio.to_thread to avoid blocking the event loop.
                async def run_processing():
                    try:
                        await ws.send_json({"type": "status", "message": "Validating images..."})
                        # load images (PIL)
                        from PIL import Image
                        single_img = Image.open(single_path)
                        group_img = Image.open(group_path)

                        await ws.send_json({"type": "status", "message": "Detecting fabrics and extracting colors..."})
                        dominant_colors, _, _ = await asyncio.to_thread(detect_fabrics_and_extract_colors, group_img)

                        if not dominant_colors:
                            await ws.send_json({"type": "error", "message": "No fabrics detected in group image"})
                            return

                        await ws.send_json({"type": "status", "message": f"Detected {len(dominant_colors)} colors. Generating variations..."})

                        # generate_color_variations_api returns generated_paths, timestamp_folder
                        generated_paths, timestamp_folder = await asyncio.to_thread(generate_color_variations_api, single_img, dominant_colors, mode)

                        # Build public URLs — make sure you mounted generated static path in main.py
                        public_urls = []
                        for p in generated_paths:
                            filename = Path(p).name
                            url = f"/generated/{timestamp_folder}/{filename}"
                            public_urls.append(url)

                        await ws.send_json({"type": "done", "message": "Generation complete", "images": public_urls, "parent_folder": timestamp_folder})
                    except Exception as e:
                        logThis.error(f"WS processing error: {e}")
                        await ws.send_json({"type": "error", "message": f"Internal server error: {str(e)}"})

                # start processing (no await here so we can keep the loop)
                asyncio.create_task(run_processing())

            elif msg["type"] == "ping":
                await ws.send_json({"type": "pong"})
            else:
                await ws.send_json({"type": "error", "message": "Unknown command"})
    except WebSocketDisconnect:
        logThis.info("Websocket disconnected", extra={"color": "yellow"})
    except Exception as e:
        logThis.error(f"Websocket error: {e}")
        try:
            await ws.close()
        except:
            pass
