// hooks/chat.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { chatOnce, type Message, type ChatResponse } from "../services/chat_api";
import { BASE_URL } from "../constants";
console.log("BASE_URL in useChat:", BASE_URL);

type Status = "idle" | "sending" | "error";

export default function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [currentResponse, setCurrentResponse] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<{
    action: { type: string; params: any };
    analysis_responses?: { id: string; text: string }[];
    used_ids?: string[]; // ALWAYS store string ids
  } | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingAction, currentResponse]);

  const handleUpload = useCallback(
    (file: File) => {
      if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
      setUploadedFile(file);
      setUploadedPreviewUrl(URL.createObjectURL(file));
    },
    [uploadedPreviewUrl]
  );

  const clearUpload = useCallback(() => {
    setUploadedFile(null);
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedPreviewUrl(null);
  }, [uploadedPreviewUrl]);

  const normalizeId = useCallback((id: any) => {
    if (id === undefined || id === null) return "";
    return String(id);
  }, []);

  const handleResponse = useCallback((res: ChatResponse) => {
    if (res.bot_messages && res.bot_messages.length > 0) {
      setMessages((prev) => [
        ...prev,
        ...res.bot_messages.map((txt) => ({ role: "assistant", content: txt })),
      ]);
    } else {
      setMessages((prev) => [...prev, res.reply]);
    }

    if ((res as any).action?.type === "redirect_to_analysis") {
      const action = (res as any).action;
      const rawResponses = (res as any).analysis_responses || [];

      const normalizedResponses = rawResponses.map((r: any, i: number) => ({
        id: normalizeId(r.id ?? `r${i}`),
        text: r.text ?? r.content ?? String(r),
      }));

      let firstUsedId = normalizedResponses.length > 0 ? normalizedResponses[0].id : null;
      if (!firstUsedId && action.params) {
        const possibleFirst =
          action.params?.first_id ||
          action.params?.firstResponseId ||
          (action.params?.response && action.params.response.id) ||
          (action.params?.response && action.params.response.rid);
        if (possibleFirst) firstUsedId = normalizeId(possibleFirst);
      }
      if (!firstUsedId) firstUsedId = "1";

      if (normalizedResponses.length > 0) {
        const firstText = normalizedResponses[0].text;
        setMessages((prev) => [...prev, { role: "assistant", content: firstText }]);

        setCurrentResponse(firstText);
      } else if (action.params?.cache_key && action.params?.first_text) {
        setCurrentResponse(action.params.first_text);

        setMessages((prev) => [...prev, { role: "assistant", content: action.params.first_text }]);
      }

      setPendingAction({
        action,
        analysis_responses: normalizedResponses,
        used_ids: [firstUsedId],
      });
      return;
    }

    setPendingAction(null);
  }, [normalizeId]);


  const acceptAction = useCallback(() => {
    if (!pendingAction) return;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Great — glad that helped!" },
    ]);
    setPendingAction(null);
  }, [pendingAction]);

  const callMcp = useCallback(async (tool: string, args: Record<string, any> = {}) => {
    const resp = await fetch(`${BASE_URL}/api/mcp/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, args }),
    });
    console.log(`MCP call response for tool ${tool}:`, resp);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${txt}`);
    }
    const data = await resp.json();
    console.log(`MCP call data for tool ${tool}:`, data);
    if (!data.ok) throw new Error(data.error || "MCP call failed");
    return data.result;
  }, []);

  const pollForCachedIndex = useCallback(
    async (cache_key: string, index: number, timeoutMs = 15000, intervalMs = 800) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const result = await callMcp("regenerate", { cache_key, index });
          if (result && result.response) {
            return result.response;
          }
          if (result && result.error && result.error !== "pending") {
            return null;
          }
        } catch (e) {
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      return null;
    },
    [callMcp]
  );

  const rejectAction = useCallback(async () => {
    if (!pendingAction) return;
    setStatus("sending");
    setError("");

    try {
      const { action, analysis_responses = [], used_ids = [] } = pendingAction;
      const image_url = action.params?.image_url ?? null;
      const mode = action.params?.mode ?? "short";
      const cache_key = action.params?.cache_key ?? null;

      const usedSet = new Set((used_ids || []).map((u) => normalizeId(u)));
      const max = 6;
      const candidateIndices: number[] = [];
      for (let i = 1; i <= max; i++) {
        if (!usedSet.has(String(i))) candidateIndices.push(i);
      }

      if (candidateIndices.length === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "No more cached alternatives. You can request a fresh set." },
        ]);
        setStatus("idle");
        return;
      }

      for (const idx of candidateIndices) {
        if (cache_key) {
          const result = await callMcp("regenerate", { cache_key, index: idx, image_url, mode, used_ids });
          if (result && result.response) {
            const r = result.response as { id: any; response?: string; text?: string };
            const rText = (r.response ?? (r as any).text) ?? "";
            const rId = normalizeId(r.id ?? idx);
            setMessages((prev) => [...prev, { role: "assistant", content: rText }]);
            setCurrentResponse(rText);
            setPendingAction((prev) => (prev ? { ...prev, used_ids: [...(prev.used_ids || []), rId] } : prev));
            setStatus("idle");
            return;
          }

          if (result && result.error === "pending") {
            const polled = await pollForCachedIndex(cache_key, idx, 15000, 800);
            if (polled) {
              const rId = normalizeId(polled.id ?? idx);
              const rText = polled.response ?? (polled as any).text ?? "";
              setMessages((prev) => [...prev, { role: "assistant", content: rText }]);
              setCurrentResponse(rText);
              setPendingAction((prev) => (prev ? { ...prev, used_ids: [...(prev.used_ids || []), rId] } : prev));
              setStatus("idle");
              return;
            } else {
              continue;
            }
          }

          if (result && result.error === "exhausted") {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: result.message ?? "All cached alternatives exhausted." },
            ]);
            setStatus("idle");
            return;
          }

          continue;
        }
        const result = await callMcp("regenerate", { image_url, used_ids, mode });
        if (result && result.response) {
          const r = result.response as { id: any; text?: string; response?: string };
          const rText = r.response ?? r.text ?? "";
          const rId = normalizeId(r.id ?? idx);
          setMessages((prev) => [...prev, { role: "assistant", content: rText }]);
          setCurrentResponse(rText);
          setPendingAction((prev) => (prev ? { ...prev, used_ids: [...(prev.used_ids || []), rId] } : prev));
          setStatus("idle");
          return;
        }
        if (result && result.error === "exhausted") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: result.message ?? "All cached alternatives exhausted." },
          ]);
          setStatus("idle");
          return;
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "No cached alternatives available right now. Try again or request a fresh set." },
      ]);
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Regenerate failed");
    }
  }, [pendingAction, callMcp, normalizeId, pollForCachedIndex]);

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !uploadedFile) || status === "sending") return;

    setStatus("sending");
    setError("");

    const next: Message[] = text ? [...messages, { role: "user", content: text }] : [...messages];
    if (text) setMessages(next);
    setInput("");

    try {
      let res: ChatResponse;

      if (uploadedFile) {
        const formData = new FormData();
        formData.append("file", uploadedFile);
        const upResp = await fetch(`${BASE_URL}/api/uploads/tmp`, { method: "POST", body: formData });
        if (!upResp.ok) {
          const txt = await upResp.text().catch(() => "");
          throw new Error(`Image upload failed: ${upResp.status} ${txt}`);
        }
        const upJson = await upResp.json();
        const imageUrl = upJson?.image_url ?? null;

        const mcpResult = await callMcp("redirect_to_analysis", { image_url: imageUrl, mode: "short" });

        res = {
          reply: { role: "assistant", content: "Image uploaded and analysis started." },
          bot_messages: ["Image uploaded and analysis started."],
        } as ChatResponse;

        const actionParams: any = { image_url: imageUrl, mode: "short" };
        if (mcpResult && mcpResult.action && mcpResult.action.params) {
          Object.assign(actionParams, mcpResult.action.params || {});
        } else if (mcpResult && mcpResult.params) {
          Object.assign(actionParams, mcpResult.params || {});
        }

        if (Array.isArray(mcpResult?.analysis_responses)) {
          (res as any).analysis_responses = mcpResult.analysis_responses.map((r: any, i: number) => ({
            id: normalizeId(r.id ?? `r${i}`),
            text: r.text ?? r.response ?? r.content ?? String(r),
          }));
        } else if (Array.isArray(mcpResult?.responses)) {
          (res as any).analysis_responses = mcpResult.responses.map((r: any, i: number) => ({
            id: normalizeId(r.id ?? `r${i}`),
            text: r.text ?? r.response ?? String(r),
          }));
        }

        (res as any).action = { type: "redirect_to_analysis", params: actionParams };

        handleResponse(res);
        setStatus("idle");
        clearUpload();
        return;
      }

      res = await chatOnce(next);
      console.log("chatOnce response:", res);
      handleResponse(res);
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Something went wrong.");
    }
  }, [input, messages, status, uploadedFile, handleResponse, clearUpload, uploadedPreviewUrl, normalizeId]);

  const retryLast = useCallback(async () => {
    if (status === "sending" || messages.length === 0) return;
    setStatus("sending");
    setError("");
    try {
      const res = await chatOnce(messages);
      handleResponse(res);
      setStatus("idle");
    } catch (e: any) {
      setStatus("error");
      setError(e?.message || "Something went wrong.");
    }
  }, [messages, status, handleResponse]);

  const newChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setStatus("idle");
    setError("");
    clearUpload();
    setPendingAction(null);
    setCurrentResponse(null);
  }, [clearUpload]);

  return {
    messages,
    input,
    setInput,
    status,
    error,
    send,
    retryLast,
    newChat,
    scrollerRef,
    uploadedPreviewUrl,
    handleUpload,
    clearUpload,
    pendingAction,
    acceptAction,
    rejectAction,
    currentResponse,
  };
}
