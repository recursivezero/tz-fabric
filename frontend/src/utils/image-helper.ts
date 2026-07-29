import { ensureOk, fetchWithTimeout } from "./http";

export async function fetchImageAsFile(
  url: string,
  filename: string,
): Promise<File> {
  const response = await fetchWithTimeout(url, { credentials: "omit" }, 20_000);
  await ensureOk(response, `Unable to load image (${response.status}).`);
  const blob = await response.blob();
  return new File([blob], filename, {
    type: blob.type || "application/octet-stream",
  });
}
