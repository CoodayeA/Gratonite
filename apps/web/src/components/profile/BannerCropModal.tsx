import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

interface BannerCropModalProps {
  file: File;
  onClose: () => void;
  onComplete: (bannerHash: string) => void;
}

const MIN_WIDTH = 680;
const MIN_HEIGHT = 240;

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  } as React.CSSProperties,
  picker: {
    background: 'var(--bg-elevated, #353348)',
    borderRadius: 'var(--radius-lg)',
    width: 480,
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 20px 16px',
    borderBottom: '1px solid var(--stroke, #4a4660)',
  } as React.CSSProperties,
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
  } as React.CSSProperties,
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted, #a8a4b8)',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  closeBtnHover: {
    background: 'none',
    border: 'none',
    color: 'var(--text, #e8e4e0)',
    fontSize: 16,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
  } as React.CSSProperties,
  cropContainer: {
    padding: 16,
    minHeight: 280,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  cropPreview: {
    width: '100%',
    maxWidth: 480,
    position: 'relative',
  } as React.CSSProperties,
  cropPreviewImg: {
    width: '100%',
    height: 'auto',
    borderRadius: 'var(--radius-md)',
  } as React.CSSProperties,
  cropOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(0,0,0,0.7)',
    padding: 8,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--text-muted, #a8a4b8)',
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    padding: '12px 20px',
    borderTop: '1px solid var(--stroke, #4a4660)',
  } as React.CSSProperties,
} as const;

export function BannerCropModal({ file, onClose, onComplete }: BannerCropModalProps) {
  const [cropping, setCropping] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [closeHover, setCloseHover] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
    };
    fileReader.readAsDataURL(file);
  }, [file]);

  const handleSkip = async () => {
    setCropping(true);
    try {
      const result = await api.users.uploadBanner(file);
      onComplete(result.bannerHash);
    } catch (err) {
      console.error('Failed to upload banner:', err);
      setCropping(false);
    }
  };

  const handleCrop = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !preview) return;

    setCropping(true);
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = MIN_WIDTH;
      canvas.height = MIN_HEIGHT;

      const img = new Image();
      img.src = preview;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
      });

      const scale = Math.max(MIN_WIDTH / img.width, MIN_HEIGHT / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const x = (MIN_WIDTH - scaledWidth) / 2;
      const y = (MIN_HEIGHT - scaledHeight) / 2;

      ctx.fillStyle = '#1e1f22';
      ctx.fillRect(0, 0, MIN_WIDTH, MIN_HEIGHT);
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/webp', 0.9);
      });

      const croppedFile = new File([blob], 'banner.webp', { type: 'image/webp' });
      const result = await api.users.uploadBanner(croppedFile);
      onComplete(result.bannerHash);
    } catch (err) {
      console.error('Failed to crop and upload banner:', err);
      setCropping(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.picker} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>Crop Banner</h3>
          <button
            type="button"
            style={closeHover ? styles.closeBtnHover : styles.closeBtn}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={styles.cropContainer}>
          {preview && (
            <>
              <div style={styles.cropPreview}>
                <img src={preview} alt="Banner preview" style={styles.cropPreviewImg} />
                <div style={styles.cropOverlay}>
                  <span>Preview (will be centered-cropped to 680×240)</span>
                </div>
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </>
          )}
        </div>

        <div style={styles.footer}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="ghost" onClick={handleSkip} disabled={cropping}>
            Skip Crop
          </Button>
          <Button onClick={handleCrop} disabled={cropping}>
            {cropping ? 'Uploading...' : 'Crop & Upload'}
          </Button>
        </div>
      </div>
    </div>
  );
}
