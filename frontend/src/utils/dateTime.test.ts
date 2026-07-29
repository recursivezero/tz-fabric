import { describe, expect, it } from "vitest";
import {
  canonicalizeApiTimestamp,
  formatUploadedAt,
  parseApiTimestamp,
} from "./dateTime";

describe("API timestamp handling", () => {
  it("treats backend timezone-less ISO timestamps as UTC", () => {
    expect(canonicalizeApiTimestamp("2026-07-14T12:30:45")).toBe(
      "2026-07-14T12:30:45.000Z",
    );
  });

  it("preserves explicit timezone offsets", () => {
    expect(canonicalizeApiTimestamp("2026-07-14T18:00:45+05:30")).toBe(
      "2026-07-14T12:30:45.000Z",
    );
  });

  it("supports Unix timestamps in seconds and milliseconds", () => {
    const seconds = parseApiTimestamp(1_752_496_245);
    const milliseconds = parseApiTimestamp(1_752_496_245_000);

    expect(seconds?.toISOString()).toBe(milliseconds?.toISOString());
  });

  it("supports Mongo-style date wrappers", () => {
    expect(canonicalizeApiTimestamp({ $date: "2026-07-14T12:30:45Z" })).toBe(
      "2026-07-14T12:30:45.000Z",
    );
  });

  it("returns null for invalid or missing timestamps", () => {
    expect(parseApiTimestamp("not-a-date")).toBeNull();
    expect(parseApiTimestamp(undefined)).toBeNull();
    expect(formatUploadedAt(null)).toBeNull();
  });
});
