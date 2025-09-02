import { type Message } from "../services/chat_api";
import useTypingEffect from "../utils/typingEffect";
import { normalizeMarkdown } from "../utils/normalizeMarkdown";
import ReactMarkdown from "react-markdown";

type Props = Pick<Message, "role" | "content">;

export default function MessageBubble({ role, content }: Props) {
  if (role === "user") {
    return (
      <div className="msg-row right">
        <div className="bubble user">{content}</div>
      </div>
    );
  }
  const normalized = normalizeMarkdown(content);
  const typed = useTypingEffect(normalized, 25);

  return (
    <div className="msg-row left">
      <div className="assistant-block">
        <ReactMarkdown>{typed}</ReactMarkdown>
      </div>
    </div>
  );
}
