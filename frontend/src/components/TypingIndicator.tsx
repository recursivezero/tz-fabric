type Props = { text?: string };
export default function TypingIndicator({ text }: Props) {
  return <div className="typing">{text ?? "Bot is thinking…"}</div>;
}