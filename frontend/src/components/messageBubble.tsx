import { type Message } from "../services/chat_api";

type Props = Pick<Message, "role" | "content">;

export default function MessageBubble({ role, content }: Props) {
  const isUser = role === "user";
  return (
    <div className={`chat-bubble ${isUser ? "user" : "bot"}`}>
      <div className="bubble">{content}</div>
    </div>
  );
}
