export const BASE_URL = import.meta.env.VITE_API_URL;
export const API_PREFIX = import.meta.env.VITE_API_PREFIX; // New environment variable
export const FULL_API_URL = `${BASE_URL}${API_PREFIX}`

export const API_BASE = (import.meta.env.VITE_API_URL ?? "") + (import.meta.env.VITE_API_PREFIX ?? "");


console.log("before import meta", { BASE_URL, API_BASE, FULL_API_URL });


if (import.meta.env.DEV) {
  // code inside here will be tree-shaken in production builds
  console.log('Dev mode');
  console.log({BASE_URL, API_PREFIX})
}


export const NAVBAR_MENU = [
  { name: "home", path: "/" },
  { name: "analysis", path: "/analysis" },
  { name: "upload", path: "/upload" },
  { name: "list", path: "/view" },
  { name: "search", path: "/search" },
  { name: "chat", path: "/chat" },
  { name: "reader", path: "/reader" },
  { name: "about", path: "/about", enable: false },

];


export const CATEGORIES = [
  { id: "stock", label: "Stock", icon: "📦" },
  { id: "fabric", label: "Fabric", icon: "🧵" },
  { id: "design", label: "Design", icon: "🎨" },
  { id: "product", label: "Product", icon: "🖼️" },
];

