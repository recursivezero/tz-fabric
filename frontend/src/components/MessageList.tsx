import type { RefObject } from "react";
import type { Message } from "../services/chat_api";
import MessageBubble from "./MessageBubble";
import "../styles/Messages.css";

interface Props {
  messages: Message[];
  scrollerRef: RefObject<HTMLDivElement>;
}

type MaybeMedia = {
  type?: "text" | "image" | "audio";
  url?: string;
  filename?: string;
};

export default function MessageList({ messages, scrollerRef }: Props) {
  return (
    <div className="chat-list" ref={scrollerRef}>
      <div className="content-col">
        {messages.map((m, i) => {
          const role = m.role ?? "assistant";
          const content = m.content ?? "";

          let type: MaybeMedia["type"];
          let url: MaybeMedia["url"];
          let filename: MaybeMedia["filename"];

          if ("type" in m) type = (m as { type?: MaybeMedia["type"] }).type;
          if ("url" in m) url = (m as { url?: string }).url;
          if ("filename" in m) filename = (m as { filename?: string }).filename;

          return (
            <MessageBubble
              key={i}
              role={role}
              content={content}
              type={type}
              url={url}
              filename={filename}
            />
          );
        })}
      </div>
    </div>
  );
}
