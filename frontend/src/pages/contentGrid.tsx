import { useEffect, useState } from "react";
import { fetchContent, type MediaItem } from "../services/contentApi";
import "../styles/ContentGrid.css";
import { useUploadAndRecord } from "../hooks/feature";
import AnimatedSearchBox from "../components/SearchBar";

const API_URL = import.meta.env.VITE_API_URL;

export default function ContentGrid() {
  const { imageUrl } = useUploadAndRecord();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(4);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"all" | "similar">("all"); 

  useEffect(() => {
    if (mode !== "all") return;
    let ignore = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const data = await fetchContent(page, limit);
        if (!ignore) {
          setItems(data.items);
          setTotal(data.total);
        }
      } catch (e: any) {
        if (!ignore) setErr(e.message || "Failed to load");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [page, limit, mode]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleFindSimilar = async () => {
    if (!imageUrl) {
      alert("Pick or record an image first.");
      return;
    }
    try {
      setLoading(true);
      setErr(null);
      setMode("similar");

      const blob = await fetch(imageUrl).then(r => r.blob());
      const form = new FormData();
      form.append("image", blob, "query.jpg"); // name doesn’t matter

      const res = await fetch(`${API_URL}/api/search/similar?k=12`, {
        method: "POST",
        body: form
      });
      if (!res.ok) throw new Error("Similar search failed");
      const data = await res.json(); 
      setItems(data);
      setTotal(data.length);
      setPage(1);
    } catch (e: any) {
      setErr(e.message || "Similar search failed");
    } finally {
      setLoading(false);
    }
  };

  const showAll = () => {
    setMode("all");
    setPage(1);
  };

  return (
    <div className="grid-page">
      <div className="upload-wrapper">
        <div className="upload-inner" style={{ display: "flex", gap: 8 }}>
          <AnimatedSearchBox onSearch={imageUrl} loading={loading} />
          <button
            className="btn"
            onClick={handleFindSimilar}
            disabled={!imageUrl || loading}
            title={!imageUrl ? "Select an image first" : "Find visually similar images"}
          >
            🔎 Find Similar
          </button>
          {mode === "similar" && (
            <button className="btn" onClick={showAll} disabled={loading}>
              ← Back to All
            </button>
          )}
        </div>
      </div>

      <div className="grid-title">
        {mode === "all" ? "All Uploads" : "Similar Results"}
      </div>

      {mode === "all" && (
        <div className="grid-controls">
          <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span>Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}

      {err && <div className="grid-error">⚠️ {err}</div>}

      <div className="media-grid">
        {items.map((it) => (
          <article className="media-card" key={it._id ?? it.imageUrl}>
            <div className="media-thumb">
              <img
                src={it.imageUrl?.startsWith("http") ? it.imageUrl : `${API_URL}${it.imageUrl}`}
                alt="Uploaded"
                loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
              />
            </div>

            <div className="media-audio">
              {it.audioUrl && (
                <audio
                  controls
                  src={it.audioUrl?.startsWith("http") ? it.audioUrl : `${API_URL}${it.audioUrl}`}
                  preload="metadata"
                />
              )}
            </div>

            <div className="media-meta">
              {it.createdAt && (
                <time dateTime={it.createdAt}>
                  {new Date(it.createdAt).toLocaleString()}
                </time>
              )}
              {"score" in it && it.score !== undefined && (
                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>
                  score: {it.score}
                </span>
              )}
            </div>
          </article>
        ))}

        {!loading && items.length === 0 && (
          <div className="empty-state">No items.</div>
        )}
      </div>

      {loading && <div className="grid-loading">Loading…</div>}
    </div>
  );
}
