import { useEffect } from "react";
import type { RefObject, MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import type { CropRect } from "./types";

interface CropDrawerProps {
  rawImageUrl: string;
  cropRect: CropRect;
  imgRef: RefObject<HTMLImageElement | null>;
  onImageLoad: () => void;
  onDragStart: (e: ReactMouseEvent) => void;
  onResizeStart: (e: ReactMouseEvent) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CropDrawer({
  rawImageUrl,
  cropRect,
  imgRef,
  onImageLoad,
  onDragStart,
  onResizeStart,
  onConfirm,
  onCancel,
}: CropDrawerProps) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

  const dialog = (
    <div className="fabric-search fabric-search-modal-root">
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
                onMouseDown={(e) => {
                  e.preventDefault();
                  onDragStart(e);
                }}
              >
                <div
                  className="crop-drawer__handle"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onResizeStart(e);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="crop-drawer__actions">
            <button
              className="btn btn--ghost crop-drawer__action-btn"
              onClick={onCancel}
              type="button"
            >
              <span aria-hidden="true">✕</span>
              <span>Cancel</span>
            </button>
            <button
              className="btn btn--primary crop-drawer__action-btn"
              onClick={onConfirm}
              type="button"
            >
              <span aria-hidden="true">✓</span>
              <span>Crop &amp; Continue</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
