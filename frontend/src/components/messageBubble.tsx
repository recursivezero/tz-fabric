// MessageBubble.tsx
import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { type Message } from "../services/chat_api";
import useTypingEffect from "../utils/typingEffect";
import { normalizeMarkdown } from "../utils/normalizeMarkdown";

type Props = Pick<Message, "role" | "content">;

export default function MessageBubble({ role, content }: Props) {
  // user bubble (no markdown)
  if (role === "user") {
    return (
      <div className="msg-row right">
        <div className="bubble user">{content}</div>
      </div>
    );
  }
  const normalized = useMemo(() => normalizeMarkdown(content ?? ""), [content]);
  const typed = useTypingEffect(normalized, 25);

  return (
    <div className="msg-row left">
      <div className="assistant-block">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{typed ?? ""}</ReactMarkdown>
      </div>
    </div>
  );
}
