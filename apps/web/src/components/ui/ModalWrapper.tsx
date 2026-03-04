import React, { useState, useEffect } from 'react';

/**
 * Custom hook to delay unmounting of a component to allow for exit animations
 */
export function useDelayUnmount(isMounted: boolean, delayTime: number) {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (isMounted && !shouldRender) {
            setShouldRender(true);
        } else if (!isMounted && shouldRender) {
            timeoutId = setTimeout(() => setShouldRender(false), delayTime);
        }
        return () => clearTimeout(timeoutId);
    }, [isMounted, delayTime, shouldRender]);

    return shouldRender;
}

interface ModalWrapperProps {
    isOpen: boolean;
    children: React.ReactNode;
}

export const ModalWrapper: React.FC<ModalWrapperProps> = ({ isOpen, children }) => {
    const shouldRender = useDelayUnmount(isOpen, 200);

    // Prevent background scrolling while modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!shouldRender) return null;

    return (
        <div
            className={`modal-animation-controller ${!isOpen ? 'modal-closing' : 'modal-opening'}`}
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none',
                // Children will be position: relative to this container if they are 'fixed'
            }}
        >
            <div style={{ pointerEvents: 'auto', width: '100%', height: '100%' }}>
                {children}
            </div>
        </div>
    );
};
