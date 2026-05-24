interface CropDrawerProps {
  rawImageUrl: string;
  cropRect: { x: number; y: number; w: number; h: number };
  imgRef: React.RefObject<HTMLImageElement | null>;
  onImageLoad: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CropDrawer = ({
  rawImageUrl, cropRect, imgRef,
  onImageLoad, onDragStart, onResizeStart,
  onConfirm, onCancel,
}: CropDrawerProps) => {
  return (
    <div className="crop-drawer" role="dialog" aria-modal="true">
      <div className="crop-drawer__inner">
        <h3 className="crop-drawer__title">Crop &amp; Confirm</h3>

        <div className="crop-drawer__stage">
          <div className="crop-drawer__image-wrap">
            <img
              ref={imgRef}
              src={rawImageUrl}
              alt="Select crop area"
              className="crop-drawer__image"
              onLoad={onImageLoad}
              draggable={false}
            />
            <div
              className="crop-drawer__rect"
              style={{
                left: `${cropRect.x}px`,
                top: `${cropRect.y}px`,
                width: `${cropRect.w}px`,
                height: `${cropRect.h}px`,
              }}
              onMouseDown={(e) => { e.preventDefault(); onDragStart(e); }}
            >
              <div
                className="crop-drawer__handle"
                onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
              />
            </div>
          </div>
        </div>

        <div className="crop-drawer__actions">
          <button className="btn btn--ghost" onClick={onCancel}>✕ Cancel</button>
          <button className="btn btn--primary" onClick={onConfirm}>✔ Crop &amp; Search</button>
        </div>
      </div>
    </div>
  );
}