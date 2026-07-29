const TIMEZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const ISO_DATE_TIME_WITHOUT_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;
const NUMERIC_TIMESTAMP = /^\d+(?:\.\d+)?$/;

function parseNumericTimestamp(value: number): Date | null {
  if (!Number.isFinite(value)) return null;

  // Backend data can contain Unix seconds or JavaScript milliseconds.
  const milliseconds = Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
  const parsed = new Date(milliseconds);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Parses API timestamps consistently. The backend historically emitted both
 * timezone-aware ISO strings and naive `datetime.utcnow().isoformat()` values.
 * A timezone-less ISO datetime is UTC, not browser-local time.
 */
export function parseApiTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === "number") return parseNumericTimestamp(value);

  if (value && typeof value === "object" && "$date" in value) {
    return parseApiTimestamp((value as { $date?: unknown }).$date);
  }

  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  if (NUMERIC_TIMESTAMP.test(raw)) {
    return parseNumericTimestamp(Number(raw));
  }

  const normalized =
    ISO_DATE_TIME_WITHOUT_ZONE.test(raw) && !TIMEZONE_SUFFIX.test(raw)
      ? `${raw}Z`
      : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function canonicalizeApiTimestamp(value: unknown): string | null {
  return parseApiTimestamp(value)?.toISOString() ?? null;
}

export function formatUploadedAt(value: unknown): string | null {
  const parsed = parseApiTimestamp(value);
  if (!parsed) return null;

  return parsed.toLocaleString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
