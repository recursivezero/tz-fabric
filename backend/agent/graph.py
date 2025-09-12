# agent/graph.py
from typing import Optional, Literal, Dict, Any
from langgraph.prebuilt import create_react_agent
from langchain.tools import StructuredTool
from langchain_groq import ChatGroq

from core.config import settings
from tools.mcpserver import redirect_to_analysis as mcp_redirect_to_analysis

def _redirect_to_analysis(
    image_url: Optional[str] = None,
    mode: Literal["short", "long"] = "short",
) -> Dict[str, Any]:
    payload = mcp_redirect_to_analysis(image_url=image_url, mode=mode)
    if isinstance(payload, str):
        try:
            import json
            payload = json.loads(payload)
        except Exception:
            payload = {"type": "redirect_to_analysis", "params": {"image_url": image_url, "mode": mode}, "bot_messages": [str(payload)]}
    return payload

redirect_tool = StructuredTool.from_function(
    func=_redirect_to_analysis,
    name="redirect_to_analysis",
    description="Redirect user to the Fabric Analysis page with an image and mode.",
    return_direct=True,
)

llm = ChatGroq(
    api_key=settings.GROQ_API_KEY,
    model=settings.GROQ_MODEL,
    temperature=0,
)

agent_graph = create_react_agent(
    model=llm,
    tools=[redirect_tool]
)

SYSTEM_PROMPT = (
    "You are a Fabric Assistant.\n"
    "- If the user asks to analyze a fabric image, call the tool: redirect_to_analysis(image_url, mode) and STOP.\n"
    "- Otherwise, reply normally about fabrics/textiles.\n"
    "- If the user asks something unrelated to fabrics or this app, politely refuse.\n"
    "- Never invent tool names. Only use the tools you are given."
)
