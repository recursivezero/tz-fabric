import { FULL_API_URL } from "../constants";

export type MediaItem = {
  _id: string;
  imageUrl: string;
  audioUrl: string | null;
  createdAt: string;

  basename?: string;
  imageFilename?: string;
  audioFilename?: string | null;
};

export type ContentResponse = {
  items: MediaItem[];
  page: number;
  limit: number;
  total: number;
};

export async function fetchContent(
  page = 1,
  limit = 4,
): Promise<ContentResponse> {
  const res = await fetch(
    `${FULL_API_URL}/media/content?page=${page}&limit=${limit}`,
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => "Failed to load content");
    throw new Error(msg || "Failed to load content");
  }
  const data = (await res.json()) as ContentResponse;

  data.items = data.items.map((it) => ({
    ...it,
    audioUrl: it.audioUrl ?? null,
    basename: it.basename ?? undefined,
    imageFilename: it.imageFilename ?? undefined,
    audioFilename: it.audioFilename ?? null,
  }));

  return data;
}
