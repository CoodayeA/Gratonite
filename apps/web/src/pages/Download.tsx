import { Monitor, Apple, ArrowLeft, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const VERSION = '1.0.4';
const BASE_URL = 'https://gratonite.chat/downloads';

export default function Download() {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
        }}>
            <div style={{ width: '100%', maxWidth: '520px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginBottom: '24px',
                        padding: 0,
                    }}
                >
                    <ArrowLeft size={16} />
                    Back
                </button>

                <div style={{
                    background: 'var(--bg-elevated)',
                    border: 'var(--border-structural, 3px solid #000)',
                    borderRadius: 'var(--radius-lg, 0)',
                    boxShadow: 'var(--shadow-panel, 8px 8px 0 #000)',
                    padding: '40px',
                }}>
                    <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                        <h1 style={{
                            fontSize: '28px',
                            fontWeight: 800,
                            fontFamily: 'var(--font-display)',
                            margin: '0 0 8px',
                        }}>
                            Download Gratonite
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
                            Desktop app · Version {VERSION}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* macOS */}
                        <a
                            href={`${BASE_URL}/Gratonite-${VERSION}-arm64.dmg`}
                            download
                            style={{ textDecoration: 'none' }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '20px 24px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s',
                            }}
                                className="hover-border-accent"
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #1c1c1e, #3a3a3c)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Apple size={24} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>
                                        macOS
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        .dmg installer · Apple Silicon (M1+)
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: 'var(--accent-primary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    Download
                                </div>
                            </div>
                        </a>

                        {/* Windows */}
                        <a
                            href={`${BASE_URL}/Gratonite%20Setup%20${VERSION}.exe`}
                            download
                            style={{ textDecoration: 'none' }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '20px 24px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s',
                            }}
                                className="hover-border-accent"
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #0078d4, #005a9e)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Monitor size={24} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>
                                        Windows
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        .exe installer · Windows 10+
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: 'var(--accent-primary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    Download
                                </div>
                            </div>
                        </a>

                        {/* Linux x64 */}
                        <a
                            href={`${BASE_URL}/Gratonite-${VERSION}.AppImage`}
                            download
                            style={{ textDecoration: 'none' }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '20px 24px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s',
                            }}
                                className="hover-border-accent"
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #e95420, #c7431a)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Terminal size={24} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>
                                        Linux (x64)
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        .AppImage · Also available as <a href={`${BASE_URL}/gratonite-desktop_${VERSION}_amd64.deb`} style={{ color: 'var(--accent-primary)' }} onClick={e => e.stopPropagation()}>.deb</a>
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: 'var(--accent-primary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    Download
                                </div>
                            </div>
                        </a>

                        {/* Linux ARM64 */}
                        <a
                            href={`${BASE_URL}/Gratonite-${VERSION}-arm64.AppImage`}
                            download
                            style={{ textDecoration: 'none' }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                padding: '20px 24px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                transition: 'border-color 0.15s',
                            }}
                                className="hover-border-accent"
                            >
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: 'linear-gradient(135deg, #e95420, #c7431a)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <Terminal size={24} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>
                                        Linux (ARM64)
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                        .AppImage · Also available as <a href={`${BASE_URL}/gratonite-desktop_${VERSION}_arm64.deb`} style={{ color: 'var(--accent-primary)' }} onClick={e => e.stopPropagation()}>.deb</a>
                                    </div>
                                </div>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    color: 'var(--accent-primary)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>
                                    Download
                                </div>
                            </div>
                        </a>
                    </div>

                    <p style={{
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginTop: '24px',
                        marginBottom: 0,
                    }}>
                        The desktop app provides native notifications, tray icon, and keyboard shortcuts.
                    </p>
                </div>
            </div>
        </div>
    );
}
