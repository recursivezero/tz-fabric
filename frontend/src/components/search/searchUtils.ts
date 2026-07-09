import type { CropRect, ResultItem } from "./types";
import { API_BASE, ASSET_BASE, CDN_BASE, MIN_CROP_SIZE } from "./searchConfig";

export function clampCropRectToBounds(rect: CropRect, imgWidth: number, imgHeight: number): CropRect {
  if (imgWidth <= 0 || imgHeight <= 0) return rect;

  const maxW = Math.max(MIN_CROP_SIZE, imgWidth);
  const maxH = Math.max(MIN_CROP_SIZE, imgHeight);
  const w = Math.min(Math.max(MIN_CROP_SIZE, rect.w), maxW);
  const h = Math.min(Math.max(MIN_CROP_SIZE, rect.h), maxH);
  const x = Math.min(Math.max(0, rect.x), Math.max(0, imgWidth - w));
  const y = Math.min(Math.max(0, rect.y), Math.max(0, imgHeight - h));

  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
  };
}

export function toCdnUrl(src: string | undefined): string {
  if (!src) return "";

  const clean = String(src).trim();

  if (/^(https?:|blob:|data:)/i.test(clean)) {
    return clean;
  }

  if (clean.startsWith("/api/") || clean.startsWith("/assets/")) {
    return `${ASSET_BASE}${clean}`;
  }

  const normalized = clean.replace(/^\/+/, "");

  if (normalized.startsWith("images/")) {
    return `${CDN_BASE}/${normalized}`;
  }

  return `${CDN_BASE}/images/${normalized}`;
}

export function toResultItem(raw: string): ResultItem {
  const filename = raw.split("/").pop() ?? raw;
  return { imageSrc: raw, filename };
}

export function cleanName(filename: string): string {
  if (!filename) return "Fabric sample";

  const raw = decodeURIComponent(String(filename).split(/[?#]/)[0].split("/").pop() ?? filename).trim();
  const withoutExtension = raw.replace(/\.[^.]+$/, "");

  const normalized = withoutExtension
    // Drop backend storage timestamps / IDs, but keep the human filename prefix.
    .replace(/(?:[_\s-]?20\d{6}T\d{6})(?:[_\s-]?[a-z0-9]{4,})?$/i, "")
    .replace(/(?:[_\s-]?20\d{6})[_\s-]?\d{6}.*$/i, "")
    .replace(/[_\s-][a-f0-9]{5,}$/i, "")
    .replace(/\b\d{10,}\b/g, "")
    .replace(/^[a-f0-9]{6,}\s+/i, "")
    .replace(/^\d+(?:[\s_-]+\d+){1,}\s*/i, "")
    .replace(/[_-](?:copy|final|submitted)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const letters = (normalized.match(/[a-z]/gi) ?? []).length;
  const digits = (normalized.match(/\d/g) ?? []).length;
  const looksTechnical =
    !letters ||
    digits > letters ||
    /\b(?:single image|image|img|upload|submitted files?)\b/i.test(normalized) ||
    /^[a-f0-9]{6,}\b/i.test(normalized);

  if (looksTechnical) return "Fabric sample";

  const shortName = normalized.split(" ").slice(0, 3).join(" ");
  return shortName.replace(/\b\w/g, (char) => char.toUpperCase()) || "Fabric sample";
}

export async function callDbEndpoint(op: "create" | "update"): Promise<string> {
  const url =
    op === "create"
      ? `${API_BASE}/database/create/table`
      : `${API_BASE}/database/update/table`;
  const res = await fetch(url, { method: "PUT" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `Request failed (${res.status})`);
  return data?.message ?? "Done.";
}
