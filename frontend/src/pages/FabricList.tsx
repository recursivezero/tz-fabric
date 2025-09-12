import { useEffect, useState } from "react";
import { fetchContent, type MediaItem } from "../services/content_api";
import "../styles/ContentGrid.css";

const API_URL = import.meta.env.VITE_API_URL;

export default function ContentGrid() {
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
    return () => {
      ignore = true;
    };
  }, [page, limit, mode]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const showAll = () => {
    setMode("all");
    setPage(1);
  };
  function pickDisplayName(item: MediaItem) {
    if (item.basename) return item.basename;
    if (item.imageFilename) return item.imageFilename.replace(/\.[^.]+$/, "");
    const last = (item.imageUrl || "").split("/").pop() || "";
    return last.replace(/\.[^.]+$/, "");
  }
  const cleanName = (filename: string) => {
    if (!filename) return "";
    return filename.split("_")[0].split(".")[0];
  };
  return (
    <div className="grid-page">
      <div className="upload-wrapper">
        <div className="upload-inner" style={{ display: "flex", gap: 8 }}>
          {mode === "similar" && (
            <button className="btn" onClick={showAll} disabled={loading}>
              ← Back to All
            </button>
          )}
        </div>
      </div>

      <div className="grid-title">{mode === "all" ? "All Uploads" : "Similar Results"}</div>

      {mode === "all" && (
        <div className="grid-controls">
          <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      )}

      {err && <div className="grid-error">⚠️ {err}</div>}

      <div className="media-grid">
        {items.map((item) => (
          <article className="media-card" key={item._id ?? item.imageUrl}>
            <div className="media-thumb">
              <img
                src={item.imageUrl?.startsWith("http") ? item.imageUrl : `${API_URL}${item.imageUrl}`}
                alt="Uploaded"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                }}
              />
            </div>
            <div className="media-name" title={pickDisplayName(item)}>
              {cleanName(pickDisplayName(item))}
            </div>

            <div className="media-audio">
              {item.audioUrl && (
                <audio
                  controls
                  src={item.audioUrl?.startsWith("http") ? item.audioUrl : `${API_URL}${item.audioUrl}`}
                  preload="metadata"
                />
              )}
            </div>

            <div className="media-meta">
              {item.createdAt && <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>}
              {/*{"score" in item && item.score !== undefined ? (
                <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>score: {item.score}</span>
              ) : null}*/}
            </div>
          </article>
        ))}

        {!loading && items.length === 0 && <div className="empty-state">No items.</div>}
      </div>
      {loading && <div className="grid-loading">Loading…</div>}
    </div>
  );
}
