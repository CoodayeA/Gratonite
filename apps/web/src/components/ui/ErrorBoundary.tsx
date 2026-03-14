import React from 'react';
import { reportError } from '../../lib/errorReporter';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    /** Human-readable name for the section (e.g. "Chat", "Sidebar") — shown in the default fallback */
    name?: string;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        const section = this.props.name || 'unknown';
        console.error(`[ErrorBoundary:${section}]`, error, info.componentStack);
        reportError(error, { componentStack: info.componentStack ?? undefined });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', flex: 1, padding: '48px',
                    color: 'var(--text-secondary)', gap: '16px'
                }}>
                    <div style={{ fontSize: '48px' }}>!</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {this.props.name ? `${this.props.name} crashed` : 'Something went wrong'}
                    </h2>
                    <p style={{ fontSize: '14px', maxWidth: '400px', textAlign: 'center', lineHeight: 1.6 }}>
                        {this.state.error?.message || `An unexpected error occurred${this.props.name ? ` in ${this.props.name}` : ''}.`}
                    </p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 24px', background: 'var(--accent-primary)', color: '#111',
                                border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                            }}
                        >
                            Reload
                        </button>
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            style={{
                                padding: '10px 24px', background: 'transparent',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--text-muted)', borderRadius: '8px',
                                fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
