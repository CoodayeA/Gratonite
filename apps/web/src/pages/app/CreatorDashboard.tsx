import { useState, useEffect, useRef, useId } from 'react';
import { Upload, DollarSign, Image as ImageIcon, BarChart3, Clock, CheckCircle2, X, Loader2, AlertCircle, RefreshCw, FileUp } from 'lucide-react';
import { api, CommunityShopItem } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';
import Skeleton from '../../components/ui/Skeleton';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CosmeticItem {
    id: string;
    name: string;
    type: string;
    description: string | null;
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | string;
    assetUrl: string | null;
    previewImageUrl: string | null;
    price: number;
    installCount: number;
    createdAt: string;
    rejectionReason: string | null;
    isPublished: boolean;
}

function mapApiCosmetic(r: any): CosmeticItem {
    return {
        id: r.id,
        name: r.name ?? 'Unnamed',
        type: r.type ?? r.itemType ?? '',
        description: r.description ?? null,
        status: r.status ?? (r.isPublished ? 'approved' : 'draft'),
        assetUrl: r.assetUrl ?? null,
        previewImageUrl: r.previewImageUrl ?? null,
        price: r.price ?? 0,
        installCount: r.installCount ?? 0,
        createdAt: r.createdAt ?? '',
        rejectionReason: r.rejectionReason ?? r.moderationNotes ?? null,
        isPublished: r.isPublished ?? false,
    };
}

const CreatorDashboard = () => {
    const baseId = useId();
    const itemNameId = `${baseId}-item-name`;
    const itemTypeId = `${baseId}-item-type`;
    const itemPriceId = `${baseId}-item-price`;
    const itemAssetsId = `${baseId}-item-assets`;
    const { addToast } = useToast();
    const [submissions, setSubmissions] = useState<CosmeticItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isSubmitOpen, setIsSubmitOpen] = useState(false);
    const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success'>('idle');
    const [itemName, setItemName] = useState('');
    const [itemType, setItemType] = useState<CommunityShopItem['itemType']>('avatar_decoration');
    const [itemPrice, setItemPrice] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isUploadingFile, setIsUploadingFile] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Per-item upload refs (hidden file inputs for asset upload on existing items)
    const assetFileInputRef = useRef<HTMLInputElement>(null);
    const [assetUploadTargetId, setAssetUploadTargetId] = useState<string | null>(null);
    const [assetUploading, setAssetUploading] = useState<string | null>(null);
    const [submittingReviewId, setSubmittingReviewId] = useState<string | null>(null);

    // ── Fetch my cosmetics ────────────────────────────────────────────────────

    const fetchSubmissions = () => {
        setLoading(true);
        setError(null);
        api.cosmetics.listMine()
            .then((data: any[]) => setSubmissions((Array.isArray(data) ? data : []).map(mapApiCosmetic)))
            .catch(err => {
                setSubmissions([]);
                setError(err.message ?? 'Failed to load submissions.');
                addToast({ title: 'Error', description: err.message ?? 'Failed to load submissions.', variant: 'error' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchSubmissions();
    }, []);

    // ── Derived stats ─────────────────────────────────────────────────────────

    const totalRevenue = submissions.reduce((sum, s) => sum + (s.installCount ?? 0) * (s.price ?? 0), 0);
    const totalSales = submissions.reduce((sum, s) => sum + (s.installCount ?? 0), 0);
    const activeItems = submissions.filter(s => s.status === 'approved' || s.isPublished).length;

    // ── Handle file select for new submission ─────────────────────────────────

    const handleFileSelect = (file: File) => {
        setUploadedFile(file);
    };

    // ── Upload asset for existing item ────────────────────────────────────────

    const handleAssetUpload = async (itemId: string, file: File) => {
        setAssetUploading(itemId);
        try {
            const result = await api.cosmetics.uploadAsset(itemId, file);
            setSubmissions(prev => prev.map(s =>
                s.id === itemId ? { ...s, assetUrl: result.assetUrl } : s
            ));
            addToast({ title: 'Asset uploaded', description: 'Asset has been attached to your item.', variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Upload failed', description: err.message ?? 'Could not upload asset.', variant: 'error' });
        } finally {
            setAssetUploading(null);
            setAssetUploadTargetId(null);
        }
    };

    // ── Submit existing item for review ──────────────────────────────────────

    const handleSubmitForReview = async (item: CosmeticItem) => {
        setSubmittingReviewId(item.id);
        try {
            await api.cosmetics.submitForReview(item.id);
            setSubmissions(prev => prev.map(s =>
                s.id === item.id ? { ...s, status: 'pending_review' } : s
            ));
            addToast({ title: 'Submitted for review', description: `"${item.name}" is now pending review.`, variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Submit failed', description: err.message ?? 'Could not submit for review.', variant: 'error' });
        } finally {
            setSubmittingReviewId(null);
        }
    };

    // ── Handle new item form submission ──────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitState('submitting');
        try {
            // Step 1: Create the cosmetic
            const newItem = await api.cosmetics.create({
                name: itemName.trim(),
                type: itemType,
                description: `Proposed price: ${itemPrice} Gratonites`,
                price: Number(itemPrice),
            });

            // Step 2: Upload asset if selected
            if (uploadedFile) {
                try {
                    await api.cosmetics.uploadAsset(newItem.id, uploadedFile);
                } catch {
                    // Non-fatal: item was created, asset upload failed
                    addToast({ title: 'Asset upload failed', description: 'Item created but asset could not be attached.', variant: 'error' });
                }
            }

            // Step 3: Submit for review
            await api.cosmetics.submitForReview(newItem.id);

            const mapped = mapApiCosmetic({ ...newItem, status: 'pending_review' });
            setSubmissions(prev => [mapped, ...prev]);
            setSubmitState('success');

            setTimeout(() => {
                setIsSubmitOpen(false);
                setSubmitState('idle');
                setItemName('');
                setItemType('avatar_decoration');
                setItemPrice('');
                setUploadedFile(null);
            }, 1500);
        } catch (err: any) {
            setSubmitState('idle');
            addToast({ title: 'Submission failed', description: err.message ?? 'Could not submit item.', variant: 'error' });
        }
    };

    // ── Status display helper ─────────────────────────────────────────────────

    const statusBadge = (item: CosmeticItem) => {
        switch (item.status) {
            case 'approved':
                return (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                        <CheckCircle2 size={12} /> Approved
                    </span>
                );
            case 'rejected':
                return (
                    <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--error)', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                            <X size={12} /> Rejected
                        </span>
                        {item.rejectionReason && (
                            <div style={{ fontSize: '11px', color: 'var(--error)', marginTop: '4px', opacity: 0.8 }}>
                                {item.rejectionReason}
                            </div>
                        )}
                    </div>
                );
            case 'pending_review':
                return (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                        <Clock size={12} /> Pending Review
                    </span>
                );
            case 'draft':
            default:
                return (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--stroke)' }}>
                        Draft
                    </span>
                );
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)', position: 'relative' }}>
            {/* Hidden file input for per-item asset upload */}
            <input
                ref={assetFileInputRef}
                type="file"
                accept="image/*,.zip,.glb,.gltf"
                style={{ display: 'none' }}
                onChange={e => {
                    if (e.target.files?.[0] && assetUploadTargetId) {
                        handleAssetUpload(assetUploadTargetId, e.target.files[0]);
                    }
                    e.target.value = '';
                }}
            />

            <div className="content-padding" style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Creator Dashboard</h1>
                        <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Submit custom cosmetics to the Gratonite Shop and earn revenue.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={fetchSubmissions} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '0 12px', height: '40px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                            <RefreshCw size={14} /> Refresh
                        </button>
                        <button onClick={() => setIsSubmitOpen(true)} className="auth-button" style={{ margin: 0, width: 'auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-primary)', height: '40px' }}>
                            <Upload size={16} /> Submit New Item
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid-mobile-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
                    {loading ? (
                        <>
                            <Skeleton variant="card" height="100px" />
                            <Skeleton variant="card" height="100px" />
                            <Skeleton variant="card" height="100px" />
                        </>
                    ) : (
                        <>
                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>
                                    <DollarSign size={16} /> Total Revenue
                                </div>
                                <div style={{ fontSize: '32px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                                    {totalRevenue.toLocaleString()} G
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>
                                    <BarChart3 size={16} /> Total Sales
                                </div>
                                <div style={{ fontSize: '32px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                                    {totalSales}
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '12px', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase' }}>
                                    <ImageIcon size={16} /> Active Items
                                </div>
                                <div style={{ fontSize: '32px', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                                    {activeItems}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>Your Submissions</h2>

                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 140px', gap: '16px', padding: '16px 24px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        <div>Item Name</div>
                        <div>Status</div>
                        <div>Sales</div>
                        <div>Date</div>
                        <div>Actions</div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {loading && (
                            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={`cd-skel-${i}`} variant="text" height="56px" />
                                ))}
                            </div>
                        )}

                        {!loading && error && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', gap: '10px', color: 'var(--error)', flexDirection: 'column' }}>
                                <AlertCircle size={24} />
                                <p>{error}</p>
                                <button onClick={fetchSubmissions} style={{ marginTop: '8px', padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}>Retry</button>
                            </div>
                        )}

                        {!loading && !error && submissions.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                                <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No submissions yet</p>
                                <p style={{ fontSize: '13px' }}>Submit your first cosmetic item to start earning revenue!</p>
                            </div>
                        )}

                        {!loading && !error && submissions.map((sub, idx) => (
                            <div
                                key={sub.id}
                                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 140px', gap: '16px', padding: '16px 24px', borderBottom: idx === submissions.length - 1 ? 'none' : '1px solid var(--stroke)', alignItems: 'center', transition: 'background 0.2s' }}
                                className="hover-bg-white-2"
                            >
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{sub.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sub.type.replace(/_/g, ' ')}</div>
                                    {sub.assetUrl && (
                                        <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '2px' }}>Asset attached</div>
                                    )}
                                </div>

                                <div>{statusBadge(sub)}</div>

                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{sub.installCount ?? 0}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--success)' }}>{((sub.installCount ?? 0) * (sub.price ?? 0)).toLocaleString()} G</div>
                                </div>

                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : '—'}
                                </div>

                                {/* Actions column */}
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {/* Upload asset button - always visible for draft items without asset */}
                                    {(sub.status === 'draft' || !sub.assetUrl) && (
                                        <button
                                            onClick={() => {
                                                setAssetUploadTargetId(sub.id);
                                                assetFileInputRef.current?.click();
                                            }}
                                            disabled={assetUploading === sub.id}
                                            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: assetUploading === sub.id ? 'wait' : 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            {assetUploading === sub.id
                                                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                                                : <FileUp size={11} />
                                            }
                                            {assetUploading === sub.id ? '...' : 'Asset'}
                                        </button>
                                    )}

                                    {/* Submit for review - only visible if draft and has asset or assetConfig */}
                                    {sub.status === 'draft' && (sub.assetUrl || sub.previewImageUrl) && (
                                        <button
                                            onClick={() => handleSubmitForReview(sub)}
                                            disabled={submittingReviewId === sub.id}
                                            style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: '#000', cursor: submittingReviewId === sub.id ? 'wait' : 'pointer', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            {submittingReviewId === sub.id
                                                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                                                : <Upload size={11} />
                                            }
                                            {submittingReviewId === sub.id ? '...' : 'Review'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Submit Modal ── */}
            {isSubmitOpen && (
                <div className="modal-overlay" style={{ zIndex: 999 }}>
                    <div className="auth-card wide glass-panel" style={{ width: 'min(500px, 95vw)', position: 'relative', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflowY: 'auto' }}>
                        <button onClick={() => submitState !== 'submitting' && setIsSubmitOpen(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>

                        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', fontFamily: 'var(--font-display)' }}>Submit Cosmetic</h2>

                        {submitState === 'success' ? (
                            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--success)' }}>
                                <CheckCircle2 size={48} style={{ margin: '0 auto 16px' }} />
                                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Item Submitted!</h3>
                                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Your item is now pending review.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="input-group">
                                    <label htmlFor={itemNameId} className="input-label">Item Name</label>
                                    <input id={itemNameId} type="text" className="auth-input" placeholder="e.g. Neon Horizon Frame" required value={itemName} onChange={e => setItemName(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label htmlFor={itemTypeId} className="input-label">Item Type</label>
                                    <select
                                        id={itemTypeId}
                                        className="auth-input"
                                        required
                                        style={{ appearance: 'none' }}
                                        value={itemType}
                                        onChange={e => setItemType(e.target.value as CommunityShopItem['itemType'])}
                                    >
                                        <option value="avatar_decoration">Avatar Frame/Decoration</option>
                                        <option value="profile_effect">Profile Effect</option>
                                        <option value="nameplate">Nameplate</option>
                                        <option value="display_name_style_pack">Display Name Style Pack</option>
                                        <option value="profile_widget_pack">Profile Widget Pack</option>
                                        <option value="server_tag_badge">Server Tag Badge</option>
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label htmlFor={itemPriceId} className="input-label">Proposed Price (Gratonites)</label>
                                    <input id={itemPriceId} type="number" className="auth-input" placeholder="e.g. 500" required min="100" value={itemPrice} onChange={e => setItemPrice(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label htmlFor={itemAssetsId} className="input-label">Upload Assets (optional)</label>
                                    <input
                                        id={itemAssetsId}
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,.zip,.glb,.gltf"
                                        style={{ display: 'none' }}
                                        onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
                                    />
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={e => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]); }}
                                        style={{ border: `2px dashed ${uploadedFile ? 'var(--accent-primary)' : 'var(--stroke)'}`, borderRadius: '8px', padding: '32px', textAlign: 'center', color: uploadedFile ? 'var(--text-primary)' : 'var(--text-muted)', cursor: isUploadingFile ? 'not-allowed' : 'pointer', transition: 'border-color 0.2s' }}
                                    >
                                        {isUploadingFile ? (
                                            <>
                                                <Loader2 size={24} style={{ margin: '0 auto 12px', animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                                                <div style={{ fontSize: '14px', fontWeight: 600 }}>Uploading...</div>
                                            </>
                                        ) : uploadedFile ? (
                                            <>
                                                <Upload size={24} style={{ margin: '0 auto 12px', color: 'var(--accent-primary)' }} />
                                                <div style={{ fontSize: '14px', fontWeight: 600 }}>{uploadedFile.name}</div>
                                                <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-secondary)' }}>
                                                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB — will upload on submit
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={24} style={{ margin: '0 auto 12px' }} />
                                                <div style={{ fontSize: '14px', fontWeight: 600 }}>Click to browse or drag and drop</div>
                                                <div style={{ fontSize: '12px', marginTop: '4px' }}>Supported: images, ZIP, GLB. Max 10MB.</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    className="auth-button"
                                    style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                    disabled={submitState === 'submitting'}
                                >
                                    {submitState === 'submitting' && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
                                    {submitState === 'submitting' ? 'Submitting...' : 'Submit for Review'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreatorDashboard;
