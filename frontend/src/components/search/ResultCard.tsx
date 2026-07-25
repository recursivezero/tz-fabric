import { useState } from "react";
import type { ResultItem } from "./types";
import { cleanName, toCdnUrl } from "./searchUtils";

interface ResultCardProps {
  item: ResultItem;
  index: number;
  onZoom: (src: string, caption: string) => void;
}

export default function ResultCard({ item, index, onZoom }: ResultCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const handleClick = () => {
    if (!item.imageSrc || imageFailed) return;
    onZoom(toCdnUrl(item.imageSrc), cleanName(item.filename));
  };

  return (
    <article
      className="result-card"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="result-card__thumb">
        {imageFailed ? (
          <div
            className="result-card__image-fallback"
            role="img"
            aria-label={`${cleanName(item.filename)} preview unavailable`}
          >
            <span aria-hidden="true">🖼️</span>
            <span>Preview unavailable</span>
          </div>
        ) : (
          <>
            <img
              src={toCdnUrl(item.imageSrc)}
              alt={item.filename}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              onClick={handleClick}
            />
            <button
              type="button"
              className="result-card__zoom-btn"
              aria-label="Zoom"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              🔍
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        className="result-card__name"
        onClick={handleClick}
        aria-disabled={imageFailed}
      >
        {cleanName(item.filename)}
      </button>

      {item.audioSrc && (
        <div className="result-card__audio">
          <audio controls src={item.audioSrc} preload="metadata" controlsList="nodownload" />
        </div>
      )}
    </article>
  );
}
