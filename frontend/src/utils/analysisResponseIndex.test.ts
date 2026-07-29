import { describe, expect, it } from "vitest";
import { toBackendResponseIndex } from "./analysisResponseIndex";

describe("analysis response index mapping", () => {
  it("maps the UI's zero-based slots to the API's one-based variations", () => {
    expect(Array.from({ length: 6 }, (_, index) => toBackendResponseIndex(index))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
});
