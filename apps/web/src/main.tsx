import "./instrument";               // Sentry must init before everything else

import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import App from './App.tsx'
import './index.css'
import './themes/overrides/theme-scrollbar.css'
import './themes/overrides/theme-selection.css'
import './themes/overrides/glass-optimization.css'
import { ThemeProvider } from './components/ui/ThemeProvider'
import { queryClient } from './lib/queryClient'
import { init as initErrorReporter } from './lib/errorReporter'
import { applyWebExperimentsToDocument } from './lib/experiments'

applyWebExperimentsToDocument();

// GSAP global setup
gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power3.out', duration: 0.6 });

// Initialize global error reporting (window.onerror + unhandledrejection)
initErrorReporter();

const isLocalhostHost = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

// Register service worker for PWA support (Phase 9, Item 145)
if ('serviceWorker' in navigator && import.meta.env.PROD && !isLocalhostHost) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' }).then(reg => {
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
    <Sentry.ErrorBoundary fallback={<p>Something went wrong</p>}>
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </QueryClientProvider>
    </Sentry.ErrorBoundary>,
)
