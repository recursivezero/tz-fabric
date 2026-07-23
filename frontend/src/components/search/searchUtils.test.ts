import { describe, expect, it } from "vitest";
import {
  clampCropRectToBounds,
  getSearchLayoutState,
  getAllImageSearchCategories,
  shouldRetryEmptyImageSearch,
  toCdnUrl,
  toResultItem,
} from "./searchUtils";

describe("search response normalization", () => {
  it("normalizes legacy string results", () => {
    expect(toResultItem("uploads/fabric-blue.jpg")).toMatchObject({
      filename: "fabric-blue.jpg",
    });
    expect(toResultItem("uploads/fabric-blue.jpg")?.imageSrc).toContain(
      "/images/uploads/fabric-blue.jpg",
    );
  });

  it("normalizes object results and nested backend metadata", () => {
    expect(
      toResultItem({
        metadata: {
          image_url: "/assets/images/sample.webp",
          filename: "sample.webp",
          audio_url: "/assets/audios/sample.wav",
        },
      }),
    ).toEqual({
      imageSrc: "/assets/images/sample.webp",
      filename: "sample.webp",
      audioSrc: "/assets/audios/sample.wav",
    });
  });

  it("rejects malformed results instead of rendering broken cards", () => {
    expect(toResultItem(null)).toBeNull();
    expect(toResultItem({ score: 0.9 })).toBeNull();
  });

  it("does not rewrite absolute, blob, or data URLs", () => {
    expect(toCdnUrl("https://example.test/fabric.jpg")).toBe(
      "https://example.test/fabric.jpg",
    );
    expect(toCdnUrl("blob:https://example.test/id")).toBe(
      "blob:https://example.test/id",
    );
  });
});

describe("crop bounds", () => {
  it("keeps the crop inside the source image", () => {
    expect(
      clampCropRectToBounds({ x: -10, y: 90, w: 120, h: 80 }, 100, 100),
    ).toEqual({ x: 0, y: 20, w: 100, h: 80 });
  });
});

describe("search layout state", () => {
  it("keeps the full Search workspace visible for text results", () => {
    expect(
      getSearchLayoutState({
        hasResults: true,
        loading: false,
        hasFile: false,
        drawerOpen: false,
        isTextSearch: true,
      }),
    ).toMatchObject({
      keepTextSearchWorkspace: true,
      showHero: true,
      showStickyBar: false,
      showImagePreview: false,
    });
  });

  it("retains the compact sticky toolbar for image results", () => {
    expect(
      getSearchLayoutState({
        hasResults: true,
        loading: false,
        hasFile: true,
        drawerOpen: false,
        isTextSearch: false,
      }),
    ).toMatchObject({
      keepTextSearchWorkspace: false,
      showHero: false,
      showStickyBar: true,
      showImagePreview: false,
    });
  });
});

describe("image search categories", () => {
  it("provides every category for an empty image-search fallback", () => {
    expect(getAllImageSearchCategories()).toEqual([
      "stock",
      "fabric",
      "design",
      "product",
    ]);
  });

  it("retries only empty unfiltered image searches", () => {
    expect(shouldRetryEmptyImageSearch(undefined, 0)).toBe(true);
    expect(shouldRetryEmptyImageSearch([], 0)).toBe(true);
    expect(shouldRetryEmptyImageSearch(["fabric"], 0)).toBe(false);
    expect(shouldRetryEmptyImageSearch(undefined, 2)).toBe(false);
  });
});
