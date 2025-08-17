export async function fetchImageAsFile(path, filename) {
  const res = await fetch(path);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}