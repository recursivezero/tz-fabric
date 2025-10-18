# tools/mcp_client.py
import asyncio
import contextlib
from typing import Any, Dict, Optional
import os

from fastmcp import Client

MCP_URL = os.getenv("MCP_URL", "http://localhost:8000/mcp/sse?transport=sse")

class _MCPInvoker:
    def __init__(self, url: str, timeout: float = 60.0):
        self.url = url
        self.timeout = timeout
        self._client: Optional[Client] = None
        self._lock = asyncio.Lock()
        self._connected = False

    async def _ensure_connected(self):
        if self._connected and self._client:
            return
        async with self._lock:
            if self._connected and self._client:
                return
            # open persistent client session
            self._client = Client(self.url)
            await self._client.__aenter__()  # enter async context manually
            # warm-up: fetch tools once (optional)
            try:
                await asyncio.wait_for(self._client.list_tools(), timeout=self.timeout)
            except Exception:
                # we still keep the client; individual calls may succeed later
                pass
            self._connected = True

    async def list_tools(self):
        await self._ensure_connected()
        return await asyncio.wait_for(self._client.list_tools(), timeout=self.timeout)

    async def call_tool(self, name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
        await self._ensure_connected()
        return await asyncio.wait_for(self._client.call_tool(name, arguments or {}), timeout=self.timeout)

    async def aclose(self):
        self._connected = False
        with contextlib.suppress(Exception):
            if self._client:
                await self._client.__aexit__(None, None, None)
        self._client = None


_invoker = _MCPInvoker(MCP_URL)

async def invoke_tool(name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
    return await _invoker.call_tool(name, arguments or {})

def invoke_tool_sync(name: str, arguments: Optional[Dict[str, Any]] = None) -> Any:
    return asyncio.run(invoke_tool(name, arguments or {}))

async def list_tools() -> Any:
    return await _invoker.list_tools()

async def shutdown():
    await _invoker.aclose()
