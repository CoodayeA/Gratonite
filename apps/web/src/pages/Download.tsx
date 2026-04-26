import { useEffect, useState } from 'react';
import { Monitor, Apple, ArrowLeft, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BASE_URL = 'https://gratonite.chat/downloads';

type DesktopRelease = {
    version: string;
    macDmg: string;
    windowsExe: string;
    linuxAppImage: string;
    linuxDeb: string;
    linuxArm64AppImage: string;
    linuxArm64Deb: string;
};

const FALLBACK_RELEASE: DesktopRelease = {
    version: '1.0.10',
    macDmg: `${BASE_URL}/Gratonite-1.0.10-universal.dmg`,
    windowsExe: `${BASE_URL}/Gratonite%20Setup%201.0.10.exe`,
    linuxAppImage: `${BASE_URL}/Gratonite-1.0.10.AppImage`,
    linuxDeb: `${BASE_URL}/gratonite-desktop_1.0.10_amd64.deb`,
    linuxArm64AppImage: `${BASE_URL}/Gratonite-1.0.10-arm64.AppImage`,
    linuxArm64Deb: `${BASE_URL}/gratonite-desktop_1.0.10_arm64.deb`,
};

const cleanYamlValue = (value: string) => value.trim().replace(/^['"]|['"]$/g, '');
const parseVersion = (yaml: string) => {
    const match = yaml.match(/^version:\s*(.+)$/m);
    return match ? cleanYamlValue(match[1]) : FALLBACK_RELEASE.version;
};
const parseFileUrls = (yaml: string) =>
    Array.from(yaml.matchAll(/^\s*-\s+url:\s*(.+)$/gm)).map((m) => cleanYamlValue(m[1]));
const pickUrl = (urls: string[], predicate: (url: string) => boolean, fallback: string) => {
    const match = urls.find(predicate);
    return match ? `${BASE_URL}/${match}` : fallback;
};

const fetchRelease = async (): Promise<DesktopRelease> => {
    try {
        const [windowsRes, macRes, linuxRes, linuxArmRes] = await Promise.all([
            fetch(`${BASE_URL}/latest.yml`, { cache: 'no-store' }),
            fetch(`${BASE_URL}/latest-mac.yml`, { cache: 'no-store' }),
            fetch(`${BASE_URL}/latest-linux.yml`, { cache: 'no-store' }),
            fetch(`${BASE_URL}/latest-linux-arm64.yml`, { cache: 'no-store' }),
        ]);
        if (!windowsRes.ok || !macRes.ok || !linuxRes.ok || !linuxArmRes.ok) return FALLBACK_RELEASE;

        const [windowsYaml, macYaml, linuxYaml, linuxArmYaml] = await Promise.all([
            windowsRes.text(),
            macRes.text(),
            linuxRes.text(),
            linuxArmRes.text(),
        ]);

        const windowsFiles = parseFileUrls(windowsYaml);
        const macFiles = parseFileUrls(macYaml);
        const linuxFiles = parseFileUrls(linuxYaml);
        const linuxArmFiles = parseFileUrls(linuxArmYaml);

        return {
            version: parseVersion(windowsYaml),
            macDmg: pickUrl(macFiles, (url) => url.endsWith('.dmg'), FALLBACK_RELEASE.macDmg),
            windowsExe: pickUrl(windowsFiles, (url) => url.endsWith('.exe'), FALLBACK_RELEASE.windowsExe),
            linuxAppImage: pickUrl(linuxFiles, (url) => url.endsWith('.AppImage'), FALLBACK_RELEASE.linuxAppImage),
            linuxDeb: pickUrl(linuxFiles, (url) => url.endsWith('.deb'), FALLBACK_RELEASE.linuxDeb),
            linuxArm64AppImage: pickUrl(linuxArmFiles, (url) => url.endsWith('.AppImage'), FALLBACK_RELEASE.linuxArm64AppImage),
            linuxArm64Deb: pickUrl(linuxArmFiles, (url) => url.endsWith('.deb'), FALLBACK_RELEASE.linuxArm64Deb),
        };
    } catch {
        return FALLBACK_RELEASE;
    }
};

export default function Download() {
    const navigate = useNavigate();
    const [release, setRelease] = useState<DesktopRelease>(FALLBACK_RELEASE);

    useEffect(() => {
        let cancelled = false;
        fetchRelease().then((data) => {
            if (!cancelled) setRelease(data);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <div style={{
            minHeight: '100dvh',
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
                            Desktop app · Version {release.version}
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* macOS */}
                        <a
                            href={release.macDmg}
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
                                        .dmg installer · Universal (Intel + Apple Silicon)
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
                            href={release.windowsExe}
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
                            href={release.linuxAppImage}
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
                                        .AppImage · Also available as <a href={release.linuxDeb} style={{ color: 'var(--accent-primary)' }} onClick={e => e.stopPropagation()}>.deb</a>
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
                            href={release.linuxArm64AppImage}
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
                                        .AppImage · Also available as <a href={release.linuxArm64Deb} style={{ color: 'var(--accent-primary)' }} onClick={e => e.stopPropagation()}>.deb</a>
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
