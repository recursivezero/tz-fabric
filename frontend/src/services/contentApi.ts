const BASE_URL = (import.meta.env.VITE_API_URL) || ""; 

export type MediaItem = {
  _id: string;
  imageUrl: string;
  audioUrl: string;
  createdAt: string;
};

export async function fetchContent(page = 1, limit = 4): Promise<{
  items: MediaItem[];
  page: number;
  limit: number;
  total: number;
}> {
  const res = await fetch(`${BASE_URL}/api/media/content?page=${page}&limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load content");
  return res.json();
}
