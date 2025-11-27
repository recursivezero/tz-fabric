import "../styles/Notification.css";

interface NotificationProps {
  message: string;
  type: "success" | "error";
}

export default function Notification({ message, type }: NotificationProps) {
  return <div className={`notification ${type}`}>{message}</div>;
}
