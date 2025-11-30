import { useMemo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { Message } from "../services/chat_api";
import useTypingEffect from "../utils/typingEffect";
import { normalizeMarkdown } from "../utils/normalizeMarkdown";

type Props = {
  role: Message["role"];
  content: Message["content"];
  type?: "text" | "image" | "audio";
  url?: string;
  filename?: string;
};

const looksLikeUrl = (s?: string) => {
  if (!s) return false;
  try { return !!new URL(s).protocol; } catch { return false; }
};

const isImageUrl = (s?: string) =>
  !!s && (/\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(s) || s.toLowerCase().startsWith("data:image/"));

const isAudioUrl = (s?: string) =>
  !!s && (/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(s) || s.toLowerCase().startsWith("data:audio/"));

export default function MessageBubble({ role, content, type, url, filename }: Props) {
  const explicitType = type;
  const explicitUrl = url;
  const possibleUrl = explicitUrl ?? (looksLikeUrl(content) ? String(content) : undefined);

  let renderType: "image" | "audio" | "text" = "text";
  if (explicitType === "image" || (possibleUrl && isImageUrl(possibleUrl))) renderType = "image";
  else if (explicitType === "audio" || (possibleUrl && isAudioUrl(possibleUrl))) renderType = "audio";

  const normalized = useMemo(() => normalizeMarkdown(String(content ?? "")), [content]);

  const shouldType = renderType === "text" && role !== "user";
  const typed = useTypingEffect(shouldType ? normalized : "", 25);

  // NEW: respect global stop so the bubble no longer reports "typing"
  const [externallyStopped, setExternallyStopped] = useState(false);
  useEffect(() => {
    const onStop = () => setExternallyStopped(true);
    window.addEventListener("fabricai:stop-typing", onStop);
    return () => window.removeEventListener("fabricai:stop-typing", onStop);
  }, []);
  // reset stopped flag when content changes (new message)
  useEffect(() => { setExternallyStopped(false); }, [normalized]);

  const isTyping = shouldType && typed !== normalized && !externallyStopped;

  // COPY BUTTON STATE
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    // reset copied flag on new content
    setCopied(false);
  }, [normalized]);

  const doCopy = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      // auto-clear after a short delay
      setTimeout(() => setCopied(false), 1300);
    } catch (err) {
      console.error("copy failed", err);
    }
  };

  if (renderType === "text") {
    if (role === "user") {
      return (
        <div className="msg-row right" data-typing="false">
          <div className="bubble user">{content}</div>
          <div className="user-avatar">🧑</div>
        </div>
      );
    }
    // assistant text bubble with copy button
    return (
      <div className="msg-row left" data-typing={isTyping ? "true" : "false"}>
        <div className="assistant-avatar">🤖</div>

        <div className="assistant-block assistant-block--with-copy">
          {/* copy button area */}
          <div className="assistant-block__controls">
            <button
              type="button"
              className={`copy-btn ${copied ? "copied" : ""}`}
              aria-label={copied ? "Copied" : "Copy reply"}
              onClick={() => doCopy(normalized)}
            >
              {copied ? "Copied!" : <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M433.941 65.941l-51.882-51.882A48 48 0 0 0 348.118 0H176c-26.51 0-48 21.49-48 48v48H48c-26.51 0-48 21.49-48 48v320c0 26.51 21.49 48 48 48h224c26.51 0 48-21.49 48-48v-48h80c26.51 0 48-21.49 48-48V99.882a48 48 0 0 0-14.059-33.941zM266 464H54a6 6 0 0 1-6-6V150a6 6 0 0 1 6-6h74v224c0 26.51 21.49 48 48 48h96v42a6 6 0 0 1-6 6zm128-96H182a6 6 0 0 1-6-6V54a6 6 0 0 1 6-6h106v88c0 13.255 10.745 24 24 24h88v202a6 6 0 0 1-6 6zm6-256h-64V48h9.632c1.591 0 3.117.632 4.243 1.757l48.368 48.368a6 6 0 0 1 1.757 4.243V112z"></path></svg>}
            </button>
          </div>

          <div className="assistant-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {shouldType ? (typed ?? "") : normalized}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  if (renderType === "image") {
    const src = String(possibleUrl ?? content);
    return (
      <div className={`msg-row ${role === "user" ? "right" : "left"}`} data-typing="false">
        {role === "assistant" && <div className="assistant-avatar">🤖</div>}
        <div className={`assistant-block ${role === "user" ? "user-block" : ""}`}>
          <div className="media-bubble image-bubble">
            <img src={src} alt={filename ?? "image"} className="chat-image" />
            {typeof content === "string" && !looksLikeUrl(content) && (
              <div className="image-caption">{content}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const src = String(possibleUrl ?? content);
  return (
    <div className={`msg-row ${role === "user" ? "right" : "left"}`} data-typing="false">
      {role === "assistant" && <div className="assistant-avatar">🤖</div>}
      <div className="assistant-block">
        <div className="media-bubble audio-bubble">
          <audio controls src={src} />
          {filename && <div className="media-filename">{filename}</div>}
        </div>
      </div>
    </div>
  );
}
