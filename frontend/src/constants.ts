import { logger } from "@/utils/logger";

const rawBaseUrl = import.meta.env.VITE_API_URL;
const rawApiPrefix = import.meta.env.VITE_API_PREFIX;
const useDirectApiInDev = import.meta.env.VITE_USE_DIRECT_API === "true";

function normalizeBaseUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return "";
  return trimmed.replace(/\/$/, "");
}

function normalizeApiPrefix(value: unknown): string {
  if (typeof value !== "string") return "/api/v1";
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return "/api/v1";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/$/, "");
}

// In Vite dev, same-origin /api/v1 calls are safer because vite.config.ts
// proxies them to the backend. This avoids stale .env files pointing to the
// wrong port. Set VITE_USE_DIRECT_API="true" only if you intentionally want
// the browser to call VITE_API_URL directly in development.
export const BASE_URL = import.meta.env.DEV && !useDirectApiInDev
  ? ""
  : normalizeBaseUrl(rawBaseUrl);
export const API_PREFIX = normalizeApiPrefix(rawApiPrefix);
export const FULL_API_URL = `${BASE_URL}${API_PREFIX}`;

logger.debug("API configuration resolved", {
  baseUrl: BASE_URL || "same-origin",
  apiPrefix: API_PREFIX,
  fullApiUrl: FULL_API_URL,
});

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
