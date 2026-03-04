import React from 'react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
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
        console.error('[ErrorBoundary]', error, info.componentStack);
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
                    <div style={{ fontSize: '48px' }}>💥</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Something went wrong
                    </h2>
                    <p style={{ fontSize: '14px', maxWidth: '400px', textAlign: 'center', lineHeight: 1.6 }}>
                        {this.state.error?.message || 'An unexpected error occurred in this section.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        style={{
                            padding: '10px 24px', background: 'var(--accent-primary)', color: '#111',
                            border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer'
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
