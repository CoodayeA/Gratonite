import { useRouteError, isRouteErrorResponse, Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowLeft, RefreshCw } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';

export const ErrorBoundary = () => {
    const error = useRouteError();

    let errorMessage = "An unexpected error occurred.";
    let errorCode = "500";

    if (isRouteErrorResponse(error)) {
        errorCode = error.status.toString();
        errorMessage = error.data?.message || error.statusText;
    } else if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('Failed to fetch dynamically imported module')) {
            errorCode = 'Load';
            errorMessage =
                'The app updated but your browser loaded an old script reference. Click Reload, or hard-refresh (Ctrl+Shift+R). If the problem persists, clear site data for this domain.';
        }
    }

    return (
        <div style={{
            height: '100dvh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'white',
            fontFamily: 'var(--font-sans)',
            padding: '24px'
        }}>
            <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: '24px',
                padding: '48px',
                maxWidth: '480px',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '20px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--error)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px'
                }}>
                    <AlertOctagon size={40} />
                </div>

                <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.02em' }}>
                    Error {errorCode}
                </h1>

                <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', marginBottom: '32px' }}>
                    {errorMessage}
                </p>

                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                    <button
                        onClick={() => window.location.reload()}
                        className="auth-button"
                        style={{ flex: 1, display: 'flex', gap: '8px', justifyContent: 'center' }}
                    >
                        <RefreshCw size={18} /> Reload App
                    </button>
                    <Link to="/" style={{ flex: 1, textDecoration: 'none' }}>
                        <button
                            style={{
                                width: '100%',
                                display: 'flex',
                                gap: '8px',
                                justifyContent: 'center',
                                background: 'transparent',
                                border: '1px solid var(--stroke)',
                                color: 'white',
                                padding: '12px 24px',
                                borderRadius: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <ArrowLeft size={18} /> Go Home
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export const NotFound = () => {
    const nav = useNavigate();
    return (
        <div style={{
            height: '100dvh',
            width: '100vw',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-app)'
        }}>
            <EmptyState
                type="404"
                title="Lost in the void"
                description="The community you're looking for doesn't exist, has been deleted, or is temporarily out of phase with our reality."
                actionLabel="Return to Reality"
                onAction={() => nav('/')}
            />
        </div>
    );
};
