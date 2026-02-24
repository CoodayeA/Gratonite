import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

interface BannerCropModalProps {
  file: File;
  onClose: () => void;
  onComplete: (bannerHash: string) => void;
}

const MIN_WIDTH = 680;
const MIN_HEIGHT = 240;

export function BannerCropModal({ file, onClose, onComplete }: BannerCropModalProps) {
  const [cropping, setCropping] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
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
    <div className="cosmetic-picker-overlay" onClick={onClose}>
      <div className="cosmetic-picker" onClick={(e) => e.stopPropagation()}>
        <div className="cosmetic-picker-header">
          <h3>Crop Banner</h3>
          <button type="button" className="cosmetic-picker-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="banner-crop-container">
          {preview && (
            <>
              <div className="banner-crop-preview">
                <img src={preview} alt="Banner preview" />
                <div className="banner-crop-overlay">
                  <span>Preview (will be centered-cropped to 680×240)</span>
                </div>
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </>
          )}
        </div>

        <div className="cosmetic-picker-footer">
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
