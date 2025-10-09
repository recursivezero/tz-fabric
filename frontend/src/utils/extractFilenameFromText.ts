// src/utils/extractFilenameFromText.ts
export const extractFilenameFromText = (
  text: string | null | undefined
): string | null => {
  if (!text) return null;
  const s = String(text).trim();
  if (!s) return null;

  const clean = (v: string) => {
    const out = v
      .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
      .replace(/\s*[\(\[\{]\s*\d+\s*[\)\]\}]\s*$/g, "")
      .replace(/\s*[-–]\s*Copy(?:\s*[\(\[]\s*\d+\s*[\)\]])?\s*$/i, "")
      .replace(/\s*copy\s*\d+\s*$/i, "")
      .replace(/(?:\s+|\b)(\d{1,3})\s*$/g, "")
      .trim();

    return out || "";
  };

  const cap1 = (re: RegExp) => s.match(re)?.[1];

  {
    const v1 = cap1(/(?:as|named|with)\s+"([^"]+)"/i);
    if (v1) { const c = clean(v1); if (c) return c; }
    const v2 = cap1(/(?:as|named|with)\s+'([^']+)'/i);
    if (v2) { const c = clean(v2); if (c) return c; }
  }

  {
    const v = cap1(/(?:as|named|with)\s+([A-Za-z0-9 _\-.()]{1,200}?)(?:[.,!?;:]|$)/i);
    if (v) { const c = clean(v); if (c) return c; }
  }

  {
    const v = cap1(/with\s+([A-Za-z0-9 _\-.()]+)\s*$/i);
    if (v) { const c = clean(v); if (c) return c; }
  }

  {
    const v = cap1(/(?:as|named)\s+(\S+)\s*$/i);
    if (v) { const c = clean(v); if (c) return c; }
  }

  {
    const m = s.match(/(?:filename|name)\s*:\s*(?:"([^"]+)"|'([^']+)'|(.+?)(?:[.,!?;:]|$))/i);
    if (m) { const c = clean(m[1] ?? m[2] ?? m[3] ?? ""); if (c) return c; }
  }

  {
    const shortThresholdWords = 5;
    const words = s.split(/\s+/).filter(Boolean);
    const containsVerbLike = /\b(upload|submit|analyz|analyse|inspect|please|with|image|audio|file|send|queue|start)\b/i.test(s);
    if (words.length > 0 && words.length <= shortThresholdWords && !containsVerbLike) {
      const c = clean(s); if (c) return c;
    }
  }

  {
    const v = cap1(/(?:as|named|with|called)\s+(.{1,200})$/i);
    if (v) { const c = clean(v); if (c) return c; }
  }

  return null;
};

export default extractFilenameFromText;
