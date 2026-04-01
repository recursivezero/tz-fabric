import os
import click
import uvicorn
import importlib.metadata


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8002


# ------------------------------------------------------------
# Root CLI group
# ------------------------------------------------------------
@click.group()
@click.version_option(
    importlib.metadata.version("tz-fabric"),
    "--version",
    "-v",
    prog_name="fabric",
    message="fabric version: %(version)s",
)
def main():
    """
    fabric command-line interface.
    Use subcommands like: fabric dev, fabric prod, fabric api.
    """


# ------------------------------------------------------------
# dev command
# ------------------------------------------------------------
@main.command()
@click.option("--host", default=DEFAULT_HOST, help="Host to bind.")
@click.option("--port", default=DEFAULT_PORT, help="Port to run on.")
def dev(host, port):
    """Run the development server with reload enabled."""
    os.environ["APP_ENV"] = "development"  # ← set BEFORE app imports
    uvicorn.run("main:app", host=host, port=port, reload=True)


# ------------------------------------------------------------
# prod command
# ------------------------------------------------------------
@main.command()
@click.option("--host", default=DEFAULT_HOST, help="Host to bind.")
@click.option("--port", default=DEFAULT_PORT, help="Port to run on.")
@click.option("--workers", default=1, help="Number of worker processes.")
def prod(host, port, workers):
    """Run the production server."""
    os.environ["APP_ENV"] = "production"  # ← set BEFORE app imports
    uvicorn.run("main:app", host=host, port=port, reload=False, workers=workers)


# ------------------------------------------------------------
# api command (manual control)
# ------------------------------------------------------------
@main.command()
@click.option("--host", default=DEFAULT_HOST, help="Host to bind.")
@click.option("--port", default=DEFAULT_PORT, help="Port to run on.")
@click.option("--reload", is_flag=True, help="Enable auto-reload.")
@click.option(
    "--env",
    default="development",
    type=click.Choice(["development", "production"]),
    help="Environment to run in.",
)
def api(host, port, reload, env):
    """Start the FastAPI server with explicit env control."""
    os.environ["APP_ENV"] = env
    uvicorn.run("main:app", host=host, port=port, reload=reload)


# ------------------------------------------------------------
# Entry point for poetry / `fabric` script
# ------------------------------------------------------------
if __name__ == "__main__":
    main()
