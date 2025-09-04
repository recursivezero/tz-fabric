from typing import Optional, Literal, Dict
from mcp.server.fastmcp import FastMCP
from tools.logic import redirect_to_analysis_logic

mcp = FastMCP("fabric-tools")

@mcp.tool()
def redirect_to_analysis(
    image_url: Optional[str] = None,
    mode: Literal["short", "long"] = "short",
) -> Dict:
    """Redirect user to Fabric Analysis page with the image and selected mode."""
    return redirect_to_analysis_logic(image_url=image_url, mode=mode)

def sse_app():
    return mcp.sse_app()
