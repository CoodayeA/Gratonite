import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface EffectPickerProps {
  onClose: () => void;
  currentEffectId: string | null;
}

export function EffectPicker({ onClose, currentEffectId }: EffectPickerProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(currentEffectId);

  const { data: catalog = [], isError: catalogError } = useQuery({
    queryKey: ['profile-effects-catalog'],
    queryFn: () =>
      fetch('/api/v1/profiles/profile-effects', { credentials: 'include' })
        .then(r => r.json()),
  });

  const { data: ownedIds = [] } = useQuery<string[]>({
    queryKey: ['shop-collection', 'effect'],
    queryFn: () =>
      fetch('/api/v1/shop/collection?type=effect', { credentials: 'include' })
        .then(r => r.json())
        .then((items: { itemId: string }[]) => items.map(i => i.itemId))
        .catch(() => []),
  });

  const applyMutation = useMutation({
    mutationFn: (effectId: string | null) =>
      fetch('/api/v1/profiles/users/@me/customization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profileEffectId: effectId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onClose();
    },
  });

  const ownedItems = (catalog as { id: string; name: string; assetHash: string }[])
    .filter(d => ownedIds.includes(d.id));

  return (
    <div className="cosmetic-picker-overlay" onClick={onClose}>
      <div className="cosmetic-picker" onClick={e => e.stopPropagation()}>
        <div className="cosmetic-picker-header">
          <h3>Profile Effects</h3>
          <button type="button" className="cosmetic-picker-close" onClick={onClose}>✕</button>
        </div>
        {catalogError ? (
          <div className="cosmetic-picker-empty">
            <p>Failed to load. Please try again.</p>
          </div>
        ) : ownedItems.length === 0 ? (
          <div className="cosmetic-picker-empty">
            <p>You don't own any effects yet.</p>
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
                className={`cosmetic-item effect-item ${selected === item.id ? 'selected' : ''}`}
                onClick={() => setSelected(item.id)}
                title={item.name}
              >
                <img
                  src={`/api/v1/files/${item.assetHash}`}
                  alt={item.name}
                  className="cosmetic-item-img effect-preview"
                />
                <span className="effect-item-label">{item.name}</span>
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
