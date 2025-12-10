import os
import click
import uvicorn
import importlib.metadata
from dotenv import load_dotenv

load_dotenv()

DEFAULT_HOST = os.getenv("HOST", "127.0.0.1")
DEFAULT_PORT = int(os.getenv("PORT", "8000"))


# ------------------------------------------------------------
# Root CLI group
# ------------------------------------------------------------
@click.group()
@click.version_option(
    importlib.metadata.version("tz-fabric"),
    "--version",
    "-v",
    prog_name="tzfabric",
    message="tzfabric version: %(version)s",
)
def main():
    """
    tzfabric command-line interface.
    Use subcommands like: tzfabric serve, tzfabric dev.
    """
    pass


# ------------------------------------------------------------
# serve command
# ------------------------------------------------------------
@main.command()
@click.option("--host", default=DEFAULT_HOST, help="Host to bind.")
@click.option("--port", default=DEFAULT_PORT, help="Port to run on.")
@click.option("--reload", is_flag=True, help="Enable auto-reload.")
def serve(host, port, reload):
    """Start the FastAPI server."""
    uvicorn.run("main:app", host=host, port=port, reload=reload)


# ------------------------------------------------------------
# dev command (legacy behavior)
# ------------------------------------------------------------
@main.command()
def dev():
    """Run the development server with reload enabled."""
    uvicorn.run("main:app", host=DEFAULT_HOST, port=DEFAULT_PORT, reload=True)


# ------------------------------------------------------------
# Entry point for poetry / `tzfabric` script
# ------------------------------------------------------------
if __name__ == "__main__":
    main()
