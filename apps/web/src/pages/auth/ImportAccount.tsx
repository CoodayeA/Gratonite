import { Link, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import { CheckCircle, Upload, AlertTriangle, ArrowLeft, Loader } from 'lucide-react';
import { api, setAccessToken } from '../../lib/api';
import { useUser } from '../../contexts/UserContext';
import gsap from 'gsap';
import splashIcon from '../../assets/splash-icon.png';

interface PreviewInfo {
    username: string;
    federationAddress: string;
    displayName: string;
    relationshipsCount: number;
    guildMembershipsCount: number;
}

interface ImportResult {
    accessToken: string;
    username: string;
    tempPassword: string;
    message: string;
}

const ImportAccount = () => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [parsedData, setParsedData] = useState<unknown>(null);
    const [parsedSignature, setParsedSignature] = useState<string>('');
    const [previewInfo, setPreviewInfo] = useState<PreviewInfo | null>(null);
    const [parseError, setParseError] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [apiError, setApiError] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { refetchUser } = useUser();

    useEffect(() => {
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced || !cardRef.current) return;
        const els = cardRef.current.querySelectorAll('[data-auth-anim]');
        gsap.from(els, { y: -16, opacity: 0, stagger: 0.08, duration: 0.5, ease: 'power3.out' });
    }, [step]);

    const parseFile = useCallback((file: File) => {
        setParseError('');
        setParsedData(null);
        setParsedSignature('');
        setPreviewInfo(null);

        if (!file.name.endsWith('.json')) {
            setParseError('Invalid export file. Please make sure you downloaded the correct file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const raw = e.target?.result as string;
                const parsed = JSON.parse(raw);

                if (!parsed.data || !parsed.signature) {
                    setParseError('Invalid export file. Please make sure you downloaded the correct file.');
                    return;
                }

                const profile = parsed.data?.profile;
                if (!profile) {
                    setParseError('Invalid export file. Please make sure you downloaded the correct file.');
                    return;
                }

                setParsedData(parsed.data);
                setParsedSignature(parsed.signature);
                setPreviewInfo({
                    username: profile.username ?? '(unknown)',
                    federationAddress: profile.federationAddress ?? '(unknown)',
                    displayName: profile.displayName ?? profile.username ?? '(unknown)',
                    relationshipsCount: Array.isArray(parsed.data.relationships) ? parsed.data.relationships.length : 0,
                    guildMembershipsCount: Array.isArray(parsed.data.guildMemberships) ? parsed.data.guildMemberships.length : 0,
                });
            } catch {
                setParseError('Invalid export file. Please make sure you downloaded the correct file.');
            }
        };
        reader.onerror = () => {
            setParseError('Could not read the file. Please try again.');
        };
        reader.readAsText(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) parseFile(file);
    }, [parseFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) parseFile(file);
        e.target.value = '';
    };

    const handleImport = async () => {
        if (!parsedData || !parsedSignature) return;
        setIsLoading(true);
        setApiError('');
        setStep(3);
        try {
            const res = await api.federation.importNewAccount(parsedData, parsedSignature);
            setResult(res as ImportResult);
        } catch (err: any) {
            setApiError(err?.message || 'Import failed. Please check your export file and try again.');
            setIsLoading(false);
        }
    };

    const handleContinue = async () => {
        if (!result) return;
        setAccessToken(result.accessToken);
        await refetchUser();
        navigate('/');
    };

    return (
        <div className="auth-card" ref={cardRef}>
            {/* Mascot */}
            <div className="auth-mascot" data-auth-anim>
                <div className="auth-mascot-glow" />
                <img src={splashIcon} alt="Gratonite" />
            </div>

            {/* ── Step 1 ── */}
            {step === 1 && (
                <>
                    <h1 className="auth-heading" data-auth-anim>
                        {'IMPORT YOUR\n'}
                        <span className="auth-heading-accent">ACCOUNT.</span>
                    </h1>
                    <p className="auth-subtext" data-auth-anim>
                        Bring your existing Gratonite account to this instance.
                    </p>

                    <div className="auth-pill-row" data-auth-anim>
                        <span className="auth-pill">Your Data</span>
                        <span className="auth-pill auth-pill--highlight">Your Account</span>
                        <span className="auth-pill">Your Rules</span>
                    </div>

                    <div data-auth-anim style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--stroke)',
                        borderRadius: '10px',
                        padding: '20px',
                        width: '100%',
                        marginBottom: '8px',
                        textAlign: 'left',
                    }}>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: 1.6 }}>
                            First, download your account export from your current Gratonite instance. Go to{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>Settings → Account → Export Account</strong>{' '}
                            and download the <code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: '4px', fontSize: '13px' }}>.json</code> file.
                        </p>
                        <a
                            href="https://gratonite.chat/settings/account"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '9px 18px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '14px',
                                textDecoration: 'none',
                                transition: 'opacity 0.15s',
                            }}
                        >
                            Go to gratonite.chat to export →
                        </a>
                    </div>

                    <button
                        type="button"
                        className="auth-button"
                        data-auth-anim
                        onClick={() => setStep(2)}
                        style={{ marginTop: '8px' }}
                    >
                        Next →
                    </button>

                    <div className="auth-rainbow-strip" data-auth-anim>
                        <span style={{ background: '#6c63ff' }} />
                        <span style={{ background: '#f59e0b' }} />
                        <span style={{ background: '#ef4444' }} />
                        <span style={{ background: '#22c55e' }} />
                        <span style={{ background: '#3b82f6' }} />
                        <span style={{ background: '#8b5cf6' }} />
                    </div>

                    <p data-auth-anim style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: 'var(--accent-primary)' }}>Sign in</Link>
                    </p>
                </>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
                <>
                    <h1 className="auth-heading" data-auth-anim>
                        {'UPLOAD YOUR\n'}
                        <span className="auth-heading-accent">EXPORT FILE.</span>
                    </h1>
                    <p className="auth-subtext" data-auth-anim>Drop your .json export file below</p>

                    {/* Drop zone */}
                    <div
                        data-auth-anim
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        style={{
                            width: '100%',
                            border: `2px dashed ${isDragging ? 'var(--accent-primary)' : parseError ? 'var(--danger, #ef4444)' : previewInfo ? '#22c55e' : 'var(--stroke)'}`,
                            borderRadius: '12px',
                            padding: '32px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            background: isDragging ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                            transition: 'all 0.15s',
                            marginBottom: '12px',
                        }}
                    >
                        <Upload size={28} style={{ color: isDragging ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            Drop your <code style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: '4px' }}>.json</code> file here or <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>click to browse</span>
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                    </div>

                    {/* Parse error */}
                    {parseError && (
                        <p data-auth-anim style={{ color: 'var(--danger, #ef4444)', fontSize: '13px', margin: '-4px 0 10px 0', width: '100%', textAlign: 'left' }}>
                            {parseError}
                        </p>
                    )}

                    {/* Preview card */}
                    {previewInfo && (
                        <div data-auth-anim style={{
                            width: '100%',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid #22c55e40',
                            borderRadius: '10px',
                            padding: '16px',
                            marginBottom: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <CheckCircle size={16} style={{ color: '#22c55e', flexShrink: 0 }} />
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Account found</span>
                            </div>
                            <PreviewRow label="Username" value={`@${previewInfo.username}`} />
                            <PreviewRow label="Display Name" value={previewInfo.displayName} />
                            <PreviewRow label="Federation Address" value={previewInfo.federationAddress} mono />
                            <PreviewRow label="Relationships" value={String(previewInfo.relationshipsCount)} />
                            <PreviewRow label="Guild Memberships" value={String(previewInfo.guildMembershipsCount)} />
                        </div>
                    )}

                    {/* Action buttons */}
                    <div data-auth-anim style={{ display: 'flex', gap: '10px', width: '100%' }}>
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            style={{
                                flex: 1,
                                padding: '12px',
                                borderRadius: '10px',
                                border: '1px solid var(--stroke)',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                            }}
                        >
                            <ArrowLeft size={16} /> Back
                        </button>
                        <button
                            type="button"
                            className="auth-button"
                            disabled={!previewInfo}
                            onClick={handleImport}
                            style={{ flex: 2, marginTop: 0, opacity: previewInfo ? 1 : 0.4 }}
                        >
                            Import Account →
                        </button>
                    </div>
                </>
            )}

            {/* ── Step 3 ── */}
            {step === 3 && (
                <>
                    {/* Loading state */}
                    {isLoading && !result && !apiError && (
                        <>
                            <div data-auth-anim style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '20px 0' }}>
                                <Loader size={40} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                                    Importing your account…
                                </h2>
                                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                                    This may take a moment.
                                </p>
                            </div>
                        </>
                    )}

                    {/* Success state */}
                    {result && (
                        <>
                            <div data-auth-anim style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
                                <CheckCircle size={48} style={{ color: '#22c55e', marginBottom: '8px' }} />
                                <h1 className="auth-heading" style={{ textAlign: 'center' }}>
                                    WELCOME BACK,{' '}
                                    <span className="auth-heading-accent">{result.username.toUpperCase()}!</span>
                                </h1>
                                <p className="auth-subtext">Your account has been imported successfully.</p>
                            </div>

                            <div data-auth-anim style={{
                                width: '100%',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: '10px',
                                padding: '16px',
                                marginBottom: '12px',
                            }}>
                                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    Your temporary password:
                                </p>
                                <code style={{
                                    display: 'block',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--stroke)',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    fontSize: '16px',
                                    fontFamily: 'monospace',
                                    color: 'var(--text-primary)',
                                    fontWeight: 600,
                                    letterSpacing: '1px',
                                    wordBreak: 'break-all',
                                }}>
                                    {result.tempPassword}
                                </code>
                            </div>

                            <div data-auth-anim style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px',
                                background: '#f59e0b18',
                                border: '1px solid #f59e0b40',
                                borderRadius: '10px',
                                padding: '12px 14px',
                                width: '100%',
                                marginBottom: '8px',
                            }}>
                                <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                                <p style={{ margin: 0, fontSize: '13px', color: '#f59e0b', lineHeight: 1.5 }}>
                                    Save this password now — it will not be shown again. Change it in Settings after logging in.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="auth-button"
                                data-auth-anim
                                onClick={handleContinue}
                            >
                                Continue to app →
                            </button>
                        </>
                    )}

                    {/* Error state */}
                    {apiError && !result && (
                        <>
                            <div data-auth-anim style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px 0' }}>
                                <AlertTriangle size={40} style={{ color: 'var(--danger, #ef4444)' }} />
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                                    Import Failed
                                </h2>
                                <p style={{ margin: 0, fontSize: '14px', color: 'var(--danger, #ef4444)', textAlign: 'center' }}>
                                    {apiError}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="auth-button"
                                data-auth-anim
                                onClick={() => { setApiError(''); setStep(2); }}
                                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)' }}
                            >
                                <ArrowLeft size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                Try again
                            </button>
                        </>
                    )}
                </>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

function PreviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
            <span style={{
                fontSize: '13px',
                color: 'var(--text-primary)',
                fontWeight: 500,
                fontFamily: mono ? 'monospace' : undefined,
                textAlign: 'right',
                wordBreak: 'break-all',
            }}>
                {value}
            </span>
        </div>
    );
}

export default ImportAccount;
