interface LightboxProps {
  src: string;
  caption: string | null;
  scale: number;
  offset: { x: number; y: number };
  onClose: () => void;
  onWheel: React.WheelEventHandler<HTMLDivElement>;
  onMouseDown: React.MouseEventHandler<HTMLDivElement>;
  onMouseMove: React.MouseEventHandler<HTMLDivElement>;
  onMouseUp: React.MouseEventHandler<HTMLDivElement>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export const Lightbox = ({
  src, caption, scale, offset,
  onClose, onWheel, onMouseDown, onMouseMove, onMouseUp,
  onZoomIn, onZoomOut, onReset,
}: LightboxProps) => {
  return (
    <div
      className="lightbox"
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

        <div className="lightbox__controls">
          <button className="lightbox__control-btn" onClick={onZoomOut}>−</button>
          <button className="lightbox__control-btn" onClick={onReset}>Reset</button>
          <button className="lightbox__control-btn" onClick={onZoomIn}>+</button>
          <button className="lightbox__control-btn lightbox__control-btn--close" onClick={onClose}>✕</button>
        </div>
      </div>
    </div>
  );
};