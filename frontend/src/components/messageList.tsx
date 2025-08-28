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
      {messages.map((m, i) => (
        <MessageBubble key={i} role={m.role} content={m.content} />
      ))}
    </div>
  );
}
