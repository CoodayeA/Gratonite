import { useState, useRef, useEffect } from 'react';
import { ShoppingBag, Search, Filter, Gavel, ArrowUpRight, Clock, Star, Users, X, Gem, Check, Package, Plus, ChevronRight, TrendingUp, Minus, Upload, ChevronDown, Sparkles, Frame, Type, Volume2 } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';
import Skeleton from '../../components/ui/Skeleton';

type CreatorItem = {
    id: string;
    type: 'frame' | 'effect' | 'nameplate' | 'decoration' | 'soundboard';
    name: string;
    creator: string;
    creatorBio: string;
    creatorBanner: string;
    creatorAvatar: string;
    creatorSales: number;
    price: number;
    image: string;
    sales: number;
    createdAtTs: number;
    isBundle?: boolean;
    bundleItems?: string[];
    description: string;
};

type ApiAuction = {
    id: string;
    cosmeticId: string;
    cosmeticName: string;
    cosmeticType: string;
    sellerName: string;
    currentBid: number;
    startingPrice: number;
    endsAt: string;
    bidCount: number;
    imageUrl: string | null;
    status: string;
};

type CategoryFilter = 'all' | 'frame' | 'effect' | 'nameplate' | 'decoration' | 'soundboard' | 'bundle';
type SortOption = 'popular' | 'price-low' | 'price-high' | 'newest';
type AuctionSortOption = 'popular' | 'price-low' | 'price-high' | 'newest';
type AuctionTypeFilter = 'all' | 'avatar_frame' | 'profile_effect' | 'nameplate' | 'decoration' | 'soundboard';

const initialCreatorItems: CreatorItem[] = [];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getTimeRemaining(endsAt: string): string {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function mapApiAuction(a: any): ApiAuction {
    return {
        id: a.id ?? `${a.cosmeticId ?? 'cosmetic'}:${a.endsAt ?? 'unknown'}`,
        cosmeticId: a.cosmeticId ?? '',
        cosmeticName: a.cosmeticName ?? a.name ?? 'Unknown Item',
        cosmeticType: a.cosmeticType ?? a.type ?? '',
        sellerName: a.sellerName ?? a.seller ?? 'Unknown',
        currentBid: a.currentBid ?? a.currentPrice ?? a.startingPrice ?? 0,
        startingPrice: a.startingPrice ?? 0,
        endsAt: a.endsAt ?? new Date(Date.now() + 3600000).toISOString(),
        bidCount: a.bidCount ?? a.bids ?? 0,
        imageUrl: a.imageUrl ?? a.previewImageUrl ?? null,
        status: a.status ?? 'active',
    };
}

// Purchase Confirmation Modal
const PurchaseModal = ({ item, onClose, onConfirm }: { item: CreatorItem; onClose: () => void; onConfirm: () => Promise<void> }) => {
    const [step, setStep] = useState<'confirm' | 'success'>('confirm');
    const [processing, setProcessing] = useState(false);

    const handleBuy = async () => {
        setProcessing(true);
        try {
            await onConfirm();
            setStep('success');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ width: '480px', background: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--stroke)', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
                {step === 'success' ? (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Check size={36} color="white" />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Purchase Complete!</h2>
                        <p style={{ color: 'var(--text-secondary)' }}><strong>{item.name}</strong> has been added to your inventory.</p>
                        <button
                            onClick={onClose}
                            style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '10px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Creator Banner */}
                        <div style={{ height: '100px', background: item.creatorBanner, position: 'relative' }}>
                            <div style={{ position: 'absolute', bottom: -24, left: 24, width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))', border: '3px solid var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700 }}>
                                {item.creatorAvatar}
                            </div>
                        </div>

                        <div style={{ padding: '36px 24px 24px' }}>
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '2px' }}>Creator</div>
                                <div style={{ fontWeight: 700, fontSize: '16px' }}>@{item.creator}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{item.creatorBio}</div>
                                <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 600, marginTop: '6px' }}>
                                    <Star size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{item.creatorSales.toLocaleString()} total sales
                                </div>
                            </div>

                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '16px 0' }} />

                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'flex-start' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '12px', background: item.image, flexShrink: 0, border: '1px solid var(--stroke)' }} />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{item.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize', marginBottom: '6px' }}>{item.type}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{item.description}</div>
                                </div>
                            </div>

                            {item.isBundle && item.bundleItems && (
                                <div style={{ background: 'var(--bg-elevated)', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', border: '1px solid var(--stroke)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Bundle includes:</div>
                                    {item.bundleItems.map(bi => (
                                        <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px' }}>
                                            <Check size={12} color="#10b981" /> {bi}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>You'll spend</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Gem size={18} color="#10b981" />
                                    <span style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10b981' }}>{item.price.toLocaleString()}</span>
                                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gratonite</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                                <button
                                    onClick={handleBuy}
                                    disabled={processing}
                                    style={{ flex: 2, padding: '12px', borderRadius: '10px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, cursor: processing ? 'not-allowed' : 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: processing ? 0.7 : 1 }}
                                >
                                    <Gem size={16} /> {processing ? 'Processing…' : 'Confirm Purchase'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Create Item Modal (for creators to upload/sell items)
const CreateItemModal = ({ onClose }: { onClose: () => void }) => {
    const [step, setStep] = useState<'form' | 'success'>('form');
    const [itemType, setItemType] = useState<'frame' | 'effect' | 'nameplate' | 'decoration' | 'soundboard'>('frame');
    const [itemName, setItemName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [gradientColor1, setGradientColor1] = useState('#FF0055');
    const [gradientColor2, setGradientColor2] = useState('#00FFCC');
    const [creating, setCreating] = useState(false);
    const { addToast } = useToast();

    const canSubmit = itemName.trim() && description.trim() && price && Number(price) >= 10;

    const handleSubmit = async () => {
        if (!canSubmit) return;
        const typeMap: Record<'frame' | 'effect' | 'nameplate' | 'decoration' | 'soundboard', 'avatar_frame' | 'profile_effect' | 'nameplate' | 'decoration' | 'soundboard'> = {
            frame: 'avatar_frame',
            effect: 'profile_effect',
            nameplate: 'nameplate',
            decoration: 'decoration',
            soundboard: 'soundboard',
        };
        const categoryMap: Record<'frame' | 'effect' | 'nameplate' | 'decoration' | 'soundboard', string> = {
            frame: 'Avatar Frames',
            effect: 'Profile Effects',
            nameplate: 'Name Plates',
            decoration: 'Decorations',
            soundboard: 'Soundboard',
        };

        if (itemType === 'soundboard' && Number(price) < 100) {
            addToast({ title: 'Soundboard pricing too low', description: 'Soundboard listings must be at least 100 Gratonite.', variant: 'error' });
            return;
        }

        setCreating(true);
        try {
            await api.marketplace.listItem({
                name: itemName.trim(),
                description: description.trim(),
                type: typeMap[itemType],
                price: Number(price),
                previewImageUrl: `linear-gradient(135deg, ${gradientColor1}, ${gradientColor2})`,
                category: categoryMap[itemType],
            });
            setStep('success');
            addToast({ title: 'Item Submitted!', description: `${itemName} has been submitted for review.`, variant: 'achievement' });
        } catch (err: any) {
            addToast({ title: 'Submission failed', description: err?.message ?? 'Could not submit this item.', variant: 'error' });
        } finally {
            setCreating(false);
        }
    };

    const typeOptions: { value: 'frame' | 'effect' | 'nameplate' | 'decoration' | 'soundboard'; label: string; icon: React.ReactNode }[] = [
        { value: 'frame', label: 'Frame', icon: <Frame size={14} /> },
        { value: 'effect', label: 'Effect', icon: <Sparkles size={14} /> },
        { value: 'nameplate', label: 'Nameplate', icon: <Type size={14} /> },
        { value: 'decoration', label: 'Decoration', icon: <Star size={14} /> },
        { value: 'soundboard', label: 'Soundboard', icon: <Volume2 size={14} /> },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ width: '520px', maxHeight: '90vh', background: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--stroke)', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column' }}>
                {step === 'success' ? (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Check size={36} color="white" />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Item Submitted!</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Your creation is pending review and will go live shortly.</p>
                        <button
                            onClick={onClose}
                            style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '10px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Upload size={20} /> Upload Your Creation
                            </h2>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={22} /></button>
                        </div>
                        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                            {/* Type Selector */}
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Item Type</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {typeOptions.map(opt => (
                                        <button key={opt.value} onClick={() => setItemType(opt.value)}
                                            style={{ flex: 1, padding: '10px 8px', borderRadius: '8px', border: `1px solid ${itemType === opt.value ? 'var(--accent-primary)' : 'var(--stroke)'}`, background: itemType === opt.value ? 'rgba(var(--accent-primary-rgb, 212, 175, 55), 0.15)' : 'var(--bg-tertiary)', color: itemType === opt.value ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                        >{opt.icon} {opt.label}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Item Name */}
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Item Name</label>
                                <input type="text" placeholder="e.g. Neon Vortex Frame" value={itemName} onChange={e => setItemName(e.target.value)}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                            </div>

                            {/* Description */}
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Description</label>
                                <textarea placeholder="Describe your creation..." value={description} onChange={e => setDescription(e.target.value)} rows={3}
                                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                            </div>

                            {/* Price */}
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Price (Gratonite)</label>
                                <div style={{ position: 'relative' }}>
                                    <Gem size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#10b981' }} />
                                    <input type="number" min="10" placeholder="Min. 10" value={price} onChange={e => setPrice(e.target.value)}
                                        style={{ width: '100%', padding: '10px 14px 10px 36px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                            </div>

                            {/* Gradient Preview Picker */}
                            <div>
                                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Preview Gradient</label>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Color 1</label>
                                        <input type="color" value={gradientColor1} onChange={e => setGradientColor1(e.target.value)}
                                            style={{ width: '48px', height: '36px', border: '1px solid var(--stroke)', borderRadius: '6px', cursor: 'pointer', background: 'none', padding: 0 }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Color 2</label>
                                        <input type="color" value={gradientColor2} onChange={e => setGradientColor2(e.target.value)}
                                            style={{ width: '48px', height: '36px', border: '1px solid var(--stroke)', borderRadius: '6px', cursor: 'pointer', background: 'none', padding: 0 }} />
                                    </div>
                                    <div style={{ flex: 1, height: '64px', borderRadius: '10px', background: `linear-gradient(135deg, ${gradientColor1}, ${gradientColor2})`, border: '1px solid var(--stroke)' }} />
                                </div>
                            </div>

                            {/* Info note */}
                            <div style={{ background: 'var(--bg-elevated)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', border: '1px solid var(--stroke)' }}>
                                Creators keep 85% of each sale. Items are reviewed before going live (usually within 24 hours).
                            </div>

                            <button onClick={handleSubmit} disabled={!canSubmit || creating}
                                style={{ padding: '14px', borderRadius: '10px', background: canSubmit ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: 'none', color: canSubmit ? '#000' : 'var(--text-muted)', fontWeight: 700, cursor: canSubmit && !creating ? 'pointer' : 'default', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: creating ? 0.75 : 1 }}
                            ><Upload size={18} /> Submit for Review</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Real Auction Bid Modal
const BidModal = ({ auction, balance, onClose, onBidSuccess }: {
    auction: ApiAuction;
    balance: number;
    onClose: () => void;
    onBidSuccess: (auctionId: string, amount: number) => void;
}) => {
    const { addToast } = useToast();
    const [bidAmount, setBidAmount] = useState('');
    const [bidPlaced, setBidPlaced] = useState(false);
    const [placing, setPlacing] = useState(false);
    const minBid = auction.currentBid + 1;
    const timeLeft = getTimeRemaining(auction.endsAt);
    const isUrgent = timeLeft.endsWith('m') && !timeLeft.includes('h');

    const handleBid = async () => {
        const amount = Number(bidAmount);
        if (amount < minBid) return;
        if (amount > balance) {
            addToast({ title: 'Insufficient balance', description: 'You do not have enough Gratonite to place this bid.', variant: 'error' });
            return;
        }
        setPlacing(true);
        try {
            await api.auctions.bid(auction.id, amount);
            onBidSuccess(auction.id, amount);
            setBidPlaced(true);
            addToast({ title: 'Bid Placed!', description: `You placed a bid of ${amount.toLocaleString()} Gratonite.`, variant: 'achievement' });
            setTimeout(onClose, 2000);
        } catch (err: any) {
            addToast({ title: 'Bid failed', description: err?.message ?? 'Could not place bid.', variant: 'error' });
        } finally {
            setPlacing(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div style={{ width: '520px', background: 'var(--bg-primary)', borderRadius: '20px', border: '1px solid var(--stroke)', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}>
                {bidPlaced ? (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                            <Check size={36} color="white" />
                        </div>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Bid Placed!</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>You're now the highest bidder on <strong>{auction.cosmeticName}</strong>.</p>
                    </div>
                ) : (
                    <>
                        <div style={{ padding: '24px', borderBottom: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Place a Bid</h2>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={22} /></button>
                        </div>
                        <div style={{ padding: '24px', display: 'flex', gap: '20px' }}>
                            {/* Left: Item info */}
                            <div style={{ flex: 1 }}>
                                <div style={{ width: '100%', height: '100px', background: auction.imageUrl ?? 'linear-gradient(135deg, #8b5cf6, #ec4899)', borderRadius: '12px', marginBottom: '16px' }} />
                                <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{auction.cosmeticName}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{auction.cosmeticType.replace(/_/g, ' ')}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>by <span style={{ color: 'var(--accent-primary)' }}>@{auction.sellerName}</span></div>

                                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '10px', border: `1px solid ${isUrgent ? 'var(--error)' : 'var(--stroke)'}` }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Time Remaining</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '18px', color: isUrgent ? 'var(--error)' : 'var(--text-primary)' }}>
                                        <Clock size={18} /> {timeLeft}
                                    </div>
                                </div>

                                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                    Your balance: <span style={{ color: '#10b981', fontWeight: 700 }}>{balance.toLocaleString()} G</span>
                                </div>
                            </div>

                            {/* Right: Bidding */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Current Highest Bid</div>
                                    <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Gem size={20} color="#f59e0b" /> {auction.currentBid.toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{auction.bidCount} bids so far</div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Your Bid (min. {minBid.toLocaleString()})</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <button onClick={() => setBidAmount(String(Math.max(minBid, Number(bidAmount || minBid) - 100)))} style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Minus size={14} /></button>
                                        <div style={{ position: 'relative', flex: 1 }}>
                                            <Gem size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#10b981' }} />
                                            <input type="number" min={minBid} placeholder={`${minBid}`} value={bidAmount} onChange={e => setBidAmount(e.target.value)} style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: `1px solid ${Number(bidAmount) >= minBid && bidAmount ? 'var(--success)' : 'var(--stroke)'}`, color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                        </div>
                                        <button onClick={() => setBidAmount(String(Number(bidAmount || minBid) + 100))} style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={14} /></button>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        {[minBid, minBid + 500, minBid + 2000].map(q => (
                                            <button key={q} onClick={() => setBidAmount(String(q))} style={{ flex: 1, padding: '6px', borderRadius: '6px', background: bidAmount === String(q) ? 'var(--accent-purple)' : 'var(--bg-elevated)', border: '1px solid var(--stroke)', color: bidAmount === String(q) ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                                                {q.toLocaleString()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleBid}
                                    disabled={!bidAmount || Number(bidAmount) < minBid || placing}
                                    style={{ padding: '12px', borderRadius: '10px', background: bidAmount && Number(bidAmount) >= minBid && !placing ? 'var(--accent-purple)' : 'var(--bg-tertiary)', border: 'none', color: bidAmount && Number(bidAmount) >= minBid && !placing ? 'white' : 'var(--text-muted)', fontWeight: 700, cursor: bidAmount && Number(bidAmount) >= minBid && !placing ? 'pointer' : 'default', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                    {placing
                                        ? <span style={{ animation: 'spin 0.6s linear infinite', display: 'inline-block' }}>✦</span>
                                        : <ArrowUpRight size={18} />
                                    }
                                    {placing ? 'Placing...' : 'Place Bid'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// Filter Dropdown component
const FilterDropdown = ({ isOpen, onClose, typeFilter, setTypeFilter, sortOption, setSortOption }: {
    isOpen: boolean;
    onClose: () => void;
    typeFilter: CategoryFilter;
    setTypeFilter: (f: CategoryFilter) => void;
    sortOption: SortOption;
    setSortOption: (s: SortOption) => void;
}) => {
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const typeOptions: { value: CategoryFilter; label: string }[] = [
        { value: 'all', label: 'All Types' },
        { value: 'frame', label: 'Frames' },
        { value: 'effect', label: 'Effects' },
        { value: 'nameplate', label: 'Nameplates' },
        { value: 'bundle', label: 'Bundles' },
    ];

    const sortOptions: { value: SortOption; label: string }[] = [
        { value: 'popular', label: 'Most Popular' },
        { value: 'price-low', label: 'Price: Low to High' },
        { value: 'price-high', label: 'Price: High to Low' },
        { value: 'newest', label: 'Newest First' },
    ];

    return (
        <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', width: '280px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', zIndex: 100, boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
            <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Filter by Type</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {typeOptions.map(opt => (
                        <button key={opt.value} onClick={() => setTypeFilter(opt.value)}
                            style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: typeFilter === opt.value ? 'rgba(var(--accent-primary-rgb, 212, 175, 55), 0.15)' : 'transparent', color: typeFilter === opt.value ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: typeFilter === opt.value ? 700 : 400, cursor: 'pointer', fontSize: '13px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                            {opt.label}
                            {typeFilter === opt.value && <Check size={14} />}
                        </button>
                    ))}
                </div>
            </div>
            <div style={{ height: '1px', background: 'var(--stroke)', margin: '12px 0' }} />
            <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Sort by</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {sortOptions.map(opt => (
                        <button key={opt.value} onClick={() => setSortOption(opt.value)}
                            style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: sortOption === opt.value ? 'rgba(var(--accent-primary-rgb, 212, 175, 55), 0.15)' : 'transparent', color: sortOption === opt.value ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: sortOption === opt.value ? 700 : 400, cursor: 'pointer', fontSize: '13px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        >
                            {opt.label}
                            {sortOption === opt.value && <Check size={14} />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const Marketplace = () => {
    const { gratoniteBalance, setGratoniteBalance } = useOutletContext<any>();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'creators' | 'auctions'>('creators');
    const [purchaseItem, setPurchaseItem] = useState<CreatorItem | null>(null);
    const [biddingOn, setBiddingOn] = useState<ApiAuction | null>(null);
    const [showCreateItem, setShowCreateItem] = useState(false);
    const [auctions, setAuctions] = useState<ApiAuction[]>([]);
    const [auctionsLoading, setAuctionsLoading] = useState(false);
    const [auctionSort, setAuctionSort] = useState<AuctionSortOption>('popular');
    const [auctionTypeFilter, setAuctionTypeFilter] = useState<AuctionTypeFilter>('all');
    const [auctionSearch, setAuctionSearch] = useState('');
    const [creatorItems, setCreatorItems] = useState<CreatorItem[]>(initialCreatorItems);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const [sortOption, setSortOption] = useState<SortOption>('popular');
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Load creator items on mount
    useEffect(() => {
        api.cosmetics.browse({ limit: 50 }).then((items: any[]) => {
            const typeMap: Record<string, CreatorItem['type']> = {
                avatar_frame: 'frame', frame: 'frame',
                profile_effect: 'effect', effect: 'effect',
                nameplate: 'nameplate',
                name_plate: 'nameplate',
                decoration: 'decoration',
                soundboard: 'soundboard',
            };
            const mapped: CreatorItem[] = items.flatMap((item: any) => {
                const id = typeof item.id === 'string' && item.id.trim().length > 0 ? item.id : null;
                if (!id) return [];
                return [{
                id,
                type: typeMap[item.type] ?? 'frame',
                name: item.name ?? 'Unknown',
                creator: item.creatorName ?? 'Creator',
                creatorBio: item.creatorBio ?? '',
                creatorBanner: item.creatorBanner ?? 'linear-gradient(135deg, #6366f1, #d946ef)',
                creatorAvatar: item.creatorAvatar ?? (item.name ?? 'U').charAt(0),
                creatorSales: item.creatorSales ?? 0,
                price: item.price ?? 0,
                image: item.previewImageUrl ?? item.image ?? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                sales: item.totalSales ?? 0,
                description: item.description ?? '',
                createdAtTs: item.createdAt ? new Date(item.createdAt).getTime() : 0,
            }];
        });
            if (mapped.length > 0) setCreatorItems(mapped);
        }).catch(() => {
            addToast({ title: 'Failed to load marketplace items', description: 'Could not fetch creator listings.', variant: 'error' });
        }).finally(() => setIsLoading(false));
    }, []);

    // Load auctions when tab switches to auctions
    const loadAuctions = () => {
        setAuctionsLoading(true);
        const sortApiMap: Record<AuctionSortOption, string> = {
            popular: 'bids',
            'price-low': 'price_asc',
            'price-high': 'price_desc',
            newest: 'newest',
        };
        api.auctions.list({
            sort: sortApiMap[auctionSort],
            type: auctionTypeFilter !== 'all' ? auctionTypeFilter : undefined,
            search: auctionSearch || undefined,
        }).then((data: any[]) => {
            setAuctions((Array.isArray(data) ? data : []).map(mapApiAuction));
        }).catch(() => {
            addToast({ title: 'Failed to load auctions', description: 'Could not fetch active auctions.', variant: 'error' });
        }).finally(() => setAuctionsLoading(false));
    };

    useEffect(() => {
        if (activeTab === 'auctions') {
            loadAuctions();
        }
    }, [activeTab, auctionSort, auctionTypeFilter]);

    const filteredItems = creatorItems
        .filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.creator.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'all'
                || (categoryFilter === 'bundle' && item.isBundle)
                || (categoryFilter !== 'bundle' && !item.isBundle && item.type === categoryFilter);
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            switch (sortOption) {
                case 'popular': return b.sales - a.sales;
                case 'price-low': return a.price - b.price;
                case 'price-high': return b.price - a.price;
                case 'newest': return b.createdAtTs - a.createdAtTs;
                default: return 0;
            }
        });

    const filteredAuctions = auctionSearch
        ? auctions.filter(a =>
            a.cosmeticName.toLowerCase().includes(auctionSearch.toLowerCase()) ||
            a.sellerName.toLowerCase().includes(auctionSearch.toLowerCase())
          )
        : auctions;

    const handleConfirmPurchase = async () => {
        if (!purchaseItem) return;
        const result = await api.cosmetics.purchase(purchaseItem.id);
        if (result?.wallet?.balance !== undefined) {
            setGratoniteBalance(result.wallet.balance);
        } else {
            setGratoniteBalance((b: number) => b - purchaseItem.price);
        }
        window.dispatchEvent(new Event('gratonite:inventory-updated'));
        addToast({ title: 'Purchase Successful!', description: `${purchaseItem.name} has been added to your inventory.`, variant: 'achievement' });
    };

    const handleBidSuccess = (auctionId: string, amount: number) => {
        setAuctions(prev => prev.map(a => a.id === auctionId
            ? { ...a, currentBid: amount, bidCount: a.bidCount + 1 }
            : a
        ));
        setGratoniteBalance((b: number) => b - amount);
    };

    const categoryChips: { value: CategoryFilter; label: string; icon: React.ReactNode }[] = [
        { value: 'all', label: 'All', icon: <ShoppingBag size={14} /> },
        { value: 'frame', label: 'Frames', icon: <Frame size={14} /> },
        { value: 'effect', label: 'Effects', icon: <Sparkles size={14} /> },
        { value: 'nameplate', label: 'Nameplates', icon: <Type size={14} /> },
        { value: 'decoration', label: 'Decorations', icon: <Star size={14} /> },
        { value: 'soundboard', label: 'Soundboard', icon: <Volume2 size={14} /> },
        { value: 'bundle', label: 'Bundles', icon: <Package size={14} /> },
    ];

    const auctionTypeChips: { value: AuctionTypeFilter; label: string }[] = [
        { value: 'all', label: 'All Types' },
        { value: 'avatar_frame', label: 'Frames' },
        { value: 'profile_effect', label: 'Effects' },
        { value: 'nameplate', label: 'Nameplates' },
        { value: 'decoration', label: 'Decorations' },
        { value: 'soundboard', label: 'Soundboard' },
    ];

    const auctionSortChips: { value: AuctionSortOption; label: string }[] = [
        { value: 'popular', label: 'Popular' },
        { value: 'price-low', label: 'Price Low' },
        { value: 'price-high', label: 'Price High' },
        { value: 'newest', label: 'Newest' },
    ];

    return (
        <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--accent-primary)', marginBottom: '8px' }}>
                            <Users size={28} />
                            <h1 style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>Community Marketplace</h1>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Support creators or bid on rare peer-to-peer items in the Auction House.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setActiveTab('auctions')}
                            style={{ background: 'var(--accent-purple)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 700, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        >
                            <Gavel size={16} /> Live Auction
                        </button>
                        <button
                            onClick={() => { setActiveTab('creators'); setShowCreateItem(true); }}
                            style={{ background: 'var(--accent-primary)', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 700, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                        >
                            <Upload size={16} /> List Item
                        </button>
                        <div style={{ background: 'var(--bg-tertiary)', padding: '10px 20px', borderRadius: '10px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Gem size={18} color="#10b981" />
                            <span style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{(gratoniteBalance ?? 0).toLocaleString()}</span>
                        </div>
                    </div>
                </header>

                <div style={{ display: 'flex', borderBottom: '1px solid var(--stroke)', marginBottom: '32px', gap: '32px' }}>
                    {[
                        { id: 'creators', icon: <ShoppingBag size={18} />, label: 'Creator Items', color: 'var(--accent-primary)' },
                        { id: 'auctions', icon: <Gavel size={18} />, label: 'Live Auctions', color: 'var(--accent-purple)' },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                            style={{ background: 'none', border: 'none', borderBottom: activeTab === tab.id ? `3px solid ${tab.color}` : '3px solid transparent', padding: '0 0 12px 0', color: activeTab === tab.id ? 'white' : 'var(--text-muted)', fontWeight: 600, fontSize: '16px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >{tab.icon} {tab.label}</button>
                    ))}
                </div>

                {/* ── Creator Items tab ── */}
                {activeTab === 'creators' && (
                    isLoading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={`mp-skel-${i}`} variant="card" height="260px" />
                            ))}
                        </div>
                    ) : (
                        <div>
                            {/* Search bar + Filter button + Upload button */}
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                                    <input type="text" placeholder="Search for cosmetics, creators, or tags..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <button onClick={() => setShowFilterDropdown(prev => !prev)}
                                        style={{ background: showFilterDropdown ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '0 16px', borderRadius: '8px', color: showFilterDropdown ? '#000' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', height: '100%' }}>
                                        <Filter size={16} /> Filters <ChevronDown size={14} />
                                    </button>
                                    <FilterDropdown
                                        isOpen={showFilterDropdown}
                                        onClose={() => setShowFilterDropdown(false)}
                                        typeFilter={categoryFilter}
                                        setTypeFilter={(f) => { setCategoryFilter(f); }}
                                        sortOption={sortOption}
                                        setSortOption={(s) => { setSortOption(s); }}
                                    />
                                </div>
                                <button onClick={() => setShowCreateItem(true)}
                                    style={{ background: 'var(--accent-primary)', border: 'none', padding: '0 20px', borderRadius: '8px', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', fontSize: '14px' }}>
                                    <Upload size={16} /> List Item
                                </button>
                            </div>

                            {/* Category filter chips */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                                {categoryChips.map(chip => (
                                    <button key={chip.value} onClick={() => setCategoryFilter(chip.value)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '20px',
                                            border: `1px solid ${categoryFilter === chip.value ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                            background: categoryFilter === chip.value ? 'rgba(var(--accent-primary-rgb, 212, 175, 55), 0.15)' : 'var(--bg-tertiary)',
                                            color: categoryFilter === chip.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontWeight: categoryFilter === chip.value ? 700 : 500,
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s',
                                        }}
                                    >{chip.icon} {chip.label}</button>
                                ))}
                            </div>

                            {/* Items grid */}
                            {filteredItems.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
                                    <ShoppingBag size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>No items found</h3>
                                    <p style={{ fontSize: '14px' }}>Try adjusting your search or filters.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                                    {filteredItems.map(item => (
                                        <div key={item.id}
                                            onMouseEnter={() => setHoveredCard(String(item.id))} onMouseLeave={() => setHoveredCard(null)}
                                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', transform: hoveredCard === String(item.id) ? 'translateY(-4px)' : 'translateY(0)', boxShadow: hoveredCard === String(item.id) ? '0 12px 32px rgba(0,0,0,0.3)' : 'none' }}>
                                            {/* Creator banner preview */}
                                            <div style={{ height: '80px', background: item.creatorBanner, position: 'relative' }}>
                                                <div style={{ position: 'absolute', bottom: -20, left: 16, width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))', border: '2px solid var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700 }}>
                                                    {item.creatorAvatar}
                                                </div>
                                                <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', backdropFilter: 'blur(4px)' }}>
                                                    <Star size={11} color="#f59e0b" /> {item.sales.toLocaleString()} sold
                                                </div>
                                                {item.isBundle && (
                                                    <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'var(--accent-purple)', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                                                        <Package size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />BUNDLE
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ padding: '28px 16px 16px' }}>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>by <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>@{item.creator}</span></div>
                                                <h3 style={{ fontWeight: 700, fontSize: '17px', marginBottom: '6px' }}>{item.name}</h3>
                                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>{item.description}</p>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Gem size={16} color="#10b981" />
                                                        <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#10b981' }}>{item.price.toLocaleString()}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {item.isBundle && (
                                                            <button onClick={() => setPurchaseItem(item)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '6px 12px', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <ChevronRight size={12} /> Details
                                                            </button>
                                                        )}
                                                        <button onClick={() => setPurchaseItem(item)} style={{ background: 'var(--accent-primary)', border: 'none', padding: '6px 18px', borderRadius: '6px', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                                                            {item.isBundle ? 'View Bundle' : 'Buy'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                )}

                {/* ── Auctions tab ── */}
                {activeTab === 'auctions' && (
                    <div>
                        {/* Search + sort/filter row */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    placeholder="Search auctions..."
                                    value={auctionSearch}
                                    onChange={e => setAuctionSearch(e.target.value)}
                                    style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                        </div>

                        {/* Type filter chips */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            {auctionTypeChips.map(chip => (
                                <button key={chip.value} onClick={() => setAuctionTypeFilter(chip.value)}
                                    style={{ padding: '6px 14px', borderRadius: '16px', border: `1px solid ${auctionTypeFilter === chip.value ? 'var(--accent-purple)' : 'var(--stroke)'}`, background: auctionTypeFilter === chip.value ? 'rgba(139,92,246,0.15)' : 'var(--bg-tertiary)', color: auctionTypeFilter === chip.value ? '#a855f7' : 'var(--text-secondary)', fontWeight: auctionTypeFilter === chip.value ? 700 : 500, cursor: 'pointer', fontSize: '12px', transition: 'all 0.2s' }}
                                >{chip.label}</button>
                            ))}
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                {auctionSortChips.map(chip => (
                                    <button key={chip.value} onClick={() => setAuctionSort(chip.value)}
                                        style={{ padding: '6px 14px', borderRadius: '16px', border: `1px solid ${auctionSort === chip.value ? 'var(--stroke)' : 'var(--stroke)'}`, background: auctionSort === chip.value ? 'var(--bg-elevated)' : 'transparent', color: auctionSort === chip.value ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: auctionSort === chip.value ? 700 : 400, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        {auctionSort === chip.value && <TrendingUp size={11} />}{chip.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Auction list */}
                        {auctionsLoading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={`auction-skel-${i}`} variant="card" height="110px" />
                                ))}
                            </div>
                        ) : filteredAuctions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
                                <Gavel size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>No active auctions</h3>
                                <p style={{ fontSize: '14px' }}>List your cosmetics from the Creator Dashboard!</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {filteredAuctions.map(auction => {
                                    const timeLeft = getTimeRemaining(auction.endsAt);
                                    const isUrgent = timeLeft.endsWith('m') && !timeLeft.includes('h');
                                    return (
                                        <div key={auction.id}
                                            onMouseEnter={() => setHoveredCard(auction.id)} onMouseLeave={() => setHoveredCard(null)}
                                            style={{ background: 'var(--bg-elevated)', border: `1px solid ${isUrgent ? 'var(--error)' : 'var(--stroke)'}`, borderRadius: '12px', padding: '20px', display: 'grid', gridTemplateColumns: '80px 2fr 1fr 1fr auto', alignItems: 'center', gap: '20px', transition: 'background 0.2s', cursor: 'pointer', backgroundColor: hoveredCard === auction.id ? 'var(--hover-overlay)' : 'var(--bg-elevated)' }}>
                                            <div style={{ width: '80px', height: '80px', borderRadius: '12px', background: auction.imageUrl ?? 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: '2px solid var(--stroke)' }} />

                                            <div>
                                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{auction.cosmeticName}</h3>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>by <span style={{ color: 'var(--accent-primary)' }}>@{auction.sellerName}</span></div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{auction.cosmeticType.replace(/_/g, ' ')}</div>
                                            </div>

                                            <div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Current Bid</div>
                                                <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Gem size={16} color="#f59e0b" /> {auction.currentBid.toLocaleString()}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <TrendingUp size={10} /> {auction.bidCount} bids
                                                </div>
                                            </div>

                                            <div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Time Left</div>
                                                <div style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', color: isUrgent ? 'var(--error)' : 'var(--text-primary)' }}>
                                                    <Clock size={16} /> {timeLeft}
                                                </div>
                                                {isUrgent && <div style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px', fontWeight: 600 }}>Ending soon!</div>}
                                            </div>

                                            <button onClick={() => setBiddingOn(auction)}
                                                style={{ background: 'var(--accent-purple)', border: 'none', padding: '12px 24px', borderRadius: '8px', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap', fontSize: '14px' }}
                                            ><ArrowUpRight size={18} /> Bid Now</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {purchaseItem && (
                <PurchaseModal item={purchaseItem} onClose={() => setPurchaseItem(null)} onConfirm={handleConfirmPurchase} />
            )}
            {biddingOn && (
                <BidModal
                    auction={biddingOn}
                    balance={gratoniteBalance ?? 0}
                    onClose={() => setBiddingOn(null)}
                    onBidSuccess={handleBidSuccess}
                />
            )}
            {showCreateItem && (
                <CreateItemModal onClose={() => setShowCreateItem(false)} />
            )}
        </div>
    );
};

export default Marketplace;
