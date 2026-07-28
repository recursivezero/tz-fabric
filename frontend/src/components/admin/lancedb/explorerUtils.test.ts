import { describe, expect, it } from "vitest";
import {
  applyExplorerPageSize,
  applyExplorerSort,
  applyExplorerTag,
  DEFAULT_EXPLORER_QUERY,
  formatLanceMtime,
  resetExplorerQuery,
  rowCopyPayload,
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
