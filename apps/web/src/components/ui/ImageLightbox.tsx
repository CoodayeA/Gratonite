import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <div className="image-lightbox-overlay" onClick={onClose}>
      <button type="button" className="image-lightbox-close" onClick={onClose}>
        ✕
      </button>
      <img
        src={src}
        alt={alt || 'Image preview'}
        className="image-lightbox-img"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}
