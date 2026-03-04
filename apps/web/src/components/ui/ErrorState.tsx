import { AlertTriangle, RefreshCw } from 'lucide-react';

/* ────────────────────────────────────────────
   ErrorState – shown when a data fetch fails.
   Displays an error icon, a human-readable
   message, and a Retry button.
   ──────────────────────────────────────────── */

type ErrorStateProps = {
    /** Headline shown to the user, e.g. "Failed to load messages" */
    message?: string;
    /** Optional longer description */
    description?: string;
    /** Callback invoked when the user clicks Retry */
    onRetry?: () => void;
    /** Label on the retry button */
    retryLabel?: string;
    /** When true, render a compact inline version instead of the centered block */
    compact?: boolean;
};

export const ErrorState = ({
    message = 'Something went wrong',
    description,
    onRetry,
    retryLabel = 'Retry',
    compact = false,
}: ErrorStateProps) => {
    if (compact) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                color: 'var(--text-secondary)',
                fontSize: '13px',
            }}>
                <AlertTriangle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
                <span>{message}</span>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        style={{
                            background: 'transparent',
                            border: '1px solid var(--stroke)',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0,
                        }}
                    >
                        <RefreshCw size={12} />
                        {retryLabel}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
            gap: '16px',
            flex: 1,
            animation: 'fadeInSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
            <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(237, 66, 69, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <AlertTriangle size={28} style={{ color: 'var(--error)' }} />
            </div>

            <h3 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
            }}>
                {message}
            </h3>

            {description && (
                <p style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    maxWidth: '320px',
                    lineHeight: 1.6,
                    margin: 0,
                }}>
                    {description}
                </p>
            )}

            {onRetry && (
                <button
                    onClick={onRetry}
                    style={{
                        marginTop: '8px',
                        padding: '10px 24px',
                        background: 'var(--accent-primary)',
                        color: 'var(--bg-primary)',
                        border: 'none',
                        borderRadius: 'var(--radius-md, 8px)',
                        fontWeight: 700,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                    <RefreshCw size={16} />
                    {retryLabel}
                </button>
            )}
        </div>
    );
};

export default ErrorState;
