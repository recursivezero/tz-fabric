import "@/assets/styles/Notification.css";

interface NotificationProps {
  message: string;
  type: "success" | "error";
}

export const Notification = ({ message, type }: NotificationProps) => {
  return <div className={`notification ${type}`}>{message}</div>;
}
