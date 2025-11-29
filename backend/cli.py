# backend/cli.py
import argparse
import importlib.metadata
import os
from importlib.metadata import PackageNotFoundError

import uvicorn
from dotenv import load_dotenv

load_dotenv()

Port = int(os.getenv("PORT", "8000"))


# --- OLD BEHAVIOR preserved exactly ---
def app():
    """
    Legacy function kept exactly as before.
    Running: poetry run dev
    """
    uvicorn.run("main:app", host="127.0.0.1", port=Port, reload=True)


# --- NEW CLI ENTRYPOINT ---
def main():
    """
    New CLI for tzfabric.
    Supports:
        tzfabric --version
        tzfabric --serve
        tzfabric (default → serve)
    """
    parser = argparse.ArgumentParser(prog="tzfabric")
    parser.add_argument("--version", action="store_true", help="Show package version")
    parser.add_argument("--serve", action="store_true", help="Start FastAPI server")
    parser.add_argument("--host", default=os.getenv("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=Port)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    if args.version:
        try:
            version = importlib.metadata.version("tzfabric")
        except PackageNotFoundError:
            version = "package-not-installed"
        print(version)
        return

    # Default behavior: run the server
    uvicorn.run("main:app", host=args.host, port=args.port, reload=args.reload)
