# Documentation

This guide explains **how to add a MCP Tool** into the Fabric Chat system that supports:
✅ Image analysis  
✅ Media upload  
✅ Vector search  
✅ Regeneration  

---

## ✅ Quick Overview

| Layer | Role | What you update |
|-------|------|----------------|
| MCP Server | Declares actual tool behavior | `tools/mcpserver.py` |
| Agent Router | Detects user intent → selects tool | `agent/graph.py` |
| MCP Client | Connects FastAPI to MCP Server | Already handled ✅ |
| FastAPI API | Allows tool types in schema | `routes/chat.py` |

---

## ✅ Step‑By‑Step Guide

### **1️⃣ Add MCP Tool (Server)**

Create function in `tools/mcpserver.py` with `@mcp.tool()`:

```python
@mcp.tool()
def mytool(*, input_text: str) -> Dict[str, Any]:
    if not input_text.strip():
        return {
            "ok": False,
            "error": {"code": "missing_input", "message": "text required"}
        }

    result = input_text.upper()  # your tool logic

    return {
        "ok": True,
        "bot_messages": [
            "✅ MyTool completed!",
            result
        ],
        "analysis_responses": [
            {"id": "1", "text": result}
        ],
        "action": {
            "type": "mytool",
            "params": {"input_text": input_text}
        },
        "_via": "mcp.mytool"
    }
```

📌 **Important: Return standard MCP envelope**
- `ok` flag required
- `bot_messages` OR `analysis_responses` must exist
- Include `action.type` to continue flow

---

### **2️⃣ Restart MCP Server**
Your new tool must load into the SSE app:


### **3️⃣ Register Tool in Agent (Client Dispatch)**

Update **`agent/graph.py`**:

```python
def call_mytool(params: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return invoke_tool_sync("mytool", params)
    except Exception as e:
        import traceback
        return {
            "type": "mytool",
            "params": params,
            "bot_messages": [f"MyTool error: {e}", traceback.format_exc()],
        }

_TOOL_DISPATCH["mytool"] = call_mytool
```


### **4️⃣ Add Routing Logic (when to call tool)**

In `agent/graph.py`, modify `router_fn`:

```python
MYTOOL_RE = re.compile(r"\b(mytool|do magic)\b", re.I)

def router_fn(user_text: str) -> Dict[str, Any]:
    if MYTOOL_RE.search(user_text):
        return {"tool": "mytool", "params": {"input_text": user_text}}
    
```

🎯 This determines when the agent decides to call your tool.

---

### **5️⃣ Update API Response Model**

In `routes/chat.py`, allow the new action:

```python
class Action(BaseModel):
    type: Literal[
        "redirect_to_analysis",
        "redirect_to_media_analysis",
        "search",
        "mytool"  
    ]
    params: Dict[str, Any]
```

## ✅ Testing Checklist

| Test | Example | Expected |
|------|---------|---------|
| Basic execution | “run mytool hello world” | Uppercased text reply |
| Error path | empty input | Returns `ok: false` |
| Router path | with keyword | Tool triggered |
| Chat wrapper | FastAPI `/chat` | No crashes |

---

## Best Practices ✅

✅ Validate all input  
✅ Use unique `type` names  
✅ Do not modify global state unless required  
✅ Include `cache_key` if generating variants like analysis tool

---

## Example Tool Trigger Phrases

- “run mytool hello world”
- “do magic with denim data”
- UI button → formatted command
