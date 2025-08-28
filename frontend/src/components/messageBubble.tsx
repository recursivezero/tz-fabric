import { type Message } from "../services/chat_api";

type Props = Pick<Message, "role" | "content">;

export default function MessageBubble({ role, content }: Props) {
  if (role === "user") {
    return (
      <div className="msg-row right">
        <div className="bubble user">{content}</div>
      </div>
    );
  }

  return (
    <div className="msg-row left">
      <div className="assistant-block">{content}</div>
    </div>
  );
}
