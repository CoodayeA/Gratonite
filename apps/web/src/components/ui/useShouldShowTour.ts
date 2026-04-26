import { useState, useEffect } from 'react';

// Keep in sync with the STORAGE_KEY used inside OnboardingTour.tsx.
// Defined here separately so the trigger hook can be imported without
// pulling in the heavy OnboardingTour component bundle.
export const TOUR_STORAGE_KEY = 'gratonite_tour_complete';

/**
 * Lightweight hook used at the App root to decide whether the
 * onboarding tour should be shown. The tour component itself is
 * lazy-loaded so its ~15KB of step definitions / lucide icons stays
 * out of the index chunk until the user actually sees the tour.
 */
export function useShouldShowTour() {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const done = localStorage.getItem(TOUR_STORAGE_KEY);
        if (!done) {
            const t = setTimeout(() => setShow(true), 2000);
            return () => clearTimeout(t);
        }
    }, []);
    return {
        show,
        dismiss: () => { localStorage.setItem(TOUR_STORAGE_KEY, '1'); setShow(false); },
        reset: () => { localStorage.removeItem(TOUR_STORAGE_KEY); setShow(true); },
    };
}
