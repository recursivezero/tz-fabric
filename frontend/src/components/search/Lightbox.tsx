import type { MouseEventHandler, WheelEventHandler } from "react";

interface LightboxProps {
  src: string;
  caption: string | null;
  scale: number;
  offset: { x: number; y: number };
  onClose: () => void;
  onWheel: WheelEventHandler<HTMLDivElement>;
  onMouseDown: MouseEventHandler<HTMLDivElement>;
  onMouseMove: MouseEventHandler<HTMLDivElement>;
  onMouseUp: MouseEventHandler<HTMLDivElement>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export default function Lightbox({
  src, caption, scale, offset,
  onClose, onWheel, onMouseDown, onMouseMove, onMouseUp,
  onZoomIn, onZoomOut, onReset,
}: LightboxProps) {
  const canZoomOut = scale > 0.51;
  const canZoomIn = scale < 5.99;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={caption ? `Preview: ${caption}` : "Image preview"}
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains("lightbox")) onClose();
      }}
    >
      <div
        className="lightbox__stage"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <img
          src={src}
          alt={caption ?? "preview"}
          className="lightbox__image"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          draggable={false}
        />

        {caption && <div className="lightbox__caption">{caption}</div>}

        <div
          className="lightbox__controls"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="lightbox__control-btn"
            onClick={onZoomOut}
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={!canZoomOut}
          >
            −
          </button>
          <button
            className="lightbox__control-btn lightbox__control-btn--reset"
            onClick={onReset}
            type="button"
            aria-label="Reset zoom"
            title="Reset zoom"
          >
            <span aria-hidden="true">↺</span>
            <span>Reset</span>
          </button>
          <button
            className="lightbox__control-btn"
            onClick={onZoomIn}
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={!canZoomIn}
          >
            +
          </button>
          <button
            className="lightbox__control-btn lightbox__control-btn--close"
            onClick={onClose}
            type="button"
            aria-label="Close preview"
            title="Close preview"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
