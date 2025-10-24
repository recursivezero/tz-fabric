# tools/mcp_client.py
import asyncio
from typing import Any, Dict, Optional
from constants import MCP_URL
from fastmcp import Client

async def _invoke_once(name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
    arguments = arguments or {}
    async with Client(MCP_URL) as client:
        await client.list_tools()
        return await client.call_tool(name, arguments)

def invoke_tool_sync(name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
    return asyncio.run(_invoke_once(name, arguments or {}))

async def invoke_tool(name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
    return await _invoke_once(name, arguments or {})

async def list_tools() -> Any:
    async with Client(MCP_URL) as client:
        return await client.list_tools()

async def shutdown():
    return None
