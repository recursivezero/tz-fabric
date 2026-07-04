import { FULL_API_URL } from "../constants";

export async function fetchImageAsFile(path, filename) {
  const fetchBlob = async (url) => {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    return await res.blob();
  };

  let blob;
  try {
    blob = await fetchBlob(path);
  } catch (err) {
    if (!/^https?:\/\//i.test(path)) throw err;
    const proxyUrl = `${FULL_API_URL}/fetch-image?url=${encodeURIComponent(path)}`;
    blob = await fetchBlob(proxyUrl);
  }

  const type = blob.type || "image/jpeg";
  return new File([blob], filename, { type });
}
