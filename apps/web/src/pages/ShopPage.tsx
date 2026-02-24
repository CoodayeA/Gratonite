import { useEffect, useState, type CSSProperties } from 'react';
import type { AvatarDecoration, ProfileEffect, Nameplate } from '@gratonite/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DisplayNameText } from '@/components/ui/DisplayNameText';
import { useAuthStore } from '@/stores/auth.store';
import { api, type CommunityShopItem } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import {
  saveAvatarDecorationsCatalog,
  saveNameplatesCatalog,
  saveProfileEffectsCatalog,
} from '@/lib/profileCosmetics';

type CosmeticsTab = 'decorations' | 'effects' | 'nameplates' | 'creator' | 'gratonites';

interface ShopItem {
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

export function ShopPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [tab, setTab] = useState<CosmeticsTab>('decorations');
  const [displayName, setDisplayName] = useState('');
  const [avatarHash, setAvatarHash] = useState<string | null>(null);

  const [avatarDecorations, setAvatarDecorations] = useState<AvatarDecoration[]>([]);
  const [profileEffects, setProfileEffects] = useState<ProfileEffect[]>([]);
  const [nameplates, setNameplates] = useState<Nameplate[]>([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState('');
  const [equipping, setEquipping] = useState<'avatar' | 'effect' | 'nameplate' | null>(null);

  const [communityItems, setCommunityItems] = useState<CommunityShopItem[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState('');
  const [communityCreateLoading, setCommunityCreateLoading] = useState(false);
  const [communityDraftName, setCommunityDraftName] = useState('');
  const [communityDraftType, setCommunityDraftType] = useState<CommunityShopItem['itemType']>('display_name_style_pack');

  // Gratonites Shop state
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopBalance, setShopBalance] = useState(0);
  const [shopItemsLoading, setShopItemsLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [ownedItems, setOwnedItems] = useState<Set<string>>(new Set());

  // Load profile for avatar preview
  useEffect(() => {
    api.users.getMe()
      .then((me) => {
        setDisplayName(me.profile.displayName);
        setAvatarHash(me.profile.avatarHash);
        updateUser({
          avatarDecorationId: me.profile.avatarDecorationId ?? null,
          profileEffectId: me.profile.profileEffectId ?? null,
          nameplateId: me.profile.nameplateId ?? null,
        });
      })
      .catch(() => undefined);
  }, [updateUser]);

  // Load cosmetics catalogs
  useEffect(() => {
    let cancelled = false;
    async function loadCatalogs() {
      setShopLoading(true);
      setShopError('');
      try {
        const [decorations, effects, nameplateCatalog] = await Promise.all([
          api.profiles.getAvatarDecorations(),
          api.profiles.getProfileEffects(),
          api.profiles.getNameplates(),
        ]);
        if (cancelled) return;
        setAvatarDecorations(decorations);
        setProfileEffects(effects);
        setNameplates(nameplateCatalog);
        saveAvatarDecorationsCatalog(decorations);
        saveProfileEffectsCatalog(effects);
        saveNameplatesCatalog(nameplateCatalog);
      } catch (err) {
        if (!cancelled) setShopError(getErrorMessage(err));
      } finally {
        if (!cancelled) setShopLoading(false);
      }
    }
    loadCatalogs();
    return () => { cancelled = true; };
  }, []);

  // Load community creator drafts
  useEffect(() => {
    let cancelled = false;
    async function loadCommunityItems() {
      setCommunityLoading(true);
      setCommunityError('');
      try {
        const myItems = await api.communityShop.getMyItems();
        if (cancelled) return;
        setCommunityItems(myItems.created ?? []);
      } catch (err) {
        if (!cancelled) setCommunityError(getErrorMessage(err));
      } finally {
        if (!cancelled) setCommunityLoading(false);
      }
    }
    loadCommunityItems();
    return () => { cancelled = true; };
  }, []);

  // Load Gratonites shop items and balance
  useEffect(() => {
    let cancelled = false;
    async function loadGratonitesShop() {
      setShopItemsLoading(true);
      setShopError('');
      try {
        const [itemsRes, balanceRes, inventoryRes] = await Promise.all([
          fetch('/api/v1/shop/items', { credentials: 'include' }),
          fetch('/api/v1/gratonites/balance', { credentials: 'include' }),
          fetch('/api/v1/shop/inventory', { credentials: 'include' }),
        ]);
        
        if (cancelled) return;
        
        const items = itemsRes.ok ? await itemsRes.json() : [];
        const balance = balanceRes.ok ? await balanceRes.json() : { balance: 0 };
        const inventory = inventoryRes.ok ? await inventoryRes.json() : [];
        
        setShopItems(items);
        setShopBalance(balance.balance || 0);
        setOwnedItems(new Set(inventory.map((inv: any) => inv.itemId)));
      } catch (err) {
        if (!cancelled) setShopError(getErrorMessage(err));
      } finally {
        if (!cancelled) setShopItemsLoading(false);
      }
    }
    loadGratonitesShop();
    return () => { cancelled = true; };
  }, []);

  const resolvedDisplayName = displayName || user?.displayName || '';
  const resolvedAvatarHash = avatarHash ?? user?.avatarHash ?? null;

  async function handleEquipAvatarDecoration(decorationId: string | null) {
    setEquipping('avatar');
    setShopError('');
    try {
      await api.profiles.updateCustomization({ avatarDecorationId: decorationId });
      updateUser({ avatarDecorationId: decorationId });
    } catch (err) {
      setShopError(getErrorMessage(err));
    } finally {
      setEquipping(null);
    }
  }

  async function handleEquipProfileEffect(effectId: string | null) {
    setEquipping('effect');
    setShopError('');
    try {
      await api.profiles.updateCustomization({ profileEffectId: effectId });
      updateUser({ profileEffectId: effectId });
    } catch (err) {
      setShopError(getErrorMessage(err));
    } finally {
      setEquipping(null);
    }
  }

  async function handleEquipNameplate(nameplateId: string | null) {
    setEquipping('nameplate');
    setShopError('');
    try {
      await api.profiles.updateCustomization({ nameplateId });
      updateUser({ nameplateId });
    } catch (err) {
      setShopError(getErrorMessage(err));
    } finally {
      setEquipping(null);
    }
  }

  async function handleCreateCommunityDraft() {
    if (!communityDraftName.trim()) return;
    setCommunityCreateLoading(true);
    setCommunityError('');
    try {
      const created = await api.communityShop.createItem({
        itemType: communityDraftType,
        name: communityDraftName.trim(),
        payload: {},
        tags: ['community'],
      });
      setCommunityItems((current) => [created, ...current]);
      setCommunityDraftName('');
    } catch (err) {
      setCommunityError(getErrorMessage(err));
    } finally {
      setCommunityCreateLoading(false);
    }
  }

  async function handleSubmitCommunityItem(itemId: string) {
    setCommunityError('');
    try {
      const updated = await api.communityShop.submitForReview(itemId);
      setCommunityItems((current) => current.map((item) => (item.id === itemId ? updated : item)));
    } catch (err) {
      setCommunityError(getErrorMessage(err));
    }
  }

  async function handlePurchaseItem(itemId: string, price: number) {
    if (shopBalance < price) {
      setShopError(`Not enough Gratonites! You need ${price} but only have ${shopBalance}.`);
      return;
    }
    
    setPurchasing(itemId);
    setShopError('');
    try {
      const res = await fetch('/api/v1/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.code || 'Purchase failed');
      }
      
      // Update owned items and balance
      setOwnedItems((prev) => new Set([...prev, itemId]));
      setShopBalance((prev) => prev - price);
    } catch (err) {
      setShopError(getErrorMessage(err));
    } finally {
      setPurchasing(null);
    }
  }

  function renderShopCard(item: ShopItem, owned: boolean, canAfford: boolean, hue: number) {
    return (
      <article key={item.id} className={`shop-item ${owned ? 'shop-item-owned' : ''}`}>
        <div className="shop-item-preview">
          {item.type === 'avatar_decoration' && (
            item.assetHash ? (
              <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} decorationHash={item.assetHash} userId={user!.id} size={56} />
            ) : (
              <div className="shop-preview-ring" style={{ '--ring-hue': hue } as CSSProperties}>
                <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} userId={user!.id} size={48} />
              </div>
            )
          )}
          {item.type === 'profile_effect' && (
            item.assetHash ? (
              <div className="shop-effect-preview-small">
                <img src={`/api/v1/files/${item.assetHash}`} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} />
              </div>
            ) : (
              <div className="shop-preview-effect" style={{ '--effect-hue': hue } as CSSProperties} />
            )
          )}
          {item.type === 'nameplate' && (
            item.assetHash ? (
              <span className="display-name-nameplate nameplate-from-asset" style={{ '--nameplate-image': `url(/api/v1/files/${item.assetHash})` } as CSSProperties}>{resolvedDisplayName}</span>
            ) : (
              <span className="shop-preview-nameplate" style={{ '--np-hue': hue } as CSSProperties}>{resolvedDisplayName}</span>
            )
          )}
        </div>
        <div className="shop-item-name">{item.name}</div>
        {item.description && <div className="shop-item-description">{item.description}</div>}
        <div className="shop-item-price">
          <span className={`price-tag ${!canAfford && !owned ? 'price-unaffordable' : ''}`}>{item.price.toLocaleString()} G</span>
          {owned && <span className="owned-badge">Owned</span>}
        </div>
        <Button variant={owned ? 'ghost' : 'primary'} loading={purchasing === item.id} disabled={owned || !canAfford} onClick={() => handlePurchaseItem(item.id, item.price)}>
          {owned ? 'Owned' : canAfford ? 'Purchase' : 'Too Expensive'}
        </Button>
      </article>
    );
  }

  if (!user) return null;

  return (
    <div className="shop-page">
      <header className="shop-hero">
        <div className="shop-eyebrow">Shop</div>
        <h1 className="shop-title">Cosmetics &amp; Identity</h1>
        <p className="shop-subtitle">
          Gratonite is cosmetic-first. Customize your presence with avatar decorations, profile effects, and nameplates.
        </p>
      </header>

      <div className="shop-tabs" role="tablist">
        {([
          ['decorations', 'Avatar Decorations'],
          ['effects', 'Profile Effects'],
          ['nameplates', 'Nameplates'],
          ['gratonites', 'Gratonites Shop'],
          ['creator', 'Creator'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`shop-tab ${tab === value ? 'shop-tab-active' : ''}`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {shopError && <div className="settings-error shop-error">{shopError}</div>}

      {tab === 'decorations' && (
        <section className="shop-section">
          <div className="shop-section-header">Avatar Decorations</div>
          <p className="shop-section-desc">Frames and overlays that surround your avatar in chats and profiles.</p>
          {shopLoading ? (
            <div className="settings-muted">Loading decorations…</div>
          ) : avatarDecorations.length === 0 ? (
            <div className="settings-muted">No decorations available yet.</div>
          ) : (
            <div className="shop-grid">
              {avatarDecorations.map((decoration) => {
                const equipped = user.avatarDecorationId === decoration.id;
                const hue = nameToHue(decoration.name);
                return (
                  <article key={decoration.id} className={`shop-item ${equipped ? 'shop-item-equipped' : ''}`}>
                    <div className="shop-item-preview">
                      {decoration.assetHash ? (
                        <Avatar
                          name={resolvedDisplayName}
                          hash={resolvedAvatarHash}
                          decorationHash={decoration.assetHash}
                          userId={user.id}
                          size={56}
                        />
                      ) : (
                        <div className="shop-preview-ring" style={{ '--ring-hue': hue } as CSSProperties}>
                          <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} userId={user.id} size={48} />
                        </div>
                      )}
                    </div>
                    <div className="shop-item-name">{decoration.name}</div>
                    {decoration.description && (
                      <div className="shop-item-description">{decoration.description}</div>
                    )}
                    <Button
                      variant={equipped ? 'ghost' : 'primary'}
                      loading={equipping === 'avatar'}
                      onClick={() => handleEquipAvatarDecoration(equipped ? null : decoration.id)}
                    >
                      {equipped ? 'Remove' : 'Equip'}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'effects' && (
        <section className="shop-section">
          <div className="shop-section-header">Profile Effects</div>
          <p className="shop-section-desc">Animated overlays displayed on your profile card.</p>
          {shopLoading ? (
            <div className="settings-muted">Loading effects…</div>
          ) : profileEffects.length === 0 ? (
            <div className="settings-muted">No effects available yet.</div>
          ) : (
            <div className="shop-grid">
              {profileEffects.map((effect) => {
                const equipped = user.profileEffectId === effect.id;
                const hue = nameToHue(effect.name);
                return (
                  <article key={effect.id} className={`shop-item ${equipped ? 'shop-item-equipped' : ''}`}>
                    <div className="shop-effect-preview">
                      <div className="shop-effect-card">
                        <div className="shop-effect-title">
                          <DisplayNameText
                            text={resolvedDisplayName}
                            userId={user.id}
                            context="profile"
                          />
                        </div>
                        {effect.assetHash ? (
                          <img src={`/api/v1/files/${effect.assetHash}`} alt="" aria-hidden="true" />
                        ) : (
                          <div className="shop-preview-effect" style={{ '--effect-hue': hue, position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit' } as CSSProperties} />
                        )}
                      </div>
                    </div>
                    <div className="shop-item-name">{effect.name}</div>
                    {effect.description && (
                      <div className="shop-item-description">{effect.description}</div>
                    )}
                    <Button
                      variant={equipped ? 'ghost' : 'primary'}
                      loading={equipping === 'effect'}
                      onClick={() => handleEquipProfileEffect(equipped ? null : effect.id)}
                    >
                      {equipped ? 'Remove' : 'Equip'}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'nameplates' && (
        <section className="shop-section">
          <div className="shop-section-header">Nameplates</div>
          <p className="shop-section-desc">Custom backgrounds for your display name in chats.</p>
          {shopLoading ? (
            <div className="settings-muted">Loading nameplates…</div>
          ) : nameplates.length === 0 ? (
            <div className="settings-muted">No nameplates available yet.</div>
          ) : (
            <div className="shop-grid">
              {nameplates.map((nameplate) => {
                const equipped = user.nameplateId === nameplate.id;
                const hue = nameToHue(nameplate.name);
                return (
                  <article key={nameplate.id} className={`shop-item ${equipped ? 'shop-item-equipped' : ''}`}>
                    <div className="shop-nameplate-preview">
                      {nameplate.assetHash ? (
                        <span
                          className="display-name-nameplate nameplate-from-asset"
                          style={{ '--nameplate-image': `url(/api/v1/files/${nameplate.assetHash})` } as CSSProperties}
                        >
                          {resolvedDisplayName}
                        </span>
                      ) : (
                        <span className="shop-preview-nameplate" style={{ '--np-hue': hue } as CSSProperties}>
                          {resolvedDisplayName}
                        </span>
                      )}
                    </div>
                    <div className="shop-item-name">{nameplate.name}</div>
                    <div className="shop-item-description">{nameplate.description ?? ''}</div>
                    <Button
                      variant={equipped ? 'ghost' : 'primary'}
                      loading={equipping === 'nameplate'}
                      onClick={() => handleEquipNameplate(equipped ? null : nameplate.id)}
                    >
                      {equipped ? 'Remove' : 'Equip'}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'gratonites' && (
        <section className="shop-section">
          {/* Balance banner */}
          <div className="shop-balance-banner">
            <div className="shop-balance-coin">⬡</div>
            <div className="shop-balance-info">
              <div className="shop-balance-amount">{shopBalance.toLocaleString()}</div>
              <div className="shop-balance-label">Gratonites</div>
            </div>
          </div>

          {shopItemsLoading ? (
            <div className="settings-muted">Loading shop items…</div>
          ) : shopItems.length === 0 ? (
            <div className="settings-muted">No items available yet. Check back soon!</div>
          ) : (
            <>
              {/* Featured items */}
              {shopItems.some((i) => i.isFeatured) && (
                <div className="shop-featured-section">
                  <div className="shop-section-header">⭐ Featured</div>
                  <div className="shop-grid shop-grid-featured">
                    {shopItems.filter((i) => i.isFeatured).map((item) => {
                      const owned = ownedItems.has(item.id);
                      const canAfford = shopBalance >= item.price;
                      const hue = nameToHue(item.name);
                      return (
                        <article key={item.id} className={`shop-item shop-item-featured ${owned ? 'shop-item-owned' : ''}`}>
                          <div className="shop-item-type-badge">{item.type === 'avatar_decoration' ? '🎭' : item.type === 'profile_effect' ? '✨' : '🏷️'}</div>
                          <div className="shop-item-preview">
                            {item.type === 'avatar_decoration' && (
                              item.assetHash ? (
                                <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} decorationHash={item.assetHash} userId={user.id} size={56} />
                              ) : (
                                <div className="shop-preview-ring" style={{ '--ring-hue': hue } as CSSProperties}>
                                  <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} userId={user.id} size={48} />
                                </div>
                              )
                            )}
                            {item.type === 'profile_effect' && (
                              item.assetHash ? (
                                <div className="shop-effect-preview-small"><img src={`/api/v1/files/${item.assetHash}`} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} /></div>
                              ) : (
                                <div className="shop-preview-effect" style={{ '--effect-hue': hue } as CSSProperties} />
                              )
                            )}
                            {item.type === 'nameplate' && (
                              item.assetHash ? (
                                <span className="display-name-nameplate nameplate-from-asset" style={{ '--nameplate-image': `url(/api/v1/files/${item.assetHash})` } as CSSProperties}>{resolvedDisplayName}</span>
                              ) : (
                                <span className="shop-preview-nameplate" style={{ '--np-hue': hue } as CSSProperties}>{resolvedDisplayName}</span>
                              )
                            )}
                          </div>
                          <div className="shop-item-name">{item.name}</div>
                          <div className="shop-item-price">
                            <span className={`price-tag ${!canAfford && !owned ? 'price-unaffordable' : ''}`}>{item.price.toLocaleString()} G</span>
                            {owned && <span className="owned-badge">Owned</span>}
                          </div>
                          <Button variant={owned ? 'ghost' : 'primary'} loading={purchasing === item.id} disabled={owned || !canAfford} onClick={() => handlePurchaseItem(item.id, item.price)}>
                            {owned ? 'Owned' : canAfford ? 'Purchase' : 'Too Expensive'}
                          </Button>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Avatar Decorations */}
              {shopItems.some((i) => i.type === 'avatar_decoration') && (
                <div className="shop-type-section">
                  <div className="shop-section-header">🎭 Avatar Decorations</div>
                  <div className="shop-grid">
                    {shopItems.filter((i) => i.type === 'avatar_decoration').map((item) => {
                      const owned = ownedItems.has(item.id);
                      const canAfford = shopBalance >= item.price;
                      const hue = nameToHue(item.name);
                      return renderShopCard(item, owned, canAfford, hue);
                    })}
                  </div>
                </div>
              )}

              {/* Profile Effects */}
              {shopItems.some((i) => i.type === 'profile_effect') && (
                <div className="shop-type-section">
                  <div className="shop-section-header">✨ Profile Effects</div>
                  <div className="shop-grid">
                    {shopItems.filter((i) => i.type === 'profile_effect').map((item) => {
                      const owned = ownedItems.has(item.id);
                      const canAfford = shopBalance >= item.price;
                      const hue = nameToHue(item.name);
                      return renderShopCard(item, owned, canAfford, hue);
                    })}
                  </div>
                </div>
              )}

              {/* Nameplates */}
              {shopItems.some((i) => i.type === 'nameplate') && (
                <div className="shop-type-section">
                  <div className="shop-section-header">🏷️ Nameplates</div>
                  <div className="shop-grid">
                    {shopItems.filter((i) => i.type === 'nameplate').map((item) => {
                      const owned = ownedItems.has(item.id);
                      const canAfford = shopBalance >= item.price;
                      const hue = nameToHue(item.name);
                      return renderShopCard(item, owned, canAfford, hue);
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'creator' && (
        <section className="shop-section">
          <div className="shop-section-header">Community Creator Drafts</div>
          <p className="shop-section-desc">Create and submit cosmetic items for community review.</p>
          <div className="settings-field-control settings-field-row">
            <select
              className="settings-select"
              value={communityDraftType}
              onChange={(e) => setCommunityDraftType(e.target.value as CommunityShopItem['itemType'])}
            >
              <option value="display_name_style_pack">Display Name Style Pack</option>
              <option value="profile_widget_pack">Profile Widget Pack</option>
              <option value="server_tag_badge">Portal Tag Badge</option>
              <option value="avatar_decoration">Avatar Decoration</option>
              <option value="profile_effect">Profile Effect</option>
              <option value="nameplate">Nameplate</option>
            </select>
            <Input
              type="text"
              value={communityDraftName}
              onChange={(e) => setCommunityDraftName(e.target.value)}
              placeholder="New community item name"
            />
            <Button
              loading={communityCreateLoading}
              disabled={!communityDraftName.trim()}
              onClick={handleCreateCommunityDraft}
            >
              Create Draft
            </Button>
          </div>
          {communityError && <div className="settings-error">{communityError}</div>}
          {communityLoading ? (
            <div className="settings-muted">Loading creator drafts…</div>
          ) : (
            <div className="shop-grid">
              {communityItems.slice(0, 8).map((item) => (
                <article key={item.id} className="shop-item">
                  <div className="shop-item-name">{item.name}</div>
                  <div className="shop-item-description">
                    {item.itemType.replaceAll('_', ' ')} · {item.status.replaceAll('_', ' ')}
                  </div>
                  <Button
                    variant="ghost"
                    disabled={item.status === 'pending_review' || item.status === 'published'}
                    onClick={() => handleSubmitCommunityItem(item.id)}
                  >
                    {item.status === 'pending_review' ? 'In Review' : item.status === 'published' ? 'Published' : 'Submit Review'}
                  </Button>
                </article>
              ))}
              {communityItems.length === 0 && !communityLoading && (
                <div className="settings-muted">No creator drafts yet.</div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
