import { describe, expect, it } from "vitest";
import {
  applyExplorerPageSize,
  applyExplorerSort,
  applyExplorerTag,
  DEFAULT_EXPLORER_QUERY,
  formatLanceMtime,
  resetExplorerQuery,
  rowCopyPayload,
  validateLanceSource,
} from "./explorerUtils";

describe("LanceDB explorer query state", () => {
  it("resets table-specific controls when a table changes", () => {
    expect(resetExplorerQuery()).toEqual(DEFAULT_EXPLORER_QUERY);
    expect(resetExplorerQuery()).not.toBe(DEFAULT_EXPLORER_QUERY);
  });

  it("returns to page one for filter, sort, and page-size changes", () => {
    const state = { ...DEFAULT_EXPLORER_QUERY, page: 8 };
    expect(applyExplorerTag(state, " product ")).toMatchObject({
      page: 1,
      tag: "product",
    });
    expect(applyExplorerSort(state, "mtime", "desc")).toMatchObject({
      page: 1,
      sortBy: "mtime",
      sortOrder: "desc",
    });
    expect(applyExplorerPageSize(state, 100)).toMatchObject({
      page: 1,
      pageSize: 100,
    });
  });

  it("validates configured and explicit cloud sources before a scan", () => {
    expect(
      validateLanceSource({ storage: "s3", location: "s3://bucket/database" }),
    ).toBeNull();
    expect(validateLanceSource({ storage: "s3", location: "" })).toBeNull();
    expect(validateLanceSource({ storage: "r2", location: "" })).toBeNull();
    expect(
      validateLanceSource({ storage: "r2", location: "s3://bucket/database" }),
    ).toBeNull();
    expect(
      validateLanceSource({ storage: "s3", location: "https://bucket/database" }),
    ).toContain("S3-compatible");
    expect(
      validateLanceSource({ storage: "s3", location: "s3://bucket/db?token=x" }),
    ).toContain("S3-compatible");
    expect(
      validateLanceSource({ storage: "r2", location: "s3://bucket.with.dots/db" }),
    ).toContain("valid bucket name");
    expect(
      validateLanceSource({ storage: "s3", location: "s3://192.168.1.10/db" }),
    ).toContain("valid bucket name");
    expect(validateLanceSource({ storage: "local" })).toBeNull();
    expect(
      validateLanceSource({
        storage: "local",
        location: "unexpected-client-path",
      }),
    ).toContain("client filesystem path is not accepted");
    expect(
      validateLanceSource({ storage: "local", location: "x".repeat(2049) }),
    ).toContain("2,048");
  });

  it("copies collapsed row JSON without vector values", () => {
    const json = rowCopyPayload({
      row_id: 4,
      image_uri: "image.webp",
      tag: "product",
      hash: "abc",
      mtime: 1,
      vector: { length: 768, included: false },
    });
    expect(json).toContain('"length": 768');
    expect(json).not.toContain('"values"');
  });

  it("formats seconds-based epoch values", () => {
    expect(formatLanceMtime(0)).not.toBe("—");
    expect(formatLanceMtime("not-a-date")).toBe("not-a-date");
  });
});
