import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchContent } from "./content_api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("content API normalization", () => {
  it("normalizes timestamp and filename aliases from the backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "media-1",
                  image_url: "/assets/images/fabric.jpg",
                  audio_url: "/assets/audios/fabric.wav",
                  created_at: "2026-07-14T12:30:45",
                  image_filename: "fabric.jpg",
                },
              ],
              page: "1",
              limit: "4",
              total: "1",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
      ),
    );

    await expect(fetchContent()).resolves.toEqual({
      items: [
        {
          _id: "media-1",
          imageUrl: "/assets/images/fabric.jpg",
          audioUrl: "/assets/audios/fabric.wav",
          createdAt: "2026-07-14T12:30:45.000Z",
          basename: undefined,
          imageFilename: "fabric.jpg",
          audioFilename: null,
        },
      ],
      page: 1,
      limit: 4,
      total: 1,
    });
  });

  it("drops malformed media rows instead of crashing the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ items: [null, {}, { imageUrl: "ok.jpg" }] }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          ),
      ),
    );

    const response = await fetchContent();
    expect(response.items).toHaveLength(1);
    expect(response.items[0].imageUrl).toBe("ok.jpg");
  });
});
