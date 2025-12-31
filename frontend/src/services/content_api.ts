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
  let res: Response;
  console.log({FULL_API_URL});
  try {
    res = await fetch(
      `${FULL_API_URL}/media/content?page=${page}&limit=${limit}`,
    );
  } catch (err) {
    throw new Error("Cannot reach server — check your network ");
  }

  if (!res.ok) {
    let msg = `Failed to load content (${res.status})`;

    if (res.status === 503) {
      msg = "Content service unavailable — check your network.";
    }

    try {
      const text = await res.text();
      if (text) msg = text;
    } catch (_) {
    }

    throw new Error(msg);
  }

  // SUCCESS → parse JSON safely
  let data: ContentResponse;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error("Failed to parse content response.");
  }

  // keep your mapping exactly as is
  data.items = data.items.map((it) => ({
    ...it,
    audioUrl: it.audioUrl ?? null,
    basename: it.basename ?? undefined,
    imageFilename: it.imageFilename ?? undefined,
    audioFilename: it.audioFilename ?? null,
  }));

  return data;
}

