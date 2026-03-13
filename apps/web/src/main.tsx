import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './components/ui/ThemeProvider'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { queryClient } from './lib/queryClient'
import { init as initErrorReporter } from './lib/errorReporter'

// Initialize global error reporting (window.onerror + unhandledrejection)
initErrorReporter();

// Restore streamer mode on load
if (localStorage.getItem('gratonite:streamer-mode') === 'true') {
    document.body.classList.add('streamer-mode');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </QueryClientProvider>
    </ErrorBoundary>,
)
