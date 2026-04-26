import React from 'react';

type Props = {
    children: React.ReactNode;
    fallback?: React.ReactNode;
};

type State = {
    hasError: boolean;
};

// Lightweight synchronous error boundary used at the React tree root.
// It captures render errors immediately (before Sentry has been deferred-loaded)
// and forwards them to Sentry asynchronously once the SDK is available, so we
// don't need to eagerly bundle '@sentry/react' on the critical path.
class RootErrorBoundary extends React.Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        // Surface to console immediately
        // eslint-disable-next-line no-console
        console.error('[RootErrorBoundary] caught error:', error, errorInfo);

        // Forward to Sentry lazily — does not block initial render.
        // If Sentry hasn't initialized yet, this still queues correctly because
        // Sentry buffers events created before/after init.
        import('@sentry/react')
            .then((Sentry) => {
                try {
                    Sentry.captureException(error, {
                        contexts: {
                            react: { componentStack: errorInfo.componentStack ?? undefined },
                        },
                    });
                } catch {
                    /* ignore */
                }
            })
            .catch(() => {
                /* ignore — Sentry chunk failed to load */
            });
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return this.props.fallback ?? <p>Something went wrong</p>;
        }
        return this.props.children;
    }
}

export default RootErrorBoundary;
