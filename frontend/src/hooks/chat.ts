// hooks/chat.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { chatOnce, type Message, type ChatResponse } from "../services/chat_api";

type Status = "idle" | "sending" | "error";

export default function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // The highlighted description shown in the black background
  const [currentResponse, setCurrentResponse] = useState<string | null>(null);

  // pendingAction contains action.params (including cache_key) + analysis_responses + used_ids (all ids stored as strings)
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
    // Add bot messages or the assistant reply into chat history
    if (res.bot_messages && res.bot_messages.length > 0) {
      setMessages((prev) => [
        ...prev,
        ...res.bot_messages.map((txt) => ({ role: "assistant", content: txt })),
      ]);
    } else {
      setMessages((prev) => [...prev, res.reply]);
    }

    // If this is the redirect_to_analysis action, set pendingAction and set currentResponse from the first analysis
    if ((res as any).action?.type === "redirect_to_analysis") {
      const action = (res as any).action;
      const rawResponses = (res as any).analysis_responses || [];

      // Normalize analysis_responses (ids -> string)
      const normalizedResponses = rawResponses.map((r: any, i: number) => ({
        id: normalizeId(r.id ?? `r${i}`),
        text: r.text ?? r.content ?? String(r),
      }));

      // Determine the firstUsedId (if provided), fallback to first normalized response id or "1"
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

      // If we have a first normalized response, show it in the black box
      if (normalizedResponses.length > 0) {
        setCurrentResponse(normalizedResponses[0].text);
      } else if (action.params?.cache_key && action.params?.first_text) {
        // fallback if analyze returned first_text in params
        setCurrentResponse(action.params.first_text);
      }

      setPendingAction({
        action,
        analysis_responses: normalizedResponses,
        used_ids: [firstUsedId],
      });
      return;
    }

    // Not an analysis redirect — clear pendingAction & keep currentResponse as-is
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

  // helper: call backend MCP endpoint
  const callMcp = useCallback(async (tool: string, args: Record<string, any> = {}) => {
    const resp = await fetch("http://127.0.0.1:8000/api/mcp/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, args }),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "MCP call failed");
    return data.result;
  }, []);

  // Poll for cached index (useful when server returns pending). Returns the response object or null if timed out.
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
          // swallow and retry until timeout
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

      // Build candidate indices 1..6, skipping used ids (compare strings)
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

      // Try each candidate index until one returns a response (or handle pending by polling)
      for (const idx of candidateIndices) {
        if (cache_key) {
          const result = await callMcp("regenerate", { cache_key, index: idx, image_url, mode, used_ids });
          if (result && result.response) {
            const r = result.response as { id: any; response?: string; text?: string };
            const rText = r.response ?? (r as any).text ?? "";
            const rId = normalizeId(r.id ?? idx);

            // show chat message + update highlighted black box + mark used
            setMessages((prev) => [...prev, { role: "assistant", content: rText }]);
            setCurrentResponse(rText);
            setPendingAction((prev) => (prev ? { ...prev, used_ids: [...(prev.used_ids || []), rId] } : prev));
            setStatus("idle");
            return;
          }

          if (result && result.error === "pending") {
            // poll for this index until it becomes available
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
        formData.append("image", uploadedFile);
        formData.append("analysis_type", "short");
        const resp = await fetch("http://127.0.0.1:8000/api/analyse", { method: "POST", body: formData });
        const data = await resp.json();

        // Extract cache_key + first response if present
        const cacheKey = data?.cache_key ?? null;

        // Build analysis_responses array with normalized ids if server returned array form
        const responses: { id: string; text: string }[] = [];
        if (data?.response?.responses && Array.isArray(data.response.responses)) {
          for (let i = 0; i < data.response.responses.length; i++) {
            const r = data.response.responses[i];
            responses.push({ id: normalizeId(r.id ?? `r${i}`), text: r.text ?? r.content ?? String(r) });
          }
        } else if (data?.response && (data.response.response || data.response.text)) {
          const firstResp = data.response;
          const rid = normalizeId(firstResp.id ?? "1");
          const rtext = firstResp.response ?? firstResp.text ?? String(firstResp);
          responses.push({ id: rid, text: rtext });
        } else if (data?.responses && Array.isArray(data.responses)) {
          for (let i = 0; i < data.responses.length; i++) {
            const r = data.responses[i];
            responses.push({ id: normalizeId(r.id ?? `r${i}`), text: r.text ?? r.content ?? String(r) });
          }
        }

        if (responses.length > 0) {
          setCurrentResponse(responses[0].text);
        } else if (data?.response && typeof data.response === "string") {
          setCurrentResponse(data.response);
        }

        res = {
          reply: { role: "assistant", content: "Image uploaded and analyzed." },
          bot_messages: ["Image uploaded and analyzed."],
        } as ChatResponse;

        const actionParams: any = {
          image_url: data?.image_url ?? uploadedPreviewUrl ?? null,
          mode: "short",
        };
        if (cacheKey) actionParams.cache_key = cacheKey;

        (res as any).action = { type: "redirect_to_analysis", params: actionParams };
        (res as any).analysis_responses = responses;
      } else {
        res = await chatOnce(next);
      }

      handleResponse(res);
      setStatus("idle");
      clearUpload();
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
