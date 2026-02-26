import React, { useEffect, useState, type CSSProperties } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DisplayNameText } from '@/components/ui/DisplayNameText';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

interface ShopItemDetail {
  id: string;
  name: string;
  description: string;
  type: 'avatar_decoration' | 'profile_effect' | 'nameplate';
  category: string;
  price: number;
  assetHash: string | null;
  isActive: boolean;
  isFeatured: boolean;
}

function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  shopPage: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    padding: 20,
    display: 'grid',
    alignContent: 'start',
    gap: 14,
  } as React.CSSProperties,

  settingsMuted: {
    color: 'var(--text-muted)',
    fontSize: 14,
  } as React.CSSProperties,

  detailEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '60px 20px',
    textAlign: 'center',
    color: 'var(--text)',
  } as React.CSSProperties,

  detailHeader: {
    marginBottom: 20,
  } as React.CSSProperties,

  detailBack: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 500,
    transition: 'color 0.15s ease',
  } as React.CSSProperties,

  detailLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 32,
    alignItems: 'start',
  } as React.CSSProperties,

  detailPreview: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  detailPreviewCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--stroke)',
    background: 'rgba(16, 21, 32, 0.64)',
    minHeight: 200,
    width: '100%',
  } as React.CSSProperties,

  previewRingLg: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  } as React.CSSProperties,

  effectPreview: {
    borderRadius: 10,
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.03)',
    minHeight: 84,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  } as React.CSSProperties,

  effectCard: {
    position: 'relative',
    width: '100%',
    minHeight: 78,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'linear-gradient(120deg, rgba(55, 63, 90, 0.44), rgba(33, 38, 52, 0.5))',
  } as React.CSSProperties,

  effectCardLg: { width: 260, height: 160 } as React.CSSProperties,

  effectCardImg: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.42,
  } as React.CSSProperties,

  effectTitle: {
    position: 'relative',
    zIndex: 1,
    padding: 10,
    fontWeight: 700,
  } as React.CSSProperties,

  nameplatePreview: {
    borderRadius: 10,
    border: '1px solid var(--stroke)',
    background: 'rgba(255, 255, 255, 0.03)',
    minHeight: 84,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  } as React.CSSProperties,

  nameplatePreviewLg: {
    minHeight: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  featuredBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 12px',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#fbbf24',
    background: 'rgba(251, 191, 36, 0.12)',
    border: '1px solid rgba(251, 191, 36, 0.2)',
    borderRadius: 'var(--radius-pill)',
  } as React.CSSProperties,

  detailInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  } as React.CSSProperties,

  detailType: {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-faint)',
  } as React.CSSProperties,

  detailName: {
    fontFamily: 'var(--font-display)',
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
    lineHeight: 1.2,
  } as React.CSSProperties,

  detailDesc: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    margin: 0,
  } as React.CSSProperties,

  detailMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 16,
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--stroke)',
    background: 'rgba(16, 21, 32, 0.4)',
  } as React.CSSProperties,

  priceRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as React.CSSProperties,

  price: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#fbbf24',
    fontVariantNumeric: 'tabular-nums',
  } as React.CSSProperties,

  balance: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  balanceStrong: {
    color: '#fbbf24',
  } as React.CSSProperties,

  detailStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  ownedBadge: {
    fontSize: 11,
    color: '#22c55e',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  } as React.CSSProperties,

  equippedBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'rgba(96, 130, 255, 0.9)',
    background: 'rgba(96, 130, 255, 0.12)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-pill)',
  } as React.CSSProperties,

  inactiveBadge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-faint)',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-pill)',
  } as React.CSSProperties,

  settingsError: {
    color: 'var(--danger)',
    fontSize: 13,
    margin: '0 0 4px',
  } as React.CSSProperties,

  detailActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShopItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((st) => st.user);
  const updateUser = useAuthStore((st) => st.updateUser);

  const [item, setItem] = useState<ShopItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [owned, setOwned] = useState(false);
  const [balance, setBalance] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [avatarHash, setAvatarHash] = useState<string | null>(null);
  const [equipped, setEquipped] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [hoveredBack, setHoveredBack] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const [itemRes, balanceRes, inventoryRes, me] = await Promise.all([
          fetch(`/api/v1/shop/items/${itemId}`, { credentials: 'include' }),
          fetch('/api/v1/economy/wallet', { credentials: 'include' }),
          fetch('/api/v1/shop/inventory', { credentials: 'include' }),
          api.users.getMe(),
        ]);

        if (cancelled) return;

        if (!itemRes.ok) {
          setError('Item not found.');
          setLoading(false);
          return;
        }

        const itemData = await itemRes.json();
        const wallet = balanceRes.ok ? await balanceRes.json() : { balance: 0 };
        const rawInventory = inventoryRes.ok ? await inventoryRes.json() : [];
        const inventory = Array.isArray(rawInventory) ? rawInventory : [];

        setItem(itemData);
        setBalance(wallet.balance || 0);
        setOwned(inventory.some((inv: any) => inv.itemId === itemId));
        setDisplayName(me.profile?.displayName ?? me.username);
        setAvatarHash(me.profile?.avatarHash ?? null);

        if (itemData.type === 'avatar_decoration') {
          setEquipped(me.profile?.avatarDecorationId === itemId);
        } else if (itemData.type === 'profile_effect') {
          setEquipped(me.profile?.profileEffectId === itemId);
        } else if (itemData.type === 'nameplate') {
          setEquipped(me.profile?.nameplateId === itemId);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [itemId]);

  const resolvedDisplayName = displayName || user?.displayName || '';
  const resolvedAvatarHash = avatarHash ?? user?.avatarHash ?? null;
  const canAfford = balance >= (item?.price ?? 0);

  async function handlePurchase() {
    if (!item || owned || !canAfford) return;
    setPurchasing(true);
    setError('');
    try {
      const res = await fetch('/api/v1/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId: item.id }),
      });

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.code || 'Purchase failed');
      }

      setOwned(true);
      setBalance((prev) => prev - item.price);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPurchasing(false);
    }
  }

  async function handleEquip() {
    if (!item) return;
    setEquipping(true);
    setError('');
    try {
      if (item.type === 'avatar_decoration') {
        await api.profiles.updateCustomization({ avatarDecorationId: equipped ? null : item.id });
        updateUser({ avatarDecorationId: equipped ? null : item.id });
      } else if (item.type === 'profile_effect') {
        await api.profiles.updateCustomization({ profileEffectId: equipped ? null : item.id });
        updateUser({ profileEffectId: equipped ? null : item.id });
      } else if (item.type === 'nameplate') {
        await api.profiles.updateCustomization({ nameplateId: equipped ? null : item.id });
        updateUser({ nameplateId: equipped ? null : item.id });
      }
      setEquipped(!equipped);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setEquipping(false);
    }
  }

  if (!user) return null;

  if (loading) {
    return (
      <div style={s.shopPage}>
        <div style={{ ...s.settingsMuted, padding: 40, textAlign: 'center' }}>Loading item details...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={s.shopPage}>
        <div style={s.detailEmpty}>
          <h2>Item Not Found</h2>
          <p style={s.settingsMuted}>This item may have been removed or does not exist.</p>
          <Button variant="ghost" onClick={() => navigate('/shop')}>
            Back to Shop
          </Button>
        </div>
      </div>
    );
  }

  const hue = nameToHue(item.name);
  const typeLabel =
    item.type === 'avatar_decoration'
      ? 'Avatar Decoration'
      : item.type === 'profile_effect'
        ? 'Profile Effect'
        : 'Nameplate';

  return (
    <div style={s.shopPage}>
      <header style={s.detailHeader}>
        <Link
          to="/shop"
          style={{
            ...s.detailBack,
            ...(hoveredBack ? { color: 'var(--accent)' } : {}),
          }}
          onMouseEnter={() => setHoveredBack(true)}
          onMouseLeave={() => setHoveredBack(false)}
        >
          &larr; Back to Shop
        </Link>
      </header>

      <div style={s.detailLayout}>
        {/* Preview section */}
        <div style={s.detailPreview}>
          <div style={s.detailPreviewCard}>
            {item.type === 'avatar_decoration' && (
              item.assetHash ? (
                <Avatar
                  name={resolvedDisplayName}
                  hash={resolvedAvatarHash}
                  decorationHash={item.assetHash}
                  userId={user.id}
                  size={96}
                />
              ) : (
                <div
                  className="shop-preview-ring shop-preview-ring-lg"
                  style={{ '--ring-hue': hue, ...s.previewRingLg, background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue + 40} 70% 65%))` } as CSSProperties}
                >
                  <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} userId={user.id} size={80} />
                </div>
              )
            )}
            {item.type === 'profile_effect' && (
              <div style={s.effectPreview}>
                <div style={{ ...s.effectCard, ...s.effectCardLg }}>
                  <div style={s.effectTitle}>
                    <DisplayNameText text={resolvedDisplayName} userId={user.id} context="profile" />
                  </div>
                  {item.assetHash ? (
                    <img src={`/api/v1/files/${item.assetHash}`} alt="" aria-hidden="true" style={s.effectCardImg} />
                  ) : (
                    <div
                      className="shop-preview-effect"
                      style={{ '--effect-hue': hue, position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit' } as CSSProperties}
                    />
                  )}
                </div>
              </div>
            )}
            {item.type === 'nameplate' && (
              <div style={s.nameplatePreviewLg}>
                {item.assetHash ? (
                  <span
                    className="display-name-nameplate nameplate-from-asset"
                    style={{ '--nameplate-image': `url(/api/v1/files/${item.assetHash})`, fontSize: '1.4rem' } as CSSProperties}
                  >
                    {resolvedDisplayName}
                  </span>
                ) : (
                  <span className="shop-preview-nameplate" style={{ '--np-hue': hue, fontSize: '1.4rem' } as CSSProperties}>
                    {resolvedDisplayName}
                  </span>
                )}
              </div>
            )}
          </div>
          {item.isFeatured && <div style={s.featuredBadge}>Featured</div>}
        </div>

        {/* Info section */}
        <div style={s.detailInfo}>
          <div style={s.detailType}>{typeLabel}</div>
          <h1 style={s.detailName}>{item.name}</h1>
          {item.description && <p style={s.detailDesc}>{item.description}</p>}

          <div style={s.detailMeta}>
            <div style={s.priceRow}>
              <span style={s.price}>{item.price.toLocaleString()} G</span>
              <span style={s.balance}>
                Balance: <strong style={s.balanceStrong}>{balance.toLocaleString()}</strong> Gratonites
              </span>
            </div>

            <div style={s.detailStatus}>
              {owned && <span style={s.ownedBadge}>Owned</span>}
              {equipped && <span style={s.equippedBadge}>Equipped</span>}
              {!item.isActive && <span style={s.inactiveBadge}>Unavailable</span>}
            </div>
          </div>

          {error && <div style={s.settingsError}>{error}</div>}

          <div style={s.detailActions}>
            {!owned ? (
              <Button
                variant="primary"
                size="lg"
                loading={purchasing}
                disabled={!canAfford || !item.isActive}
                onClick={handlePurchase}
              >
                {canAfford ? `Purchase for ${item.price.toLocaleString()} G` : 'Not Enough Gratonites'}
              </Button>
            ) : (
              <Button
                variant={equipped ? 'ghost' : 'primary'}
                size="lg"
                loading={equipping}
                onClick={handleEquip}
              >
                {equipped ? 'Unequip' : 'Equip'}
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate('/shop')}>
              Back to Shop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
