// src/utils/extractFilenameFromText.ts
export const extractFilenameFromText = (text: string | null | undefined): string | null => {
  if (!text) return null;
  const s = String(text).trim();

  if (!s) return null;

  // Helper: normalize and trim quotes
  const clean = (v: string) => v.replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "").trim();

  // 1) Quoted patterns: as "name", named 'name', with "name"
  let m = s.match(/(?:as|named|with)\s+"([^"]+)"/i);
  if (m && m[1]) return clean(m[1]);
  m = s.match(/(?:as|named|with)\s+'([^']+)'/i);
  if (m && m[1]) return clean(m[1]);

  // 2) Keyword + multiword until punctuation or EOL: as NAME, named NAME, with NAME
  m = s.match(/(?:as|named|with)\s+([A-Za-z0-9 _\-\.\(\)]{1,200}?)(?:[.,!?;:]|$)/i);
  if (m && m[1]) return clean(m[1]);

  // 3) Patterns like "Please submit the attached ... with silk" (capture last token after 'with' near end)
  m = s.match(/with\s+([A-Za-z0-9 _\-\.\(\)]+)\s*$/i);
  if (m && m[1]) return clean(m[1]);

  // 4) Patterns like "submit as silk" or "... named silk" — single word fallback after keywords
  m = s.match(/(?:as|named)\s+(\S+)\s*$/i);
  if (m && m[1]) return clean(m[1]);

  // 5) Patterns like "filename: silk" or "name: silk"
  m = s.match(/(?:filename|name)\s*:\s*(?:"([^"]+)"|'([^']+)'|(.+?)(?:[.,!?;:]|$))/i);
  if (m) return clean(m[1] || m[2] || m[3] || "");

  // 6) If the whole textarea is short and looks like a filename (no verbs), use it.
  //    e.g., user types just "silk" or "silk batch 1"
  const shortThresholdWords = 5;
  const words = s.split(/\s+/).filter(Boolean);
  const containsVerbLike = /\b(upload|submit|analyz|analyse|inspect|please|with|image|audio|file|send|queue|start)\b/i.test(s);
  if (words.length > 0 && words.length <= shortThresholdWords && !containsVerbLike) {
    return clean(s);
  }

  // 7) As a last attempt, try to capture the last few words after the last verb-like phrase
  m = s.match(/(?:as|named|with|called)\s+(.{1,200})$/i);
  if (m && m[1]) return clean(m[1]);

  return null;
};

export default extractFilenameFromText;
