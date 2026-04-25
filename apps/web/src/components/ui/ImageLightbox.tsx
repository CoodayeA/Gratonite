import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface ImageLightboxProps {
  url: string;
  imageUrls?: string[];
  onClose: () => void;
  onNavigate?: (url: string) => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ url, imageUrls = [], onClose, onNavigate }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
  const pinchRef = useRef({ active: false, startDist: 0, startZoom: 1 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Track object URLs created in this session for cleanup on unmount
  const objectUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      // Revoke any object URLs we hold to prevent memory leaks
      objectUrlsRef.current.forEach(u => {
        try { URL.revokeObjectURL(u); } catch { /* no-op */ }
      });
    };
  }, []);

  const currentIndex = imageUrls.indexOf(url);
  const hasGallery = imageUrls.length > 1 && currentIndex >= 0;

  const goToImage = useCallback((dir: number) => {
    if (!hasGallery || !onNavigate) return;
    const nextIdx = (currentIndex + dir + imageUrls.length) % imageUrls.length;
    onNavigate(imageUrls[nextIdx]);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [hasGallery, currentIndex, imageUrls, onNavigate]);

  const handleClose = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onClose();
  }, [onClose]);

  useEffect(() => {
    containerRef.current?.focus();
  }, [url]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
    if (e.key === 'ArrowLeft') goToImage(-1);
    if (e.key === 'ArrowRight') goToImage(1);
  }, [handleClose, goToImage]);

  const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'white', backdropFilter: 'blur(8px)',
    transition: 'background 0.2s', zIndex: 2,
  };

  const onBtnEnter = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.2)';
  const onBtnLeave = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';

  return (
    <div
      ref={containerRef}
      onClick={handleClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="gt-focusable"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9000, cursor: 'zoom-out', outline: 'none',
      }}
    >
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); handleClose(); }}
        style={{ ...btnStyle, position: 'absolute', top: 24, right: 24, width: 40, height: 40 }}
        onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}
        aria-label="Close lightbox"
      >
        <X size={20} />
      </button>

      {/* Download button */}
      <a
        href={url}
        download
        onClick={e => e.stopPropagation()}
        style={{ ...btnStyle, position: 'absolute', top: 24, right: 80, width: 40, height: 40, textDecoration: 'none' }}
        onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}
        aria-label="Download image"
      >
        <Download size={18} />
      </a>

      {/* Gallery counter */}
      {hasGallery && (
        <div style={{
          position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600,
          background: 'rgba(0,0,0,0.5)', padding: '4px 12px', borderRadius: 12,
          backdropFilter: 'blur(8px)', zIndex: 2,
        }}>
          {currentIndex + 1} / {imageUrls.length}
        </div>
      )}

      {/* Left arrow */}
      {hasGallery && (
        <button
          onClick={(e) => { e.stopPropagation(); goToImage(-1); }}
          style={{ ...btnStyle, position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48 }}
          onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}
          aria-label="Previous image"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Right arrow */}
      {hasGallery && (
        <button
          onClick={(e) => { e.stopPropagation(); goToImage(1); }}
          style={{ ...btnStyle, position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', width: 48, height: 48 }}
          onMouseEnter={onBtnEnter} onMouseLeave={onBtnLeave}
          aria-label="Next image"
        >
          <ChevronRight size={24} />
        </button>
      )}

      <img
        src={url}
        alt="Enlarged"
        loading="lazy"
        decoding="async"
        onClick={e => e.stopPropagation()}
        onWheel={(e) => {
          e.stopPropagation();
          const newZoom = Math.max(0.5, Math.min(5, zoom + (e.deltaY < 0 ? 0.25 : -0.25)));
          setZoom(newZoom);
          if (newZoom <= 1) setPan({ x: 0, y: 0 });
        }}
        onMouseDown={(e) => {
          if (zoom > 1) {
            e.preventDefault();
            dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
          }
        }}
        onMouseMove={(e) => {
          if (dragRef.current.dragging) {
            const dx = e.clientX - dragRef.current.startX;
            const dy = e.clientY - dragRef.current.startY;
            setPan({ x: dragRef.current.startPanX + dx, y: dragRef.current.startPanY + dy });
          }
        }}
        onMouseUp={() => { dragRef.current.dragging = false; }}
        onMouseLeave={() => { dragRef.current.dragging = false; }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }); }
          else { setZoom(2); }
        }}
        /* Pinch-to-zoom for touch (Item 53) */
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            e.stopPropagation();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchRef.current = { active: true, startDist: Math.hypot(dx, dy), startZoom: zoom };
          } else if (e.touches.length === 1 && zoom > 1) {
            dragRef.current = { dragging: true, startX: e.touches[0].clientX, startY: e.touches[0].clientY, startPanX: pan.x, startPanY: pan.y };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinchRef.current.active) {
            e.stopPropagation();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const scale = dist / pinchRef.current.startDist;
            const newZoom = Math.max(0.5, Math.min(5, pinchRef.current.startZoom * scale));
            setZoom(newZoom);
          } else if (e.touches.length === 1 && dragRef.current.dragging) {
            const ddx = e.touches[0].clientX - dragRef.current.startX;
            const ddy = e.touches[0].clientY - dragRef.current.startY;
            setPan({ x: dragRef.current.startPanX + ddx, y: dragRef.current.startPanY + ddy });
          }
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          pinchRef.current.active = false;
          dragRef.current.dragging = false;
          if (zoom <= 1) setPan({ x: 0, y: 0 });
        }}
        style={{
          maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
          borderRadius: 8,
          cursor: zoom > 1 ? (dragRef.current.dragging ? 'grabbing' : 'grab') : 'zoom-in',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
          transition: dragRef.current.dragging || pinchRef.current.active ? 'none' : 'transform 0.15s ease-out',
          userSelect: 'none',
          touchAction: 'none',
        }}
        draggable={false}
      />
    </div>
  );
};

export default ImageLightbox;
