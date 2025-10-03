# api/mcp_proxy.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict, Optional
import inspect
import asyncio

import tools.mcpserver as mcpserver

router = APIRouter(prefix="/mcp", tags=["mcp"])


class MCPCallReq(BaseModel):
    tool: str
    args: Optional[Dict[str, Any]] = {}


class MCPCallResp(BaseModel):
    ok: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


def _call_sync_or_async(fn, /, **kwargs):
    
    if inspect.iscoroutinefunction(fn):
        # run coroutine in a new loop (safe for sync endpoint)
        return asyncio.run(fn(**kwargs))
    else:
        return fn(**kwargs)


@router.post("/call", response_model=MCPCallResp)
def call_tool(req: MCPCallReq):
    tool_name = req.tool
    args = req.args or {}

    # 1) Try direct function on the mcpserver module (recommended)
    fn = getattr(mcpserver, tool_name, None)
    if callable(fn):
        try:
            result = _call_sync_or_async(fn, **args)
            return MCPCallResp(ok=True, result=result)
        except Exception as e:
            return MCPCallResp(ok=False, error=f"tool {tool_name} execution failed: {str(e)}")

    # 2) Fallback: try calling a method on the mcp object (if it has any callable entrypoint)
    mcp_obj = getattr(mcpserver, "mcp", None)
    if mcp_obj is not None:
        for method_name in ("call", "invoke", "run", "execute", "dispatch"):
            if hasattr(mcp_obj, method_name):
                method = getattr(mcp_obj, method_name)
                if callable(method):
                    try:
                        try:
                            result = _call_sync_or_async(method, tool_name, args)
                        except TypeError:
                            result = _call_sync_or_async(method, tool_name=tool_name, args=args)
                        return MCPCallResp(ok=True, result=result)
                    except Exception as e:
                        return MCPCallResp(ok=False, error=f"mcp.{method_name} failed: {str(e)}")

    # 3) No tool found
    return MCPCallResp(ok=False, error=f"tool '{tool_name}' not found on mcpserver module or mcp object")
