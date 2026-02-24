import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useGuilds } from '@/hooks/useGuilds';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

function normalizeEmojiName(raw: string): string {
  return raw.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const out = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(objectUrl);
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image'));
    };
    img.src = objectUrl;
  });
}

async function transformStaticImage(file: File, zoom: number, rotateDeg: number): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = objectUrl;
  });

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Canvas is unavailable in this browser');
  }

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.rotate((rotateDeg * Math.PI) / 180);

  const fit = Math.min(size / img.naturalWidth, size / img.naturalHeight) * zoom;
  const drawW = img.naturalWidth * fit;
  const drawH = img.naturalHeight * fit;
  ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png', 0.92),
  );
  URL.revokeObjectURL(objectUrl);
  if (!blob) throw new Error('Failed to transform image');

  const filename = file.name.replace(/\.[^/.]+$/, '') + '.png';
  return new File([blob], filename, { type: 'image/png' });
}

export function EmojiStudioModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);
  const queryClient = useQueryClient();
  useGuilds();

  const initialGuildId = (modalData?.['guildId'] as string | undefined) ?? '';

  const [guildId, setGuildId] = useState(initialGuildId);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [fileMeta, setFileMeta] = useState<{ animated: boolean; width: number; height: number } | null>(null);

  useEffect(() => {
    if (activeModal !== 'emoji-studio') return;
    setGuildId(initialGuildId);
    setName('');
    setFile(null);
    setPreviewUrl('');
    setZoom(1);
    setRotate(0);
    setError('');
    setFileMeta(null);
  }, [activeModal, initialGuildId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const guildOptions = useMemo(
    () =>
      guildOrder
        .map((id) => guilds.get(id))
        .filter((guild): guild is NonNullable<typeof guild> => Boolean(guild)),
    [guildOrder, guilds],
  );

  async function handleSelectFile(nextFile: File | null) {
    if (!nextFile) return;
    setError('');
    if (!/^image\/(png|gif|webp|jpeg)$/.test(nextFile.type)) {
      setError('Supported formats: JPEG, PNG, GIF, WEBP.');
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(nextFile);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(nextPreviewUrl);
    setFile(nextFile);
    setName((prev) => prev || normalizeEmojiName(nextFile.name));
    setZoom(1);
    setRotate(0);

    try {
      const dimensions = await readImageDimensions(nextFile);
      setFileMeta({
        width: dimensions.width,
        height: dimensions.height,
        animated: nextFile.type === 'image/gif',
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setFileMeta(null);
    }
  }

  async function handleUpload() {
    if (!guildId || !file) return;
    setUploading(true);
    setError('');

    try {
      const safeName = normalizeEmojiName(name || file.name);
      if (!safeName || safeName.length < 2) {
        throw new Error('Emoji name must be at least 2 characters and use letters, numbers, or underscores.');
      }

      let uploadFile = file;
      const isStatic = file.type !== 'image/gif';
      if (isStatic && (zoom !== 1 || rotate !== 0 || file.type === 'image/jpeg')) {
        uploadFile = await transformStaticImage(file, zoom, rotate);
      }

      await api.guilds.createEmoji(guildId, {
        name: safeName,
        file: uploadFile,
      });
      await queryClient.invalidateQueries({ queryKey: ['guild-emojis', guildId] });
      closeModal();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal id="emoji-studio" title="Emoji Studio" size="lg" onClose={() => closeModal()}>
      <div className="emoji-studio">
        {error && <div className="modal-error">{error}</div>}

        <div className="emoji-studio-grid">
          <div className="emoji-studio-editor">
            <div className="emoji-studio-preview-wrap">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Emoji preview"
                  className="emoji-studio-preview"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotate}deg)`,
                  }}
                />
              ) : (
                <div className="emoji-studio-placeholder">Choose a file to preview</div>
              )}
            </div>
            <div className="emoji-studio-controls">
              <label className="emoji-studio-control">
                Zoom
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  disabled={!file || file.type === 'image/gif'}
                />
              </label>
              <label className="emoji-studio-control">
                Rotate
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={rotate}
                  onChange={(e) => setRotate(Number(e.target.value))}
                  disabled={!file || file.type === 'image/gif'}
                />
              </label>
            </div>
          </div>

          <div className="emoji-studio-form">
            <Input
              label="Emoji Name"
              type="text"
              value={name}
              onChange={(e) => setName(normalizeEmojiName(e.target.value))}
              placeholder="party_blob"
              maxLength={32}
            />

            <div className="input-group">
              <label className="input-label">Portal</label>
              <div className="input-wrapper">
                <select
                  className="input-field"
                  value={guildId}
                  onChange={(e) => setGuildId(e.target.value)}
                >
                  <option value="" disabled>Select a portal</option>
                  {guildOptions.map((guild) => (
                    <option key={guild.id} value={guild.id}>
                      {guild.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="btn btn-ghost btn-md emoji-studio-upload">
              Choose File
              <input
                type="file"
                className="file-input"
                accept="image/png,image/gif,image/webp,image/jpeg"
                onChange={(e) => handleSelectFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="emoji-studio-note">
              Supported formats: JPEG, PNG, GIF, WEBP. Static and animated slots are tracked separately (50 each).
            </div>

            {fileMeta && (
              <div className="emoji-studio-meta">
                <div>Type: {fileMeta.animated ? 'Animated (GIF)' : 'Static'}</div>
                <div>Source size: {fileMeta.width}x{fileMeta.height}</div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <Button type="button" variant="ghost" onClick={() => closeModal()}>
            Cancel
          </Button>
          <Button type="button" onClick={handleUpload} disabled={!guildId || !file} loading={uploading}>
            Upload Emoji
          </Button>
        </div>
      </div>
    </Modal>
  );
}
