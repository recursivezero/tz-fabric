export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api/v1"; // New environment variable
export const FULL_API_URL = `${BASE_URL}${API_PREFIX}`


export const NAVBAR_MENU = [
  { name: "home", path: "/" },
  { name: "analysis", path: "/analysis" },
  { name: "upload", path: "/upload" },
  { name: "list", path: "/view" },
  { name: "search", path: "/search" },
  { name: "chat", path: "/chat" },
  { name: "generate", path: "/generate" },
  { name: "fabric-gen", path: "/fabric-gen" },
  { name: "about", path: "/about", enable: false },
];

