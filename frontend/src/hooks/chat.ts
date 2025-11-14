import { useCallback, useEffect, useRef, useState } from "react";
import { chatOnce, type Message, type ChatResponse } from "../services/chat_api";
import { FULL_API_URL } from "../constants";
import { extractFilenameFromText } from "../utils/extractFilenameFromText";

type Status = "idle" | "sending" | "error" | "validating";

type AnalysisItem = { id?: string; text?: string; content?: string };
type ToolActionParams = {
  cache_key?: string;
  image_url?: string;
  audio_url?: string | null;
  filename?: string;
  mode?: "short" | "long" | string;
  [k: string]: unknown;
};
type ToolAction = { type: string; params?: ToolActionParams };

type RichChatResponse = ChatResponse & Partial<{
  bot_messages: string[];
  action: ToolAction;
  analysis_responses: AnalysisItem[];
  results: unknown[];
}>;

const normalizeLLMText = (t: unknown): string => {
  if (t == null) return "";
  if (typeof t === "object") {
    const o = t as Record<string, unknown>;
    const inner =
      (o.response as Record<string, unknown> | undefined)?.response ??
      (o.response as Record<string, unknown> | undefined)?.text ??
      (o.response as Record<string, unknown> | undefined)?.message ??
      o.response ?? o.text ?? o.message ?? null;
    if (inner != null) return normalizeLLMText(inner);
    try { return JSON.stringify(t); } catch { return String(t); }
  }
  let s = String(t).trim();
  s = s.replace(/\\n/g, "\n").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n");
  return s.trim();
};

const PRESET_QA: Record<string, string> = {
  "explain knit vs woven .": `Here’s the quick difference:

• Knit: Made by interlocking loops (like T-shirts, hoodies).
  - Feel: Stretchy, soft, drapes well.
  - Edge: Doesn’t fray easily, curls at edges.

• Woven: Two yarn sets (warp & weft) crossing at right angles (like shirts, jeans).
  - Feel: Usually less stretchy (unless elastane added), more structured.
  - Edge: Frays when cut.`,
  "how I can use FabricAI ": `Quick steps:
1) Upload a close-up fabric photo (texture visible).
2) Pick “Analyze (short)” for a quick overview or “Analyze (long)” for details.
3) Optional: Add audio to describe context (e.g., “This is cotton twill”).
4) Use “Search similar” to find nearest matches in your library.
Tip: Avoid full garments or backgrounds; close-up of weave/texture works best.`,
  "suggest tags for a denim fabric photo.": `Suggested tags:
• Material: Denim, Cotton, Indigo
• Construction: Twill, 3x1, Ring-spun
• Look: Faded, Raw, Distressed, Slub
• Weight: Mid-weight, Heavy
• Use: Jeans, Jacket, Workwear
Pick the 5–8 most relevant for clarity.`,
  "what is gsm in fabrics?": `GSM = Grams per Square Meter (fabric weight).
• Lower GSM (e.g., 120–160): lighter, airy (tees, summer).
• Mid GSM (180–240): everyday knits/wovens.
• Higher GSM (260+): heavier, warmer, more structured.
Rule of thumb: Higher GSM = thicker/denser, but fiber & weave also affect feel and drape.`,
};
const norm = (s: string) => (s || "").trim().toLowerCase();

export default function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [isFrontendTyping, setIsFrontendTyping] = useState(false);

useEffect(() => {
  const onStart = () => setIsFrontendTyping(true);
  const onEnd = () => setIsFrontendTyping(false);
  window.addEventListener("fabricai:typing-start", onStart);
  window.addEventListener("fabricai:typing-end", onEnd);
  return () => {
    window.removeEventListener("fabricai:typing-start", onStart);
    window.removeEventListener("fabricai:typing-end", onEnd);
  };
}, []);
  const [error, setError] = useState<string>("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const [currentResponse, setCurrentResponse] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    action: ToolAction;
    analysis_responses?: { id: string; text: string }[];
    used_ids?: string[];
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastMsgCountRef = useRef<number>(0);

  const pendingPresetRef = useRef<string | null>(null);
  const [morePrompt, setMorePrompt] = useState<{ question: string } | null>(null);
  const lastFollowedUpRef = useRef<string | null>(null); // prevents early/dup follow-ups

  const createAbort = useCallback(() => {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* ignore */ }
    }
    const ac = new AbortController();
    abortRef.current = ac;
    return ac.signal;
  }, []);

const stopGenerating = useCallback(() => {
  abortRef.current?.abort();
  window.dispatchEvent(new CustomEvent("fabricai:stop-typing"));
  setIsFrontendTyping(false);
}, []);


  const withAbort = useCallback(<T,>(p: Promise<T>) => {
    const ac = abortRef.current;
    if (!ac) return p;
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
      if (ac.signal.aborted) {
        onAbort(); return;
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
  }, []);

  // Show welcome only once per tab
  useEffect(() => {
    const seen = sessionStorage.getItem("fabricAI_welcome_seen");
    if (messages.length === 0 && !seen) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: normalizeLLMText(`👋 Hi, I’m FabricAI! I can help you with:
- 📤 Uploading fabric images and audio
- 📝 Giving short or long analysis
- 🔍 Searching for similar images
- 🔁 Regenerating and comparing results`),
      }]);
      sessionStorage.setItem("fabricAI_welcome_seen", "1");
    }
  }, [messages.length]);

  // Auto-scroll
  useEffect(() => {
    const prev = lastMsgCountRef.current;
    const curr = messages.length;
    if (curr !== prev) {
      const el = scrollerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
      lastMsgCountRef.current = curr;
    }
  });

  const errorMsg = useCallback(
    (err: unknown, fallback = "Something went wrong.") =>
      err instanceof Error ? err.message : (typeof err === "string" ? err : fallback),
    []
  );

  const validateImageFile = useCallback(async (file: File) => {
    const t0 = performance.now();
    try {
      const form = new FormData();
      form.append("image", file);
      const tForm = performance.now();

      const ac = new AbortController();
      const timeout = setTimeout(() => ac.abort(), 30000);

      const resp = await fetch(`${FULL_API_URL}/validate-image`, {
        method: "POST",
        body: form,
        signal: ac.signal,
      });
      clearTimeout(timeout);
      const tResp = performance.now();

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.log("[timing] form:", (tForm - t0).toFixed(0), "ms | request:", (tResp - tForm).toFixed(0), "ms");
        return { ok: false as const, reason: `Validation service error: ${resp.status} ${txt}` };
      }

      const json: unknown = await resp.json().catch(() => ({}));
      const tJson = performance.now();

      console.log("[timing] form:", (tForm - t0).toFixed(0), "ms | request:", (tResp - tForm).toFixed(0), "ms | json:", (tJson - tResp).toFixed(0), "ms");

      const valid = typeof json === "object" && json !== null && (json as { valid?: boolean }).valid === true;
      if (valid) return { ok: true as const };

      const reason = (json as { reason?: string }).reason;
      if (typeof reason === "string") return { ok: false as const, reason };
      return { ok: false as const, reason: "Image did not pass fabric validation." };
    } catch (err: unknown) {
      console.error("validateImageFile error:", err);
      return { ok: false as const, reason: errorMsg(err, "Validation request failed") };
    }
  }, [errorMsg]);

  const handleImageUpload = useCallback(async (file: File) => {
    if (uploadedPreviewUrl) {
      try { URL.revokeObjectURL(uploadedPreviewUrl); } catch { }
    }
    setStatus("validating");
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
    } catch (err: unknown) {
      console.error("handleImageUpload error:", err);
      setStatus("idle");
      setError(errorMsg(err, "Failed to upload image for validation."));
    }
  }, [uploadedPreviewUrl, validateImageFile, errorMsg]);

  const handleAudioUpload = useCallback((file: File) => {
    if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
    setUploadedAudioFile(file);
    setUploadedAudioUrl(URL.createObjectURL(file));
  }, [uploadedAudioUrl]);

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
          resolve({ base64: result, dataUrl: result }); return;
        }
        const dataUrl = result;
        const base64 = result.slice(comma + 1);
        resolve({ base64, dataUrl });
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const getAction = useCallback((r: RichChatResponse): ToolAction | undefined => r.action, []);
  const getAnalysis = useCallback(
    (r: RichChatResponse): AnalysisItem[] => Array.isArray(r.analysis_responses) ? r.analysis_responses : [],
    []
  );
  const getBots = useCallback(
    (r: RichChatResponse): string[] => Array.isArray(r.bot_messages) ? r.bot_messages : [],
    []
  );

  const handleResponse = useCallback((res: ChatResponse) => {
  const rc = res as RichChatResponse;

  setMessages(prev => {
    const next = [...prev];

    const bots = getBots(rc);
    if (bots.length) {
      next.push(...bots.map(txt => ({ role: "assistant", content: normalizeLLMText(txt) })));
    } else if (rc.reply) {
      next.push({ role: "assistant", content: normalizeLLMText(rc.reply.content) });
    }

    const action = getAction(rc);
    const raw = getAnalysis(rc);
    const hasCache = Boolean(action?.params?.cache_key);
    const normalized = raw.map((r, i) => ({
      id: hasCache ? String(i + 1) : String(r.id ?? `r${i}`),
      text: r.text ?? r.content ?? String(r ?? "")
    }));

    if (
      action &&
      (action.type === "redirect_to_analysis" || action.type === "redirect_to_media_analysis") &&
      normalized.length > 0
    ) {
      const firstText = normalizeLLMText(normalized[0].text);
      const lastAssistant = next.slice().reverse().find(m => m.role === "assistant");
      const alreadyIncluded =
        bots.includes(firstText) || (lastAssistant && lastAssistant.content === firstText);
      if (!alreadyIncluded) {
        next.push({ role: "assistant", content: firstText });
      }
      setCurrentResponse(firstText);
      setPendingAction({
        action,
        analysis_responses: normalized.map(r => ({ ...r, text: normalizeLLMText(r.text) })),
        used_ids: [normalized[0].id]
      });
    } else {
      setPendingAction(null);
    }

    // BACKEND DECIDES: ask_more
    if ((rc as any).ask_more === true) {
      const lastUser = prev.slice().reverse().find(m => m.role === "user")?.content || "";
      const lastAssistant = next.slice().reverse().find(m => m.role === "assistant")?.content || "";

      if (lastAssistant && lastFollowedUpRef.current !== lastAssistant) {
        lastFollowedUpRef.current = lastAssistant;
        next.push({ role: "assistant", content: "Would you like to know more about this?" });
        setMorePrompt({ question: String(lastUser) });
        pendingPresetRef.current = String(lastUser);
      }
    }

    return next;
  });
}, [getBots, getAction, getAnalysis]);


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
    const mode = (action?.params?.mode as ("short" | "long" | undefined)) || "short";

    if (!cacheKey) {
      setMessages(prev => [...prev, { role: "assistant", content: "No cache_key found." }]);
      return;
    }

    const instr = `Regenerate: cache_key=${cacheKey} image_url=${imageUrl} mode=${mode}`;

    const extractTextField = (val: any): string => {
      if (!val) return "";
      const s = String(
        (typeof val === "object" && ("text" in val || "response" in val)) ? JSON.stringify(val) : val
      );
      const key = "text=";
      const idx = s.indexOf(key);
      if (idx === -1) return s;
      let i = idx + key.length;
      while (i < s.length && s[i] === " ") i++;
      const quote = s[i];
      if (quote !== "'" && quote !== `"`) return s;
      let out = "", j = i + 1;
      while (j < s.length) {
        const ch = s[j];
        if (ch === "\\" && j + 1 < s.length) {
          out += s[j + 1];
          j += 2;
          continue;
        }
        if (ch === quote) break;
        out += ch;
        j++;
      }
      return out;
    };

    const extractDisplay = (raw: string): string => {
      const trimmed = raw.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const obj = JSON.parse(trimmed);
          if (typeof obj.display_text === "string") return obj.display_text;
          if (obj.response && typeof obj.response.response === "string") return obj.response.response;
          if (typeof obj.text === "string") return obj.text;
          if (typeof obj.message === "string") return obj.message;
        } catch { }
      }
      return raw;
    };

    try {
      createAbort();
      const regenChatRes = await withAbort(
        chatOnce([...messages, { role: "user", content: instr }])
      );
      const rc = regenChatRes as any;

      const raw = extractTextField(
        rc?.analysis_responses?.[0] ||
        rc?.response ||
        rc?.reply?.content ||
        rc?.bot_messages?.[0] ||
        regenChatRes
      );

      const clean = normalizeLLMText(extractDisplay(raw));

      if (!clean) {
        setMessages(prev => [...prev, { role: "assistant", content: "No new alternative available." }]);
        setPendingAction(null);
        return;
      }

      if (clean.toLowerCase().includes("cached")) {
        setMessages(prev => [...prev, { role: "assistant", content: clean }]);
        setPendingAction(null);
        return;
      }

      setMessages(prev => [...prev, { role: "assistant", content: clean }]);
      setCurrentResponse(clean);

    } catch (err) {
      console.error("[rejectAction error]", err);
      setMessages(prev => [...prev, { role: "assistant", content: "Failed to get a new alternative." }]);
    } finally {
      abortRef.current = null;
    }
  }, [pendingAction, messages, createAbort, withAbort]);

  const searchSimilar = useCallback(async (k: number, min_sim = 0.5) => {
    if (!uploadedImageFile) {
      setError("No image uploaded to search with.");
      return null;
    }
    try {
      createAbort();
      setStatus("sending");
      setError("");

      const { base64, dataUrl } = await fileToBase64(uploadedImageFile);

      const form = new FormData();
      form.append("image", uploadedImageFile);

      const upResp = await withAbort(fetch(`${FULL_API_URL}/uploads/tmp_media`, {
        method: "POST",
        body: form
      }));

      if (!upResp.ok) {
        const t = await upResp.text().catch(() => "");
        throw new Error(`Upload failed: ${upResp.status} ${t}`);
      }

      const upJson = (await upResp.json()) as Record<string, any>;
      const imageUrl = upJson.image_url;
      if (!imageUrl) {
        const args = {
          image_b64: base64,
          k: Number(k) || 1,
          min_sim: Number(min_sim),
          order: "recent" as const,
          require_audio: false,
        };

        const searchResp = await withAbort(fetch(`${FULL_API_URL}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        }));

        if (!searchResp.ok) throw new Error(`Search failed: ${searchResp.status}`);

        const json = await searchResp.json();
        const payload = {
          createdAt: Date.now(),
          k: args.k,
          min_sim: args.min_sim,
          imageUrl: null,
          queryPreview: dataUrl,
          results: json.results ?? [],
        };

        try { localStorage.setItem("mcp_last_search", JSON.stringify(payload)); } catch { }

        const qs = new URLSearchParams({ k: String(payload.k) }).toString();

        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: `Your search is ready. Would you like to open the results page? [Open Search Results](/search?${qs})`
          }
        ]);

        return payload;
      }

      const searchInstruction = `Search similar images: image_url=${imageUrl} k=${k} min_sim=${min_sim} order=recent require_audio=false`;
      const chatRes = await withAbort(
        chatOnce([...messages, { role: "user", content: searchInstruction }])
      );
      const rc = chatRes as any;

      const results = rc.analysis_responses ?? rc.results ?? rc.bot_messages ?? [];

      const payload = {
        createdAt: Date.now(),
        k: Number(k) || 1,
        min_sim: Number(min_sim),
        imageUrl,
        queryPreview: dataUrl,
        results: Array.isArray(results) ? results : []
      };

      try { localStorage.setItem("mcp_last_search", JSON.stringify(payload)); } catch { }

      const qs = new URLSearchParams({
        k: String(payload.k),
        image_url: payload.imageUrl
      }).toString();

      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: `Your search is ready. Would you like to open the results page? [Open Search Results](/search?${qs})`
        }
      ]);

      return payload;
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("[searchSimilar] error:", err);
        setError(errorMsg(err, "Search failed"));
      }
      return null;
    } finally {
      setStatus("idle");
      if (abortRef.current) abortRef.current = null;
    }
  }, [uploadedImageFile, fileToBase64, messages, withAbort, createAbort, errorMsg]);

  const send = useCallback(async (overrideText?: string, opts?: { forceApi?: boolean }) => {
    const raw = typeof overrideText === "string" ? overrideText : input;
    const text = raw.trim();
    const forceApi = Boolean(opts?.forceApi);

    if (status === "sending") {
      console.warn("[send] early return: status === 'sending'");
      return;
    }
    if (!text && !uploadedImageFile && !uploadedAudioFile) {
      console.warn("[send] early return: nothing to send (no text or media). raw:", JSON.stringify(raw));
      return;
    }

    if ((!text && !uploadedImageFile && !uploadedAudioFile) || status === "sending") return;

    if (!forceApi && pendingPresetRef.current && text) {
      const yesRegex = /\b(yes|yeah|yep|ya|sure|ok|okay|more|tell me more|details|go ahead)\b/i;
      if (yesRegex.test(text)) {
        const original = pendingPresetRef.current;
        pendingPresetRef.current = null;
        setMorePrompt(null);
        setMessages(prev => [...prev, { role: "assistant", content: "Great — fetching more details…" }]);
        await send(original, { forceApi: true });
        return;
      }
    }

    const presetAnswer = !forceApi ? PRESET_QA[norm(text)] : undefined;
    if (presetAnswer && !uploadedImageFile && !uploadedAudioFile) {
      setMessages(prev => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: presetAnswer },
      ]);
      pendingPresetRef.current = text;
      setInput("");
      setMorePrompt(null);
      lastFollowedUpRef.current = null;
      return;
    }

    createAbort();
    setStatus("sending");
    setError("");

    if (text) setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");

    try {
      const searchIntentMatch = text.match(/^\s*search\s+similar\s+images\b/i);
      if (searchIntentMatch) {
        const kMatch = text.match(/k\s*[:=]?\s*(\d+)/i) || text.match(/\(\s*k\s*=\s*(\d+)\s*\)/i);
        const k = kMatch ? Math.max(1, Math.min(300, Number(kMatch[1]))) : 3;
        const payload = await searchSimilar(k);
        if (payload) {
          setStatus("idle");
          if (abortRef.current) abortRef.current = null;
          return;
        } else {
          setStatus("idle");
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
        if (filenameFromText) {
          form.append("filename", filenameFromText);
          setFileName(filenameFromText);
        }

        try {
          try {
            const debug: Record<string, unknown> = {};
            for (const [k, v] of form.entries()) {
              if (v instanceof File) debug[k] = { name: v.name, type: v.type, size: v.size };
              else debug[k] = String(v);
            }
            console.log("[UPLOAD DEBUG]", debug);
          } catch { }

          const upResp = await withAbort(fetch(`${FULL_API_URL}/uploads/tmp_media`, {
            method: "POST",
            body: form
          }));
          if (!upResp.ok) {
            const t = await upResp.text().catch(() => "");
            throw new Error(`Upload failed: ${upResp.status} ${t}`);
          }

          const upJson = (await upResp.json()) as Record<string, unknown>;

          const imagePath = (upJson.image_path as string) || null;
          const audioPath = (upJson.audio_path as string) || null;

          const imageUrl = !imagePath ? (upJson.image_url as string | undefined) : undefined;
          const audioUrl = !audioPath ? (upJson.audio_url as string | undefined) : undefined;

          const finalBasename =
            (filenameFromText?.trim()?.length ? filenameFromText.trim() : null) ||
            (upJson.basename as string) ||
            (upJson.filename as string) ||
            "upload";

          const mode = getModeFromText(text);

          let mediaInstruction = "";
          if (imagePath) {
            if (!uploadedAudioFile && !upJson.audio_path && !upJson.audio_url) {
              mediaInstruction = `Analyze Image: image_path=${imagePath} filename=${finalBasename} mode=${mode}`;
            } else {
              mediaInstruction = `Analyze media: image_path=${imagePath} ${audioPath ? `audio_path=${audioPath}` : ""} filename=${finalBasename}`;
            }
          } else if (imageUrl) {
            if (!uploadedAudioFile && !upJson.audio_url) {
              mediaInstruction = `Analyze Image: image_url=${imageUrl} filename=${finalBasename} mode=${mode}`;
            } else {
              mediaInstruction = `Analyze media: image_url=${imageUrl} ${audioUrl ? `audio_url=${audioUrl}` : ""} filename=${finalBasename} `;
            }
          } else {
            throw new Error("Upload did not return a usable image.");
          }

          const chatRes = await withAbort(
            chatOnce([...messages, { role: "user", content: mediaInstruction }])
          );

          const rc = chatRes as RichChatResponse;
          handleResponse({
            reply: {
              role: "assistant", content: audioPath || audioUrl
                ? "Media uploaded and queued."
                : "Image uploaded and queued for processing."
            },
            bot_messages: rc.bot_messages || [],
            action: rc.action,
            analysis_responses: rc.analysis_responses,
          } as ChatResponse);

          if (audioPath || audioUrl) {
            setMessages(prev => [
              ...prev,
              { role: "assistant", content: "Files saved. Want to open the list page? [See your upload](/view)" }
            ]);
          }

          clearImage();
          clearAudio();
          setStatus("idle");
          if (abortRef.current) abortRef.current = null;
          return;
        } catch (err: unknown) {
          console.error("[upload→agent] error:", err);
          setStatus("error");
          setError(errorMsg(err, "Failed to upload/process media."));
        } finally {
          if (abortRef.current) abortRef.current = null;
        }
      }

      const chatRes = await withAbort(chatOnce([...messages, { role: "user", content: text }]));
      handleResponse(chatRes);
      setStatus("idle");
      if (abortRef.current) abortRef.current = null;
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatus("idle"); setError("");
      } else {
        setStatus("error"); setError(errorMsg(e, "Something went wrong."));
      }
    } finally {
      if (abortRef.current) abortRef.current = null;
    }
  }, [
    input, messages, uploadedImageFile, uploadedAudioFile, status,
    handleResponse, clearImage, clearAudio, createAbort, withAbort,
    getModeFromText, searchSimilar, errorMsg, setFileName
  ]);

  const onAssistantRendered = useCallback((lastAssistant: Message) => {
    const q = pendingPresetRef.current;
    if (!q || morePrompt) return;

    const expectedAnswer = PRESET_QA[norm(q)];
    if (!expectedAnswer) return;

    const rendered = String(lastAssistant.content ?? "").trim();
    const expected = expectedAnswer.trim();

    if (rendered === expected && lastFollowedUpRef.current !== expected) {
      lastFollowedUpRef.current = expected; // guard
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Would you like to know more about this?" }
      ]);
      setMorePrompt({ question: q });
    }
  }, [morePrompt]);

  const confirmMoreYes = useCallback(async () => {
    const q = pendingPresetRef.current;
    setMorePrompt(null);
    if (!q) return;
    pendingPresetRef.current = null;
    lastFollowedUpRef.current = null;
    setMessages(prev => [...prev, { role: "assistant", content: "Great — fetching more details…" }]);
    await send(q, { forceApi: true });
  }, [send]);

  const confirmMoreNo = useCallback(() => {
    pendingPresetRef.current = null;
    lastFollowedUpRef.current = null;
    setMorePrompt(null);
    setMessages(prev => [...prev, { role: "assistant", content: "Okay! Ask me anything else or upload an image when ready." }]);
  }, []);

  const retryLast = useCallback(async () => {
    if (status === "sending" || messages.length === 0) return;
    createAbort();
    setStatus("sending");
    setError("");
    try {
      const res = await withAbort(chatOnce(messages));
      handleResponse(res);
      setStatus("idle");
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatus("idle"); setError("");
      } else {
        setStatus("error"); setError(errorMsg(e, "Something went wrong."));
      }
    } finally {
      if (abortRef.current) abortRef.current = null;
    }
  }, [messages, status, handleResponse, createAbort, withAbort, errorMsg]);

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
    setMorePrompt(null);
    pendingPresetRef.current = null;
    lastFollowedUpRef.current = null;
  }, [clearImage, clearAudio]);

  const canStop = status === "sending";

  return {
    messages,
    input, setInput,
    status, error,
    send, retryLast, newChat,
    scrollerRef,
    uploadedPreviewUrl, uploadedAudioUrl, uploadedAudioFile,
    handleImageUpload, handleAudioUpload,
    clearImage, clearAudio,
    pendingAction, acceptAction, rejectAction,
    currentResponse,
    fileName, setFileName,
    searchSimilar,
    morePrompt, confirmMoreYes, confirmMoreNo,
    onAssistantRendered,
    isFrontendTyping,
stopGenerating,
  };
}
