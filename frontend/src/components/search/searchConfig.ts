import { BASE_URL, FULL_API_URL } from "../../constants";

export const MIN_CROP_SIZE = 40;

export const CATEGORIES = [
  { id: "stock", label: "Stock", icon: "📦" },
  { id: "fabric", label: "Fabric", icon: "🧵" },
  { id: "design", label: "Design", icon: "🎨" },
  { id: "product", label: "Product", icon: "🖼️" },
];

export const API_BASE = FULL_API_URL;
export const ASSET_BASE = BASE_URL;
export const CDN_BASE = (import.meta.env.VITE_AWS_PUBLIC_URL ?? "https://cdn.threadzip.com").replace(/\/$/, "");
export const USER_FRIENDLY_SERVER_ERROR = "Unable to connect to the server, please try after some time.";
