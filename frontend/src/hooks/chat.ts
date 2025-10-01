// src/hooks/chat.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { chatOnce, type Message, type ChatResponse } from "../services/chat_api";
import { FULL_API_URL } from "../constants";
import { extractFilenameFromText } from "../utils/extractFilenameFromText";

// replace your normalizeLLMText with this
const normalizeLLMText = (t: any): string => {
  if (t == null) return "";

  // If backend accidentally passed an object, unwrap the obvious places.
  if (typeof t === "object") {
    const inner =
      t?.response?.response ??
      t?.response?.text ??
      t?.response?.message ??
      t?.response ??
      t?.text ??
      t?.message ??
      null;
    if (inner != null) return normalizeLLMText(inner);
    // fallback to a string for anything else
    t = JSON.stringify(t);
  }

  let s = String(t).trim();

  // Normalize escaped newlines, remove CRs, trim trailing spaces before newlines
  s = s.replace(/\\n/g, "\n").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n");

  // If it looks like a Python-ish dict containing a nested response,
  // pull out the deepest `response` string without trying to fully JSON-parse.
  // 1) {'response': {'id': '2', 'response': "The fabric ..."}, 'selected_index': 2}
  let m =
    s.match(/['"]response['"]\s*:\s*\{[\s\S]*?['"]response['"]\s*:\s*(['"])([\s\S]*?)\1/) ||
    s.match(/['"]response['"]\s*:\s*(['"])([\s\S]*?)\1/);
  if (m && m[2]) {
    const inner = m[2];
    return inner.replace(/\\n/g, "\n").trim();
  }

  // If it looks like JSON already, try a careful parse (without wrecking inner quotes)
  if (/^\s*\{/.test(s) && /"response"/.test(s)) {
    try {
      const obj = JSON.parse(s);
      const inner =
        obj?.response?.response ??
        obj?.response?.text ??
        obj?.response?.message ??
        obj?.response ??
        null;
      if (inner) return normalizeLLMText(inner);
    } catch { /* ignore */ }
  }

  // strip accidental outer quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }

  return s.trim();
};

export default function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  // Media uploads
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shouldNavigateToList, setShouldNavigateToList] = useState<boolean>(false);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    action: { type: string; params: any };
    analysis_responses?: { id: string; text: string }[];
    used_ids?: string[];
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const navigateTimeoutRef = useRef<number | null>(null);

  const scheduleNavigateToList = useCallback((delay = 3000) => {
    if (navigateTimeoutRef.current) {
      window.clearTimeout(navigateTimeoutRef.current);
      navigateTimeoutRef.current = null;
    }
    navigateTimeoutRef.current = window.setTimeout(() => {
      setShouldNavigateToList(true);
      navigateTimeoutRef.current = null;
    }, delay);
  }, []);

  const createAbort = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { }
    }
    const ac = new AbortController();
    abortRef.current = ac;
    return ac.signal;
  }, []);

  const withAbort = useCallback(
    <T,>(p: Promise<T>) => {
      const ac = abortRef.current;
      if (!ac) return p;
      return new Promise<T>((resolve, reject) => {
        const onAbort = () => {
          const err = new Error("Aborted");
          (err as any).name = "AbortError";
          reject(err);
        };

        if (ac.signal.aborted) {
          onAbort();
          return;
        }

        ac.signal.addEventListener("abort", onAbort, { once: true });

        p.then((v) => {
          ac.signal.removeEventListener("abort", onAbort);
          resolve(v);
        }).catch((err) => {
          ac.signal.removeEventListener("abort", onAbort);
          reject(err);
        });
      });
    },
    []
  );

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: normalizeLLMText(`👋 Hi, I’m FabricAI! I can help you with:
- 📤 Uploading fabric images and audio
- 📝 Giving short or long analysis
- 🔍 Searching for similar images
- 🔁 Regenerating and comparing results`),
        },
      ]);
    }
  }, [messages.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingAction, currentResponse]);

  const validateImageFile = useCallback(async (file: File) => {
    try {
      const form = new FormData();
      form.append("image", file);
      const resp = await fetch(`${FULL_API_URL}/validate-image`, { method: "POST", body: form });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { ok: false, reason: `Validation service error: ${resp.status} ${txt}` };
      }

      const json = await resp.json().catch(() => ({}));
      if (json && json.valid) return { ok: true };
      if (json && typeof json.reason === "string") return { ok: false, reason: json.reason };
      return { ok: false, reason: "Image did not pass fabric validation." };
    } catch (err: any) {
      console.error("validateImageFile error:", err);
      return { ok: false, reason: err?.message || "Validation request failed" };
    }
  }, []);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (uploadedPreviewUrl) {
        try { URL.revokeObjectURL(uploadedPreviewUrl); } catch { }
      }

      setStatus("sending");
      setError("");

      try {
        const res = await validateImageFile(file);
        if (!res.ok) {
          setStatus("idle");
          setError(res.reason || "Image validation failed. Please try another close-up fabric photo.");
          setUploadedImageFile(null);
          setUploadedPreviewUrl(null);
          return;
        }

        setUploadedImageFile(file);
        const url = URL.createObjectURL(file);
        setUploadedPreviewUrl(url);
        setStatus("idle");
        setError("");
      } catch (err: any) {
        console.error("handleImageUpload error:", err);
        setStatus("idle");
        setError(err?.message || "Failed to upload image for validation.");
      }
    },
    [uploadedPreviewUrl, validateImageFile]
  );

  const handleAudioUpload = useCallback(
    (file: File) => {
      if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
      setUploadedAudioFile(file);
      setUploadedAudioUrl(URL.createObjectURL(file));
    },
    [uploadedAudioUrl]
  );

  const getModeFromText = useCallback((text: string | undefined | null): "short" | "long" => {
    if (!text) return "short";
    const s = String(text).toLowerCase();
    if (/\blong\b|\bdetailed\b|\bfull\b|\bin-depth\b|\bextended\b|\bcomprehensive\b/.test(s)) return "long";
    if (/\bshort\b|\bbrief\b|\bsummary\b|\bconcise\b|\bquick\b/.test(s)) return "short";
    return "short";
  }, []);

  const clearImage = useCallback(() => {
    setUploadedImageFile(null);
    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl);
    setUploadedPreviewUrl(null);
  }, [uploadedPreviewUrl]);

  const clearAudio = useCallback(() => {
    setUploadedAudioFile(null);
    if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
    setUploadedAudioUrl(null);
  }, [uploadedAudioUrl]);

  const fileToBase64 = useCallback((file: File): Promise<{ base64: string; dataUrl: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        if (comma === -1) {
          resolve({ base64: result, dataUrl: result });
          return;
        }
        const dataUrl = result;
        const base64 = result.slice(comma + 1);
        resolve({ base64, dataUrl });
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleResponse = useCallback((res: ChatResponse) => {
    setMessages(prev => {
      let next = [...prev];

      const bots = Array.isArray(res.bot_messages) ? res.bot_messages : [];
      if (bots.length) next.push(...bots.map(txt => ({ role: "assistant", content: normalizeLLMText(txt) })));
      else if (res.reply) next.push({ role: "assistant", content: normalizeLLMText(res.reply.content) });

      const action = (res as any).action;
      const actionType = action?.type;
      const raw = (res as any).analysis_responses || [];
      const hasCache = Boolean(action?.params?.cache_key);

      const normalized = raw.map((r: any, i: number) => ({
        id: hasCache ? String(i + 1) : String(r.id ?? `r${i}`),
        text: r.text ?? r.content ?? String(r),
      }));

      if (
        (actionType === "redirect_to_analysis" || actionType === "redirect_to_media_analysis") &&
        normalized.length > 0
      ) {
        const firstText = normalizeLLMText(normalized[0].text);

        const lastAssistant = next.slice().reverse().find(m => m.role === "assistant");
        const alreadyIncluded =
          bots.includes(firstText) ||
          (lastAssistant && lastAssistant.content === firstText);

        if (!alreadyIncluded) next.push({ role: "assistant", content: firstText });

        setCurrentResponse(firstText);
        setPendingAction({
          action,
          analysis_responses: normalized.map(r => ({ ...r, text: normalizeLLMText(r.text) })),
          used_ids: [normalized[0].id],
        });
      } else {
        setPendingAction(null);
      }
      return next;
    });
  }, []);

  const acceptAction = useCallback(() => {
    if (!pendingAction) return;
    setMessages(prev => [...prev, { role: "assistant", content: "Great — glad that helped!" }]);
    setPendingAction(null);
  }, [pendingAction]);

  const rejectAction = useCallback(async () => {
    if (!pendingAction) return;

    const { action } = pendingAction;
    const cacheKey = action?.params?.cache_key;
    const imageUrl = action?.params?.image_url;
    const mode = action?.params?.mode || "short";

    if (!cacheKey) {
      setMessages(prev => [...prev, { role: "assistant", content: "No cache_key found." }]);
      return;
    }
    const instr = `Regenerate: cache_key=${cacheKey} image_url=${imageUrl} mode=${mode}`;

    try {
      createAbort();
      const regenChatRes = await withAbort(
        chatOnce([...messages, { role: "user", content: instr }] as any)
      );

      let responseText: string | null = null;

      if ((regenChatRes as any)?.response) {
        responseText =
          (regenChatRes as any).response.response ??
          (regenChatRes as any).response.text ??
          (regenChatRes as any).response.message ??
          String((regenChatRes as any).response);
      } else if ((regenChatRes as any)?.analysis_responses?.[0]) {
        responseText = (regenChatRes as any).analysis_responses[0].text;
      } else if ((regenChatRes as any)?.bot_messages?.[0]) {
        responseText = (regenChatRes as any).bot_messages[0];
      } else if ((regenChatRes as any)?.reply?.content) {
        responseText = (regenChatRes as any).reply.content;
      } else {
        responseText = String(regenChatRes);
      }

      const clean = normalizeLLMText(responseText);

      if (!clean) {
        setMessages(prev => [...prev, { role: "assistant", content: "No new alternative available." }]);
        setPendingAction(null);
        return;
      }

      if (clean.toLowerCase().includes("all cached alternatives") ||
        clean.toLowerCase().includes("no more") ||
        clean.toLowerCase().includes("finished")) {
        setMessages(prev => [...prev, { role: "assistant", content: clean }]);
        setPendingAction(null);
        return;
      }

      setMessages(prev => [...prev, { role: "assistant", content: clean }]);
      setCurrentResponse(clean);
    } catch (err: any) {
      console.error("[rejectAction error]", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Failed to get a new alternative." }]);
    } finally {
      if (abortRef.current) abortRef.current = null;
    }
  }, [pendingAction, messages, createAbort, withAbort]);

  const searchSimilar = useCallback(async (k: number, min_sim = 0.5) => {
    if (!uploadedImageFile) {
      setError("No image uploaded to search with.");
      return null;
    }
    try {
      createAbort();
      setIsGenerating(true);
      setStatus("sending");
      setError("");
      const { base64, dataUrl } = await fileToBase64(uploadedImageFile);

      const form = new FormData();
      form.append("image", uploadedImageFile);
      const upResp = await withAbort(fetch(`${FULL_API_URL}/uploads/tmp_media`, { method: "POST", body: form }),);
      if (!upResp.ok) {
        const t = await upResp.text().catch(() => "");
        throw new Error(`Upload failed: ${upResp.status} ${t}`);
      }
      const upJson = await upResp.json();
      const imageUrl = upJson.image_url;
      console.log("[searchSimilar] uploaded image, imageUrl:", imageUrl);

      if (!imageUrl) {
        console.warn("[searchSimilar] no image_url returned from upload - falling back to base64 search via /search endpoint");
        const args = {
          image_b64: base64,
          k: Number(k) || 1,
          min_sim: Number(min_sim),
          order: "recent",
          require_audio: false,
        };
        const searchResp = await withAbort(fetch(`${FULL_API_URL}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        }));
        if (!searchResp.ok) throw new Error(`Search failed: ${searchResp.status}`);
        const mcpResult = await searchResp.json();
        const payload = {
          createdAt: Date.now(),
          k: args.k,
          min_sim: args.min_sim,
          queryPreview: dataUrl,
          results: mcpResult.results ?? [],
        };
        try { sessionStorage.setItem("mcp_last_search", JSON.stringify(payload)); } catch (err) { console.warn("sessionStorage set failed", err); }
        return payload;
      }

      const searchInstruction = `Search similar images: image_url=${imageUrl} k=${k} min_sim=${min_sim} order=recent require_audio=false`;
      const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: searchInstruction }] as any));
      console.log("[searchSimilar] chatRes:", chatRes);

      const results = (chatRes as any).analysis_responses ?? (chatRes as any).results ?? (chatRes as any).bot_messages ?? [];
      const payload = {
        createdAt: Date.now(),
        k: Number(k) || 1,
        min_sim: Number(min_sim),
        queryPreview: dataUrl,
        results: Array.isArray(results) ? results : [],
      };

      try { sessionStorage.setItem("mcp_last_search", JSON.stringify(payload)); } catch (err) { console.warn("sessionStorage set failed", err); }
      return payload;
    } catch (err: any) {
      if ((err as any)?.name === "AbortError") {
        console.log("[searchSimilar] aborted");
      } else {
        console.error("[searchSimilar] error:", err);
        setError(err?.message || "Search failed");
      }
      return null;
    } finally {
      setIsGenerating(false);
      setStatus("idle");
      if (abortRef.current) abortRef.current = null;
    }
  }, [uploadedImageFile, fileToBase64, withAbort, createAbort, chatOnce, messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if ((!text && !uploadedImageFile && !uploadedAudioFile) || status === "sending") return;

    createAbort();

    setStatus("sending");
    setIsGenerating(true);
    setError("");

    if (text) setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");

    try {
      const searchIntentMatch = text.match(/^\s*search\s+similar\s+images\b/i);
      if (searchIntentMatch) {
        const kMatch = text.match(/k\s*[:=]?\s*(\d+)/i) || text.match(/\(\s*k\s*=\s*(\d+)\s*\)/i);
        const k = kMatch ? Math.max(1, Math.min(300, Number(kMatch[1]))) : 3;

        console.log("[send] Detected search intent. calling searchSimilar with k=", k);

        const payload = await searchSimilar(k);

        if (payload) {
          console.log("[send] searchSimilar completed, navigating to /search");
          setMessages(prev => [...prev, { role: "assistant", content: "Thanks — preparing your search and redirecting to results now…" }]);
          setStatus("idle");
          setIsGenerating(false);
          if (abortRef.current) abortRef.current = null;
          window.setTimeout(() => { window.location.href = "/search"; }, 2000);
          return;
        } else {
          console.warn("[send] searchSimilar returned null/failed");
          setStatus("idle");
          setIsGenerating(false);
          if (abortRef.current) abortRef.current = null;
          setMessages(prev => [...prev, { role: "assistant", content: "Search did not start (see console). Please try again." }]);
          return;
        }
      }

      if (uploadedImageFile || uploadedAudioFile) {
        const form = new FormData();
        if (uploadedImageFile) form.append("image", uploadedImageFile);
        if (uploadedAudioFile) form.append("audio", uploadedAudioFile);

        const filenameFromText = extractFilenameFromText(text);
        console.log("[DEBUG] extracted filename from text:", filenameFromText);
        if (filenameFromText) {
          form.append("filename", filenameFromText);
          setFileName(filenameFromText);
        }

        try {
          const formDebug: Record<string, any> = {};
          for (const pair of (Array.from(form.entries()) as [string, any][])) {
            const k = pair[0];
            const v = pair[1];
            if (v && typeof v === "object" && typeof v.name === "string") {
              formDebug[k] = { filename: v.name, type: v.type || "unknown", size: v.size ?? "?" };
            } else {
              formDebug[k] = String(v);
            }
          }
          console.log("[DEBUG] Upload FormData prepared:", formDebug);
        } catch (ex) {
          console.warn("[DEBUG] Could not enumerate FormData for debug:", ex);
        }

        console.log("[DEBUG] uploading to /uploads/tmp_media (filenameFromText):", filenameFromText);
        const upResp = await withAbort(fetch(`${FULL_API_URL}/uploads/tmp_media`, { method: "POST", body: form }),);
        if (!upResp.ok) {
          const t = await upResp.text().catch(() => "");
          throw new Error(`Upload failed: ${upResp.status} ${t}`);
        }
        const upJson = await upResp.json();
        console.log("[DEBUG] upload response upJson:", upJson);

        const finalBasename = (filenameFromText && filenameFromText.trim().length > 0)
          ? filenameFromText.trim()
          : (upJson && (upJson.basename ?? upJson.filename) ? (upJson.basename ?? upJson.filename) : null);
        console.log("[DEBUG] finalBasename to use:", finalBasename);
        const hasAudio = Boolean(upJson.audio_url) || Boolean(uploadedAudioFile);
        const imageUrl = upJson.image_url;
        const audioUrl = upJson.audio_url;
        console.log("Image uploaded, imageUrl:", imageUrl, "audioUrl:", audioUrl);

        if (hasAudio) {
          const toolArgs: any = { image_url: imageUrl, audio_url: audioUrl };
          if (finalBasename) toolArgs.filename = finalBasename;
          console.log("[DEBUG] routing media analysis via /chat with args:", toolArgs);

          const mediaMsgParts = [];
          if (toolArgs.image_url) mediaMsgParts.push(`image_url=${toolArgs.image_url}`);
          if (toolArgs.audio_url) mediaMsgParts.push(`audio_url=${toolArgs.audio_url}`);
          if (toolArgs.filename) mediaMsgParts.push(`filename=${toolArgs.filename}`);
          const mediaInstruction = `Analyze media: ${mediaMsgParts.join(" ")}`;

          const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: mediaInstruction }] as any));
          console.log("[DEBUG] chatRes (media analysis):", chatRes);

          handleResponse({
            reply: { role: "assistant", content: "Media uploaded and queued." },
            bot_messages: (chatRes as any).bot_messages || [],
            action: (chatRes as any).action,
            analysis_responses: (chatRes as any).analysis_responses,
          } as any);

          setMessages(prev => [...prev, { role: "assistant", content: "Thanks — your media has been uploaded. Redirecting you to the view page…" }]);
          scheduleNavigateToList();
        } else {
          const wantsAnalysis = /(?:\banalyz(?:e|ing|ed)\b|\banalyse\b|\binspect\b|\binspect(?:ion)?\b|\bscan\b)/i.test(text);
          if (wantsAnalysis && imageUrl) {
            const mode = getModeFromText(text);
            console.log("[DEBUG] routing analysis via /chat with image_url and mode:", { imageUrl, mode });

            const analysisInstruction = `Analyze image: image_url=${imageUrl} mode=${mode}`;
            const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: analysisInstruction }] as any));
            console.log("[DEBUG] chatRes (analysis):", chatRes);

            handleResponse({
              reply: { role: "assistant", content: `Image uploaded and ${mode} analysis started.` },
              bot_messages: (chatRes as any).bot_messages || [],
              action: (chatRes as any).action,
              analysis_responses: (chatRes as any).analysis_responses,
            } as any);
          } else {
            const toolArgs: any = { image_url: imageUrl, audio_url: null };
            if (finalBasename) toolArgs.filename = finalBasename;
            console.log("[DEBUG] routing no-audio media via /chat with args:", toolArgs);

            const mediaMsgParts = [];
            if (toolArgs.image_url) mediaMsgParts.push(`image_url=${toolArgs.image_url}`);
            if (toolArgs.filename) mediaMsgParts.push(`filename=${toolArgs.filename}`);
            const mediaInstruction = `Analyze media: ${mediaMsgParts.join(" ")}`;

            const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: mediaInstruction }] as any));
            console.log("[DEBUG] chatRes (no-audio):", chatRes);

            handleResponse({
              reply: { role: "assistant", content: "Image uploaded and queued for processing." },
              bot_messages: (chatRes as any).bot_messages || [],
              action: (chatRes as any).action,
              analysis_responses: (chatRes as any).analysis_responses,
            } as any);
          }
        }

        clearImage();
        clearAudio();
        setStatus("idle");
        if (abortRef.current) {
          abortRef.current = null;
        }
        return;
      }

      const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: text }] as any));
      handleResponse(chatRes);
      setStatus("idle");
      if (abortRef.current) abortRef.current = null;
    } catch (e: any) {
      if ((e as any)?.name === "AbortError" || e?.message === "Aborted") {
        setStatus("idle");
        setError("");
      } else {
        setStatus("error");
        setError(e?.message || "Something went wrong.");
      }
    } finally {
      setIsGenerating(false);
      if (abortRef.current) abortRef.current = null;
    }
  }, [
    input, messages, uploadedImageFile, uploadedAudioFile, status,
    handleResponse, clearImage, clearAudio, createAbort, withAbort,
    chatOnce, extractFilenameFromText, scheduleNavigateToList, getModeFromText, searchSimilar
  ]);

  const retryLast = useCallback(async () => {
    if (status === "sending" || messages.length === 0) return;

    createAbort();
    setStatus("sending");
    setError("");
    try {
      const res = await withAbort(chatOnce(messages));
      handleResponse(res);
      setStatus("idle");
    } catch (e: any) {
      if ((e as any)?.name === "AbortError") {
        setStatus("idle");
        setError("");
      } else {
        setStatus("error");
        setError(e?.message || "Something went wrong.");
      }
    } finally {
      if (abortRef.current) abortRef.current = null;
    }
  }, [messages, status, handleResponse, createAbort, withAbort]);

  const newChat = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { }
      abortRef.current = null;
    }

    setMessages([]);
    setInput("");
    setStatus("idle");
    setError("");
    clearImage();
    clearAudio();
    setPendingAction(null);
    setCurrentResponse(null);
  }, [clearImage, clearAudio]);

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
    uploadedAudioUrl,
    uploadedAudioFile,
    handleImageUpload,
    handleAudioUpload,
    clearImage,
    clearAudio,
    pendingAction,
    acceptAction,
    rejectAction,
    currentResponse,
    fileName, setFileName,
    shouldNavigateToList, setShouldNavigateToList,
    searchSimilar,
  };
}
