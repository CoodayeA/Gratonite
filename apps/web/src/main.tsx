import { initSentry } from "./instrument";

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'
import './themes/overrides/theme-scrollbar.css'
import './themes/overrides/theme-selection.css'
import './themes/overrides/glass-optimization.css'
import './portal/portal-themes.css'
import { ThemeProvider } from './components/ui/ThemeProvider'
import { TrustCardProvider } from './contexts/TrustCardContext'
import { queryClient } from './lib/queryClient'
import { init as initErrorReporter } from './lib/errorReporter'
import { applyWebExperimentsToDocument } from './lib/experiments'
import { loadGsap } from './lib/gsapLazy'
import RootErrorBoundary from './components/RootErrorBoundary'

applyWebExperimentsToDocument();

// Defer Sentry init + GSAP plugin/defaults setup off the critical render path.
// Errors thrown before this fires won't be captured — acceptable trade-off.
const scheduleIdle = (cb: () => void) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(cb, { timeout: 2000 });
    } else {
        setTimeout(cb, 1);
    }
};

scheduleIdle(() => {
    initSentry();
    loadGsap().then(async (gsap) => {
        const { ScrollTrigger } = await import('gsap/ScrollTrigger');
        gsap.registerPlugin(ScrollTrigger);
        gsap.defaults({ ease: 'power3.out', duration: 0.6 });
    });
});

// Initialize global error reporting (window.onerror + unhandledrejection)
initErrorReporter();

const isLocalhostHost = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

// Register service worker for PWA support (Phase 9, Item 145)
if ('serviceWorker' in navigator && import.meta.env.PROD && !isLocalhostHost && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('/app/sw.js', window.location.origin);
    navigator.serviceWorker.register(serviceWorkerUrl, { scope: '/app/' }).then(reg => {
      // Check for updates every 30 minutes
      setInterval(() => {
        reg.update().catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('Service Worker system has shutdown')) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          console.warn('[SW] Update failed:', err);
        });
      }, 30 * 60 * 1000);

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              // New version available — the UpdateBanner component will pick this up
              window.dispatchEvent(new CustomEvent('sw-update-available'));
            }
          });
        }
      });
    }).catch(err => {
      console.warn('[SW] Registration failed:', err);
    });
  });
}

// Restore streamer mode on load
if (localStorage.getItem('gratonite:streamer-mode') === 'true') {
    document.body.classList.add('streamer-mode');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <RootErrorBoundary fallback={<p>Something went wrong</p>}>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <TrustCardProvider>
                    <App />
                </TrustCardProvider>
            </ThemeProvider>
        </QueryClientProvider>
    </RootErrorBoundary>,
)
