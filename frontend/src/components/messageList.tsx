import { type RefObject } from "react";
import { type Message } from "../services/chat_api";
import MessageBubble from "./messageBubble";

interface Props {
  messages: Message[];
  scrollerRef: RefObject<HTMLDivElement>;
}

export default function MessageList({ messages, scrollerRef }: Props) {
  return (
    <div className="chat-list" ref={scrollerRef}>
      <div className="content-col">
        {messages.map((m, i) => {
          // Support older Message shape (role, content) and also extended shapes
          const role = (m as any).role ?? "assistant";
          const content = (m as any).content ?? "";
          const type = (m as any).type as any;
          const url = (m as any).url as string | undefined;
          const filename = (m as any).filename as string | undefined;

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
