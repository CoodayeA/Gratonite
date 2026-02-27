import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AvatarDecoration, ProfileEffect, Nameplate } from '@gratonite/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
// Input and DisplayNameText removed — no longer used in sidebar layout
import { useAuthStore } from '@/stores/auth.store';
import { api, type CommunityShopItem } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import {
  saveAvatarDecorationsCatalog,
  saveNameplatesCatalog,
  saveProfileEffectsCatalog,
} from '@/lib/profileCosmetics';

type CosmeticsTab = 'decorations' | 'effects' | 'nameplates' | 'soundboard' | 'creator' | 'gratonites';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: 'avatar_decoration' | 'profile_effect' | 'nameplate' | 'soundboard_sound';
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
  const navigate = useNavigate();

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
        setDisplayName(me.profile?.displayName ?? me.username);
        setAvatarHash(me.profile?.avatarHash ?? null);
        updateUser({
          avatarDecorationId: me.profile?.avatarDecorationId ?? null,
          profileEffectId: me.profile?.profileEffectId ?? null,
          nameplateId: me.profile?.nameplateId ?? null,
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
        const [rawItems, wallet, rawInventory] = await Promise.all([
          api.shop.getItems().catch(() => []),
          api.economy.getWallet().catch(() => ({ balance: 0 } as any)),
          api.shop.getInventory().catch(() => []),
        ]);

        if (cancelled) return;

        const items = Array.isArray(rawItems) ? rawItems : [];
        const inventory = Array.isArray(rawInventory) ? rawInventory : [];

        setShopItems(items);
        setShopBalance(wallet.balance || 0);
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
      await api.shop.purchase(itemId);

      // Update owned items and balance
      setOwnedItems((prev) => new Set([...prev, itemId]));
      setShopBalance((prev) => prev - price);
    } catch (err) {
      setShopError(getErrorMessage(err));
    } finally {
      setPurchasing(null);
    }
  }


  /* ------------------------------------------------------------------ */
  /*  Inline styles matching "Desktop — Shop" mockup                     */
  /* ------------------------------------------------------------------ */

  const S = {
    /* Root: horizontal flex with sidebar + main */
    root: {
      display: 'flex',
      height: '100%',
      minHeight: 0,
      overflow: 'hidden',
    } as CSSProperties,

    /* Left sidebar (Shop Categories panel) */
    sidebar: {
      width: 240,
      minWidth: 240,
      background: 'var(--bg-elevated)',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      height: '100%',
      overflowY: 'auto',
      borderRight: '1px solid var(--stroke)',
    } as CSSProperties,

    sidebarTitle: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--text)',
      margin: 0,
      marginBottom: 8,
    } as CSSProperties,

    catItem: (active: boolean) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      borderRadius: 'var(--radius-sm)',
      border: 'none',
      cursor: 'pointer',
      width: '100%',
      fontSize: 14,
      fontWeight: active ? 500 : 400,
      color: active ? 'var(--accent)' : 'var(--text-muted)',
      background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
      transition: 'background .15s, color .15s',
      textAlign: 'left' as const,
    }) as CSSProperties,

    catIcon: (active: boolean) => ({
      width: 16,
      height: 16,
      flexShrink: 0,
      color: active ? 'var(--accent)' : 'var(--text-faint)',
    }) as CSSProperties,

    /* Main content area */
    main: {
      flex: 1,
      minWidth: 0,
      padding: '32px 40px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      overflowY: 'auto',
      height: '100%',
    } as CSSProperties,

    /* Balance banner */
    balanceBanner: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderRadius: 'var(--radius-lg)',
      background: 'linear-gradient(90deg, color-mix(in srgb, var(--accent) 14%, transparent) 0%, color-mix(in srgb, var(--accent) 3%, transparent) 100%)',
      border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
    } as CSSProperties,

    balanceLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    } as CSSProperties,

    balanceGem: {
      width: 24,
      height: 24,
      color: 'var(--accent)',
    } as CSSProperties,

    balanceLabel: {
      fontSize: 12,
      color: 'var(--text-muted)',
      margin: 0,
    } as CSSProperties,

    balanceValue: {
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--accent)',
      margin: 0,
    } as CSSProperties,

    buyMoreBtn: {
      padding: '8px 20px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--accent)',
      color: 'var(--bg)',
      border: 'none',
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
    } as CSSProperties,

    /* Section header row */
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    } as CSSProperties,

    sectionTitle: {
      fontSize: 24,
      fontWeight: 700,
      color: 'var(--text)',
      margin: 0,
    } as CSSProperties,

    balancePill: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      borderRadius: 10,
      background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--accent) 19%, transparent)',
    } as CSSProperties,

    balancePillIcon: {
      width: 16,
      height: 16,
      color: 'var(--accent)',
    } as CSSProperties,

    balancePillText: {
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--accent)',
    } as CSSProperties,

    /* Item grid */
    itemGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 16,
    } as CSSProperties,

    /* Card */
    card: {
      borderRadius: 10,
      overflow: 'hidden',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--stroke)',
      display: 'flex',
      flexDirection: 'column',
    } as CSSProperties,

    cardPreview: (hue: number) => ({
      height: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(180deg, hsl(${hue} 30% 35%) 0%, hsl(${hue} 20% 22%) 100%)`,
    }) as CSSProperties,

    cardPreviewIcon: (hue: number) => ({
      width: 32,
      height: 32,
      opacity: 0.5,
      color: `hsl(${hue} 50% 70%)`,
    }) as CSSProperties,

    cardBody: {
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    } as CSSProperties,

    cardName: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text)',
      margin: 0,
    } as CSSProperties,

    cardPriceRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    } as CSSProperties,

    cardPrice: (canAfford: boolean) => ({
      fontSize: 13,
      fontWeight: 600,
      color: canAfford ? 'var(--accent)' : 'var(--text-faint)',
    }) as CSSProperties,

    cardBuyBtn: (canAfford: boolean) => ({
      padding: '5px 12px',
      borderRadius: 'var(--radius-sm)',
      border: canAfford ? 'none' : '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
      background: canAfford ? 'var(--accent)' : 'var(--bg-elevated)',
      color: canAfford ? 'var(--bg)' : 'var(--text-muted)',
      fontSize: 12,
      fontWeight: 600,
      cursor: canAfford ? 'pointer' : 'default',
      opacity: canAfford ? 1 : 0.7,
    }) as CSSProperties,

    ownedBadge: {
      padding: '5px 12px',
      borderRadius: 'var(--radius-sm)',
      background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
      color: 'var(--accent)',
      fontSize: 12,
      fontWeight: 600,
      border: 'none',
      cursor: 'default',
    } as CSSProperties,

    /* Equip-style cosmetic cards (decorations/effects/nameplates tabs) */
    equipCard: {
      borderRadius: 10,
      overflow: 'hidden',
      background: 'var(--bg-elevated)',
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: 'var(--stroke)',
      display: 'flex',
      flexDirection: 'column',
    } as CSSProperties,

    equipCardPreview: (hue: number) => ({
      height: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(180deg, hsl(${hue} 30% 35%) 0%, hsl(${hue} 20% 22%) 100%)`,
    }) as CSSProperties,

    equipCardBody: {
      padding: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    } as CSSProperties,

    equipCardName: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--text)',
      margin: 0,
    } as CSSProperties,

    equipCardDesc: {
      fontSize: 12,
      color: 'var(--text-muted)',
      margin: 0,
    } as CSSProperties,

    /* Creator section */
    creatorSection: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    } as CSSProperties,

    creatorTitle: {
      fontSize: 18,
      fontWeight: 600,
      color: 'var(--text)',
      margin: 0,
    } as CSSProperties,

    creatorDesc: {
      fontSize: 14,
      color: 'var(--text-muted)',
      lineHeight: 1.5,
      margin: 0,
    } as CSSProperties,

    creatorForm: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    } as CSSProperties,

    fieldLabel: {
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--text-muted)',
      margin: 0,
    } as CSSProperties,

    fieldSelect: {
      padding: '10px 14px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--stroke)',
      color: 'var(--text)',
      fontSize: 14,
      width: '100%',
      outline: 'none',
    } as CSSProperties,

    fieldInput: {
      padding: '10px 14px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--stroke)',
      color: 'var(--text)',
      fontSize: 14,
      width: '100%',
      outline: 'none',
    } as CSSProperties,

    createDraftBtn: {
      padding: '10px 0',
      borderRadius: 'var(--radius-md)',
      background: 'var(--accent)',
      color: 'var(--bg)',
      border: 'none',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      width: 160,
    } as CSSProperties,

    draftsTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: 'var(--text)',
      margin: 0,
    } as CSSProperties,

    /* Soundboard */
    soundPlayBtn: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: 18,
      color: 'var(--accent)',
      padding: 0,
    } as CSSProperties,

    /* Error */
    errorBanner: {
      padding: '10px 16px',
      borderRadius: 'var(--radius-sm)',
      background: 'color-mix(in srgb, var(--danger) 15%, transparent)',
      color: 'var(--danger)',
      fontSize: 13,
    } as CSSProperties,

    loadingText: {
      color: 'var(--text-muted)',
      fontSize: 14,
    } as CSSProperties,
  };

  /* ---- SVG icon helpers ---- */
  const GemIcon = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, ...style }}>
      <path d="M6 3h12l4 6-10 13L2 9Z" /><path d="M11 3 8 9l4 13 4-13-3-6" /><path d="M2 9h20" />
    </svg>
  );

  const SparklesIcon = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, ...style }}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
  );

  const RectIcon = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, ...style }}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
    </svg>
  );

  const VolumeIcon = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, ...style }}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );

  const UserIcon = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, ...style }}>
      <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />
    </svg>
  );

  const BrushIcon = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, ...style }}>
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02Z" />
    </svg>
  );

  /* Map of category icons */
  const CATEGORIES: { value: CosmeticsTab; label: string; Icon: typeof GemIcon }[] = [
    { value: 'decorations', label: 'Avatar Decorations', Icon: UserIcon },
    { value: 'effects', label: 'Profile Effects', Icon: SparklesIcon },
    { value: 'nameplates', label: 'Nameplates', Icon: RectIcon },
    { value: 'soundboard', label: 'Soundboard', Icon: VolumeIcon },
    { value: 'gratonites', label: 'Gratonites Shop', Icon: GemIcon },
    { value: 'creator', label: 'Creator', Icon: BrushIcon },
  ];

  /** Preview icon name heuristic for shop item cards */
  function previewIconForType(type: string): typeof SparklesIcon {
    if (type === 'avatar_decoration') return UserIcon;
    if (type === 'profile_effect') return SparklesIcon;
    if (type === 'nameplate') return RectIcon;
    if (type === 'soundboard_sound') return VolumeIcon;
    return GemIcon;
  }

  /* ---- Render helpers ---- */

  function renderBalanceBanner() {
    return (
      <div style={S.balanceBanner}>
        <div style={S.balanceLeft}>
          <GemIcon style={S.balanceGem} />
          <div>
            <div style={S.balanceLabel}>Your Balance</div>
            <div style={S.balanceValue}>{shopBalance.toLocaleString()} Gratonites</div>
          </div>
        </div>
        <button type="button" style={S.buyMoreBtn} onClick={() => navigate('/gratonite')}>Buy More</button>
      </div>
    );
  }

  function renderSectionHeader(title: string) {
    return (
      <div style={S.sectionHeader}>
        <h2 style={S.sectionTitle}>{title}</h2>
        <div style={S.balancePill}>
          <GemIcon style={S.balancePillIcon} />
          <span style={S.balancePillText}>{shopBalance.toLocaleString()} G</span>
        </div>
      </div>
    );
  }

  /** Render a purchasable shop item card (Gratonites Shop / Soundboard) */
  function renderItemCard(item: ShopItem) {
    const owned = ownedItems.has(item.id);
    const canAfford = shopBalance >= item.price;
    const hue = nameToHue(item.name);
    const PreviewIcon = previewIconForType(item.type);

    return (
      <article key={item.id} style={S.card}>
        <div style={S.cardPreview(hue)}>
          {item.assetHash ? (
            item.type === 'avatar_decoration' ? (
              <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} decorationHash={item.assetHash} userId={user!.id} size={56} />
            ) : item.type === 'profile_effect' ? (
              <img src={`/api/v1/files/${item.assetHash}`} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
            ) : item.type === 'nameplate' ? (
              <span className="display-name-nameplate nameplate-from-asset" style={{ '--nameplate-image': `url(/api/v1/files/${item.assetHash})` } as CSSProperties}>{resolvedDisplayName}</span>
            ) : null
          ) : (
            <PreviewIcon style={S.cardPreviewIcon(hue)} />
          )}
        </div>
        <div style={S.cardBody as CSSProperties}>
          <div style={S.cardName}>{item.name}</div>
          <div style={S.cardPriceRow}>
            <span style={S.cardPrice(canAfford && !owned)}>{item.price.toLocaleString()} G</span>
            {owned ? (
              <span style={S.ownedBadge}>Owned</span>
            ) : (
              <button
                type="button"
                style={S.cardBuyBtn(canAfford)}
                disabled={!canAfford || purchasing === item.id}
                onClick={() => handlePurchaseItem(item.id, item.price)}
              >
                {purchasing === item.id ? '...' : canAfford ? 'Buy' : 'Buy'}
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  /** Render an equip-style cosmetic card (decorations / effects / nameplates tabs) */
  function renderEquipCard(
    id: string,
    name: string,
    description: string | undefined | null,
    hue: number,
    equipped: boolean,
    loading: boolean,
    previewNode: React.ReactNode,
    onToggle: () => void,
  ) {
    return (
      <article key={id} style={{ ...S.equipCard as any, borderColor: equipped ? 'var(--accent)' : undefined } as CSSProperties}>
        <div style={S.equipCardPreview(hue)}>
          {previewNode}
        </div>
        <div style={S.equipCardBody as CSSProperties}>
          <div style={S.equipCardName}>{name}</div>
          {description && <div style={S.equipCardDesc}>{description}</div>}
          <Button
            variant={equipped ? 'ghost' : 'primary'}
            loading={loading}
            onClick={onToggle}
          >
            {equipped ? 'Remove' : 'Equip'}
          </Button>
        </div>
      </article>
    );
  }

  if (!user) return null;

  /* ================================================================== */
  /*  Main render – sidebar + content                                    */
  /* ================================================================== */

  return (
    <div style={S.root}>
      {/* ---- Left sidebar ---- */}
      <nav style={S.sidebar as CSSProperties}>
        <h2 style={S.sidebarTitle}>Shop</h2>
        {CATEGORIES.map(({ value, label, Icon }) => {
          const active = tab === value;
          return (
            <button
              key={value}
              type="button"
              style={S.catItem(active)}
              onClick={() => setTab(value)}
            >
              <Icon style={S.catIcon(active)} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* ---- Main content ---- */}
      <div style={S.main as CSSProperties}>
        {shopError && <div style={S.errorBanner}>{shopError}</div>}

        {/* ---------- Avatar Decorations tab ---------- */}
        {tab === 'decorations' && (
          <>
            {renderBalanceBanner()}
            {renderSectionHeader('Avatar Decorations')}
            {shopLoading ? (
              <div style={S.loadingText}>Loading decorations...</div>
            ) : avatarDecorations.length === 0 ? (
              <div style={S.loadingText}>No decorations available yet.</div>
            ) : (
              <div style={S.itemGrid}>
                {avatarDecorations.map((decoration) => {
                  const equipped = user.avatarDecorationId === decoration.id;
                  const hue = nameToHue(decoration.name);
                  const preview = decoration.assetHash ? (
                    <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} decorationHash={decoration.assetHash} userId={user.id} size={56} />
                  ) : (
                    <div className="shop-preview-ring" style={{ '--ring-hue': hue } as CSSProperties}>
                      <Avatar name={resolvedDisplayName} hash={resolvedAvatarHash} userId={user.id} size={48} />
                    </div>
                  );
                  return renderEquipCard(
                    decoration.id, decoration.name, decoration.description, hue, equipped,
                    equipping === 'avatar', preview,
                    () => handleEquipAvatarDecoration(equipped ? null : decoration.id),
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ---------- Profile Effects tab ---------- */}
        {tab === 'effects' && (
          <>
            {renderBalanceBanner()}
            {renderSectionHeader('Profile Effects')}
            {shopLoading ? (
              <div style={S.loadingText}>Loading effects...</div>
            ) : profileEffects.length === 0 ? (
              <div style={S.loadingText}>No effects available yet.</div>
            ) : (
              <div style={S.itemGrid}>
                {profileEffects.map((effect) => {
                  const equipped = user.profileEffectId === effect.id;
                  const hue = nameToHue(effect.name);
                  const preview = effect.assetHash ? (
                    <img src={`/api/v1/files/${effect.assetHash}`} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                  ) : (
                    <div className="shop-preview-effect" style={{ '--effect-hue': hue, width: 80, height: 60, borderRadius: 'var(--radius-sm)' } as CSSProperties} />
                  );
                  return renderEquipCard(
                    effect.id, effect.name, effect.description, hue, equipped,
                    equipping === 'effect', preview,
                    () => handleEquipProfileEffect(equipped ? null : effect.id),
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ---------- Nameplates tab ---------- */}
        {tab === 'nameplates' && (
          <>
            {renderBalanceBanner()}
            {renderSectionHeader('Nameplates')}
            {shopLoading ? (
              <div style={S.loadingText}>Loading nameplates...</div>
            ) : nameplates.length === 0 ? (
              <div style={S.loadingText}>No nameplates available yet.</div>
            ) : (
              <div style={S.itemGrid}>
                {nameplates.map((np) => {
                  const equipped = user.nameplateId === np.id;
                  const hue = nameToHue(np.name);
                  const preview = np.assetHash ? (
                    <span className="display-name-nameplate nameplate-from-asset" style={{ '--nameplate-image': `url(/api/v1/files/${np.assetHash})` } as CSSProperties}>{resolvedDisplayName}</span>
                  ) : (
                    <span className="shop-preview-nameplate" style={{ '--np-hue': hue } as CSSProperties}>{resolvedDisplayName}</span>
                  );
                  return renderEquipCard(
                    np.id, np.name, np.description, hue, equipped,
                    equipping === 'nameplate', preview,
                    () => handleEquipNameplate(equipped ? null : np.id),
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ---------- Soundboard tab ---------- */}
        {tab === 'soundboard' && (
          <>
            {renderBalanceBanner()}
            {renderSectionHeader('Soundboard')}
            {shopItemsLoading ? (
              <div style={S.loadingText}>Loading soundboard items...</div>
            ) : (
              <div style={S.itemGrid}>
                {shopItems
                  .filter((item) => item.type === 'soundboard_sound')
                  .map((item) => {
                    const owned = ownedItems.has(item.id);
                    const canAfford = shopBalance >= item.price;
                    const hue = nameToHue(item.name);
                    return (
                      <article key={item.id} style={S.card}>
                        <div style={S.cardPreview(hue)}>
                          <button
                            type="button"
                            style={S.soundPlayBtn}
                            onClick={() => {
                              if (item.assetHash) {
                                const audio = new Audio(`/api/v1/files/${item.assetHash}`);
                                audio.play().catch(() => {});
                              }
                            }}
                            disabled={!item.assetHash}
                            title="Preview sound"
                          >
                            &#9654;
                          </button>
                        </div>
                        <div style={S.cardBody as CSSProperties}>
                          <div style={S.cardName}>{item.name}</div>
                          {item.description && <div style={S.equipCardDesc}>{item.description}</div>}
                          <div style={S.cardPriceRow}>
                            <span style={S.cardPrice(canAfford && !owned)}>{item.price.toLocaleString()} G</span>
                            {owned ? (
                              <span style={S.ownedBadge}>Owned</span>
                            ) : (
                              <button
                                type="button"
                                style={S.cardBuyBtn(canAfford)}
                                disabled={!canAfford || purchasing === item.id}
                                onClick={() => handlePurchaseItem(item.id, item.price)}
                              >
                                {purchasing === item.id ? '...' : 'Buy'}
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                {shopItems.filter((item) => item.type === 'soundboard_sound').length === 0 && (
                  <div style={S.loadingText}>No soundboard items available yet.</div>
                )}
              </div>
            )}
          </>
        )}

        {/* ---------- Gratonites Shop tab ---------- */}
        {tab === 'gratonites' && (
          <>
            {renderBalanceBanner()}
            {renderSectionHeader('Cosmetics')}
            {shopItemsLoading ? (
              <div style={S.loadingText}>Loading shop items...</div>
            ) : shopItems.length === 0 ? (
              <div style={S.loadingText}>No items available yet. Check back soon!</div>
            ) : (
              <div style={S.itemGrid}>
                {shopItems.map((item) => renderItemCard(item))}
              </div>
            )}
          </>
        )}

        {/* ---------- Creator tab ---------- */}
        {tab === 'creator' && (
          <>
            {renderBalanceBanner()}
            {renderSectionHeader('Creator')}

            <div style={S.creatorSection as CSSProperties}>
              <div style={S.creatorTitle}>Creator Studio</div>
              <div style={S.creatorDesc}>Design and sell your own cosmetics on the Gratonite marketplace.</div>

              <div style={S.creatorForm as CSSProperties}>
                <div style={S.fieldLabel}>Type</div>
                <select
                  style={S.fieldSelect}
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

                <div style={S.fieldLabel}>Name</div>
                <input
                  type="text"
                  style={S.fieldInput}
                  value={communityDraftName}
                  onChange={(e) => setCommunityDraftName(e.target.value)}
                  placeholder="e.g. galactic swirl"
                />

                <button
                  type="button"
                  style={{ ...S.createDraftBtn, opacity: communityDraftName.trim() ? 1 : 0.5 } as CSSProperties}
                  disabled={!communityDraftName.trim() || communityCreateLoading}
                  onClick={handleCreateCommunityDraft}
                >
                  {communityCreateLoading ? 'Creating...' : 'Create Draft'}
                </button>
              </div>

              {communityError && <div style={S.errorBanner}>{communityError}</div>}

              <div style={S.draftsTitle}>Your Drafts</div>

              {communityLoading ? (
                <div style={S.loadingText}>Loading creator drafts...</div>
              ) : communityItems.length === 0 ? (
                <div style={S.loadingText}>No creator drafts yet.</div>
              ) : (
                <div style={S.itemGrid}>
                  {communityItems.slice(0, 8).map((item) => {
                    const hue = nameToHue(item.name);
                    return (
                      <article key={item.id} style={S.card}>
                        <div style={S.cardPreview(hue)}>
                          <GemIcon style={S.cardPreviewIcon(hue)} />
                        </div>
                        <div style={S.cardBody as CSSProperties}>
                          <div style={S.cardName}>{item.name}</div>
                          <div style={S.equipCardDesc}>
                            {item.itemType.replaceAll('_', ' ')} &middot; {item.status.replaceAll('_', ' ')}
                          </div>
                          <Button
                            variant="ghost"
                            disabled={item.status === 'pending_review' || item.status === 'published'}
                            onClick={() => handleSubmitCommunityItem(item.id)}
                          >
                            {item.status === 'pending_review' ? 'In Review' : item.status === 'published' ? 'Published' : 'Submit Review'}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
