import { API_BASE } from '@/constants';
import type { ResultItem } from '@/types/common';

const CDN_BASE = import.meta.env.VITE_AWS_PUBLIC_URL ?? "";


export function cleanText(input: string): string {
  return input
    .replace(/[*_~`]/g, "")   
    .replace(/\\n/g, " ")     
    .replace(/\s+/g, " ")     
    .trim();
}

export const toCdnUrl = (src: string | undefined): string => {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  return `${CDN_BASE}/images/${src.replace(/^\/+/, "")}`;
};

export const toResultItem = (raw: string): ResultItem => {
  const filename = raw.split("/").pop() ?? raw;
  return { imageSrc: raw, filename };
};

export const cleanName = (filename: string): string => {
  return filename ? filename.split("_")[0].split(".")[0] : "";
};

export const callDbEndpoint = async (op: "create" | "update"): Promise<string>  =>{
  const url =`${API_BASE}/database/${op}/table`
  const res = await fetch(url, { method: "PUT" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail ?? `Request failed (${res.status})`);
  return data?.message ?? "Done.";
}