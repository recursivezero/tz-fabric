import { useMemo } from "react";
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
  try {
    const u = new URL(s);
    return !!u.protocol;
  } catch {
    return false;
  }
};

const isImageUrl = (s?: string) => {
  if (!s) return false;
  const lower = s.toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/.test(lower) || lower.startsWith("data:image/");
};

const isAudioUrl = (s?: string) => {
  if (!s) return false;
  const lower = s.toLowerCase();
  return /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/.test(lower) || lower.startsWith("data:audio/");
};

export default function MessageBubble({ role, content, type, url, filename }: Props) {
  const explicitType = type;
  const explicitUrl = url;

  const possibleUrl = explicitUrl ?? (looksLikeUrl(content) ? String(content) : undefined);

  let renderType: "image" | "audio" | "text" = "text";
  if (explicitType === "image" || (possibleUrl && isImageUrl(possibleUrl))) renderType = "image";
  else if (explicitType === "audio" || (possibleUrl && isAudioUrl(possibleUrl))) renderType = "audio";

  // --- Hooks must be called unconditionally (always) ---
  const normalized = useMemo(
    () => normalizeMarkdown(String(content ?? "")),
    [content]
  );

  const shouldType = renderType === "text" && role !== "user";
  const typed = useTypingEffect(shouldType ? normalized : "", 25);
  // -----------------------------------------------------

  if (renderType === "text") {
    if (role === "user") {
      return (
        <div className="msg-row right">
          <div className="bubble user">{content}</div>
        </div>
      );
    }
    // assistant text
    return (
      <div className="msg-row left">
        <div className="assistant-avatar">🤖</div>
        <div className="assistant-block">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {shouldType ? (typed ?? "") : normalized}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  if (renderType === "image") {
    const src = String(possibleUrl ?? content);
    return (
      <div className={`msg-row ${role === "user" ? "right" : "left"}`}>
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

  // audio
  const src = String(possibleUrl ?? content);
  return (
    <div className={`msg-row ${role === "user" ? "right" : "left"}`}>
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
