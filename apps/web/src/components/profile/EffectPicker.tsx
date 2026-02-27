import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

interface EffectPickerProps {
  onClose: () => void;
  currentEffectId: string | null;
}

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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 8,
    padding: 16,
    overflowY: 'auto',
  } as React.CSSProperties,
  cosmeticItem: {
    aspectRatio: '1',
    borderRadius: 'var(--radius-md)',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'transparent',
    background: 'var(--bg, #2c2c3e)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.15s',
    overflow: 'hidden',
  } as React.CSSProperties,
  cosmeticItemSelected: {
    aspectRatio: '1',
    borderRadius: 'var(--radius-md)',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'var(--accent, #d4af37)',
    background: 'var(--bg, #2c2c3e)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.15s',
    overflow: 'hidden',
  } as React.CSSProperties,
  effectItem: {
    flexDirection: 'column',
    gap: 4,
    padding: 8,
  } as React.CSSProperties,
  cosmeticItemNone: {
    fontSize: 11,
    color: 'var(--text-muted, #a8a4b8)',
  } as React.CSSProperties,
  cosmeticItemImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  } as React.CSSProperties,
  effectItemLabel: {
    fontSize: 10,
    color: 'var(--text-muted, #a8a4b8)',
    textAlign: 'center',
  } as React.CSSProperties,
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    color: 'var(--text-muted, #a8a4b8)',
  } as React.CSSProperties,
  footer: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    padding: '12px 20px',
    borderTop: '1px solid var(--stroke, #4a4660)',
  } as React.CSSProperties,
  btnPrimary: {
    background: 'var(--accent, #d4af37)',
    color: 'var(--text-on-gold, #1a1a2e)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,
  btnGhost: {
    background: 'none',
    color: 'var(--text-muted, #a8a4b8)',
    border: '1px solid var(--stroke, #4a4660)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    cursor: 'pointer',
  } as React.CSSProperties,
} as const;

export function EffectPicker({ onClose, currentEffectId }: EffectPickerProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(currentEffectId);
  const [closeHover, setCloseHover] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

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

  const getItemStyle = (itemId: string | null, isEffect: boolean): React.CSSProperties => {
    const base = selected === itemId ? styles.cosmeticItemSelected : styles.cosmeticItem;
    const hoverBorder = hoveredItemId === itemId && selected !== itemId
      ? { borderColor: 'var(--text-muted, #a8a4b8)' }
      : {};
    return isEffect
      ? { ...base, ...styles.effectItem, ...hoverBorder }
      : { ...base, ...hoverBorder };
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.picker} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.headerTitle}>Profile Effects</h3>
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
        {catalogError ? (
          <div style={styles.empty}>
            <p>Failed to load. Please try again.</p>
          </div>
        ) : ownedItems.length === 0 ? (
          <div style={styles.empty}>
            <p>You don't own any effects yet.</p>
            <button type="button" style={styles.btnPrimary} onClick={() => { navigate('/app/shop'); onClose(); }}>Visit Shop</button>
          </div>
        ) : (
          <div style={styles.grid}>
            <button
              type="button"
              style={getItemStyle(null, false)}
              onClick={() => setSelected(null)}
              onMouseEnter={() => setHoveredItemId('__none__')}
              onMouseLeave={() => setHoveredItemId(null)}
            >
              <span style={styles.cosmeticItemNone}>None</span>
            </button>
            {ownedItems.map(item => (
              <button
                key={item.id}
                type="button"
                style={getItemStyle(item.id, true)}
                onClick={() => setSelected(item.id)}
                onMouseEnter={() => setHoveredItemId(item.id)}
                onMouseLeave={() => setHoveredItemId(null)}
                title={item.name}
              >
                <img
                  src={`/api/v1/files/${item.assetHash}`}
                  alt={item.name}
                  style={styles.cosmeticItemImg}
                />
                <span style={styles.effectItemLabel}>{item.name}</span>
              </button>
            ))}
          </div>
        )}
        <div style={styles.footer}>
          <button type="button" style={styles.btnGhost} onClick={onClose}>Cancel</button>
          <button
            type="button"
            style={styles.btnPrimary}
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
