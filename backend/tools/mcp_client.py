import asyncio
from typing import Any, Dict, Optional
from constants import MCP_URL
from fastmcp import Client
import concurrent.futures


async def _invoke_once(name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
    arguments = arguments or {}
    async with Client(MCP_URL) as client:
        await client.list_tools()
        return await client.call_tool(name, arguments)


def invoke_tool_sync(name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
    coro = _invoke_once(name, arguments or {})
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        # Running inside an event loop → run in a fresh loop on a worker thread
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(lambda: asyncio.run(coro))
            return fut.result()
    return asyncio.run(coro)


async def invoke_tool(name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
    return await _invoke_once(name, arguments or {})


async def list_tools() -> Any:
    async with Client(MCP_URL) as client:
        return await client.list_tools()


async def shutdown():
    return None
