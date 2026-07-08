import type { ResultItem } from "./types";
import { cleanName, toCdnUrl } from "./searchUtils";

interface ResultCardProps {
  item: ResultItem;
  index: number;
  onZoom: (src: string, caption: string) => void;
  onBadImage: (src: string) => void;
}

export default function ResultCard({ item, index, onZoom, onBadImage }: ResultCardProps) {
  const handleClick = () => {
    if (!item.imageSrc) return;
    onZoom(toCdnUrl(item.imageSrc), cleanName(item.filename));
  };

  return (
    <article
      className="result-card"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="result-card__thumb">
        <img
          src={toCdnUrl(item.imageSrc)}
          alt={item.filename}
          loading="lazy"
          decoding="async"
          onError={() => onBadImage(item.imageSrc)}
          onClick={handleClick}
        />
        <button
          type="button"
          className="result-card__zoom-btn"
          aria-label="Zoom"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
        >
          🔍
        </button>
      </div>

      <button type="button" className="result-card__name" onClick={handleClick}>
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
