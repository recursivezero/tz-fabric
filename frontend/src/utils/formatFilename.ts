export function formatFileName(name: string, maxLen = 24): string {
  const safe = String(name || "").trim();
  if (!safe) return "";
  if (safe.length <= maxLen) return safe;

  const lastDot = safe.lastIndexOf(".");
  const hasExt = lastDot > 0 && lastDot < safe.length - 1;
  const ext = hasExt ? safe.slice(lastDot) : "";
  const dots = "....";

  if (hasExt) {
    const budget = Math.max(1, maxLen - dots.length - ext.length);
    const prefix = safe.slice(0, budget);
    return `${prefix}${dots}${ext}`;
  }

  const budget = Math.max(1, maxLen - dots.length);
  const prefix = safe.slice(0, budget);
  return `${prefix}${dots}`;
}
