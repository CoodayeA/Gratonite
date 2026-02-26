import { useEffect, useState, type CSSProperties } from 'react';
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

/** Generate a stable hue from a string name for CSS-based previews */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function ShopItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

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

  // Load item detail, inventory, balance, and profile
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
        setDisplayName(me.profile.displayName);
        setAvatarHash(me.profile.avatarHash);

        // Check if currently equipped
        if (itemData.type === 'avatar_decoration') {
          setEquipped(me.profile.avatarDecorationId === itemId);
        } else if (itemData.type === 'profile_effect') {
          setEquipped(me.profile.profileEffectId === itemId);
        } else if (itemData.type === 'nameplate') {
          setEquipped(me.profile.nameplateId === itemId);
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
      <div className="shop-page">
        <div className="settings-muted" style={{ padding: 40, textAlign: 'center' }}>Loading item details...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="shop-page">
        <div className="shop-item-detail-empty">
          <h2>Item Not Found</h2>
          <p className="settings-muted">This item may have been removed or does not exist.</p>
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
    <div className="shop-page">
      <header className="shop-item-detail-header">
        <Link to="/shop" className="shop-item-detail-back">
          &larr; Back to Shop
        </Link>
      </header>

      <div className="shop-item-detail-layout">
        {/* Preview section */}
        <div className="shop-item-detail-preview">
          <div className="shop-item-detail-preview-card">
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
                <div className="shop-preview-ring shop-preview-ring-lg" style={{ '--ring-hue': hue } as CSSProperties}>
                  <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} userId={user.id} size={80} />
                </div>
              )
            )}
            {item.type === 'profile_effect' && (
              <div className="shop-effect-preview">
                <div className="shop-effect-card shop-effect-card-lg">
                  <div className="shop-effect-title">
                    <DisplayNameText text={resolvedDisplayName} userId={user.id} context="profile" />
                  </div>
                  {item.assetHash ? (
                    <img src={`/api/v1/files/${item.assetHash}`} alt="" aria-hidden="true" />
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
              <div className="shop-nameplate-preview shop-nameplate-preview-lg">
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
          {item.isFeatured && <div className="shop-item-detail-featured-badge">Featured</div>}
        </div>

        {/* Info section */}
        <div className="shop-item-detail-info">
          <div className="shop-item-detail-type">{typeLabel}</div>
          <h1 className="shop-item-detail-name">{item.name}</h1>
          {item.description && <p className="shop-item-detail-desc">{item.description}</p>}

          <div className="shop-item-detail-meta">
            <div className="shop-item-detail-price-row">
              <span className="shop-item-detail-price">{item.price.toLocaleString()} G</span>
              <span className="shop-item-detail-balance">
                Balance: <strong>{balance.toLocaleString()}</strong> Gratonites
              </span>
            </div>

            <div className="shop-item-detail-status">
              {owned && <span className="owned-badge">Owned</span>}
              {equipped && <span className="shop-item-detail-equipped-badge">Equipped</span>}
              {!item.isActive && <span className="shop-item-detail-inactive-badge">Unavailable</span>}
            </div>
          </div>

          {error && <div className="settings-error shop-error">{error}</div>}

          <div className="shop-item-detail-actions">
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
