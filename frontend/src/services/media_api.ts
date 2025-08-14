
const API_BASE = import.meta.env.VITE_API_URL; 

export async function deleteMediaById(id: string) {
  const res = await fetch(`${API_BASE}/api/delete/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
}

export async function deleteMediaByRelPath(relPath: string) {
  const res = await fetch(`${API_BASE}/api/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ relPath }),
  });
  if (!res.ok) throw new Error(await res.text());
  return true;
}
