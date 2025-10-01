// src/utils/extractFilenameFromText.ts
export const extractFilenameFromText = (
  text: string | null | undefined
): string | null => {
  if (!text) return null;
  const s = String(text).trim();
  if (!s) return null;

  const clean = (v: string) =>
    v.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "").trim();

  const cap1 = (re: RegExp) => s.match(re)?.[1];

  {
    const v1 = cap1(/(?:as|named|with)\s+"([^"]+)"/i);
    if (v1) return clean(v1);
    const v2 = cap1(/(?:as|named|with)\s+'([^']+)'/i);
    if (v2) return clean(v2);
  }

  {
    const v = cap1(
      /(?:as|named|with)\s+([A-Za-z0-9 _\-\.\(\)]{1,200}?)(?:[.,!?;:]|$)/i
    );
    if (v) return clean(v);
  }

  {
    const v = cap1(/with\s+([A-Za-z0-9 _\-\.\(\)]+)\s*$/i);
    if (v) return clean(v);
  }

  {
    const v = cap1(/(?:as|named)\s+(\S+)\s*$/i);
    if (v) return clean(v);
  }

  {
    const m = s.match(
      /(?:filename|name)\s*:\s*(?:"([^"]+)"|'([^']+)'|(.+?)(?:[.,!?;:]|$))/i
    );
    if (m) return clean(m[1] ?? m[2] ?? m[3] ?? "");
  }

  {
    const shortThresholdWords = 5;
    const words = s.split(/\s+/).filter(Boolean);
    const containsVerbLike = /\b(upload|submit|analyz|analyse|inspect|please|with|image|audio|file|send|queue|start)\b/i.test(
      s
    );
    if (words.length > 0 && words.length <= shortThresholdWords && !containsVerbLike) {
      return clean(s);
    }
  }

  {
    const v = cap1(/(?:as|named|with|called)\s+(.{1,200})$/i);
    if (v) return clean(v);
  }

  return null;
};

export default extractFilenameFromText;
