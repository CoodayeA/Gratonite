import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface CatalogItem { id: string; name: string; assetHash: string; }

interface DecorationPickerProps {
  onClose: () => void;
  currentDecorationId: string | null;
}

export function DecorationPicker({ onClose, currentDecorationId }: DecorationPickerProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(currentDecorationId);

  const { data: catalog = [], isError: catalogError } = useQuery<CatalogItem[]>({
    queryKey: ['avatar-decorations-catalog'],
    queryFn: () =>
      fetch('/api/v1/profiles/avatar-decorations', { credentials: 'include' })
        .then(r => r.json()),
  });

  const { data: ownedIds = [] } = useQuery<string[]>({
    queryKey: ['shop-collection', 'decoration'],
    queryFn: () =>
      fetch('/api/v1/shop/collection?type=decoration', { credentials: 'include' })
        .then(r => r.json())
        .then((items: { itemId: string }[]) => items.map(i => i.itemId))
        .catch(() => []),
  });

  const applyMutation = useMutation({
    mutationFn: (decorationId: string | null) =>
      fetch('/api/v1/profiles/users/@me/customization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatarDecorationId: decorationId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onClose();
    },
    onError: (err) => { console.error('Failed to apply cosmetic:', err); },
  });

  const ownedItems = catalog.filter(d => ownedIds.includes(d.id));

  return (
    <div className="cosmetic-picker-overlay" onClick={onClose}>
      <div className="cosmetic-picker" onClick={e => e.stopPropagation()}>
        <div className="cosmetic-picker-header">
          <h3>Avatar Decorations</h3>
          <button type="button" className="cosmetic-picker-close" onClick={onClose}>✕</button>
        </div>
        {catalogError ? (
          <div className="cosmetic-picker-empty">
            <p>Failed to load. Please try again.</p>
          </div>
        ) : ownedItems.length === 0 ? (
          <div className="cosmetic-picker-empty">
            <p>You don't own any decorations yet.</p>
            <button type="button" className="btn-primary" onClick={() => { navigate('/app/shop'); onClose(); }}>Visit Shop</button>
          </div>
        ) : (
          <div className="cosmetic-picker-grid">
            <button
              type="button"
              className={`cosmetic-item ${selected === null ? 'selected' : ''}`}
              onClick={() => setSelected(null)}
            >
              <span className="cosmetic-item-none">None</span>
            </button>
            {ownedItems.map(item => (
              <button
                key={item.id}
                type="button"
                className={`cosmetic-item ${selected === item.id ? 'selected' : ''}`}
                onClick={() => setSelected(item.id)}
                title={item.name}
              >
                <img
                  src={`/api/v1/files/${item.assetHash}`}
                  alt={item.name}
                  className="cosmetic-item-img"
                />
              </button>
            ))}
          </div>
        )}
        <div className="cosmetic-picker-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => applyMutation.mutate(selected)}
            disabled={applyMutation.isPending}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
