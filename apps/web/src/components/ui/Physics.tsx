import React, { useRef, useState, MouseEvent } from 'react';

// --- MAGNETIC BUTTON ---
// Pill pulls slightly toward the mouse when hovering over the button bounds.
export const MagneticButton = ({ children, strength = 20, className = '', style = {}, ...props }: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & { strength?: number }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
        if (!ref.current) return;
        const { clientX, clientY } = e;
        const { height, width, left, top } = ref.current.getBoundingClientRect();

        const x = clientX - (left + width / 2);
        const y = clientY - (top + height / 2);

        setPosition({
            x: (x / width) * strength,
            y: (y / height) * strength
        });
    };

    const handleMouseLeave = () => {
        setPosition({ x: 0, y: 0 });
    };

    return (
        <button
            ref={ref}
            className={className}
            style={{
                ...style,
                transform: `translate(${position.x}px, ${position.y}px)`,
                transition: position.x === 0 && position.y === 0 ? 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' : 'transform 0.1s ease-out',
                willChange: 'transform'
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            {...props}
        >
            {children}
        </button>
    );
};

// --- TILT CARD ---
// Perspective tilt effect tracking mouse over the card. Good for Shop items.
export const TiltCard = ({ children, className = '', style = {}, maxTilt = 15, scale = 1.02, onClick }: { children: React.ReactNode, className?: string, style?: React.CSSProperties, maxTilt?: number, scale?: number, onClick?: () => void }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ rx: 0, ry: 0, translateZ: 0 });

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;
        const { clientX, clientY } = e;
        const { height, width, left, top } = ref.current.getBoundingClientRect();

        // Calculate center relative coordinate [-1, 1]
        const x = (clientX - left) / width - 0.5;
        const y = (clientY - top) / height - 0.5;

        setTilt({
            rx: -y * maxTilt,  // Invert Y for correct tilt axis
            ry: x * maxTilt,
            translateZ: 20    // Push forward slightly
        });
    };

    const handleMouseLeave = () => {
        setTilt({ rx: 0, ry: 0, translateZ: 0 });
    };

    return (
        <div
            className={className}
            ref={ref}
            onClick={onClick}
            style={{
                ...style,
                perspective: '1000px',
                transformStyle: 'preserve-3d',
                transform: `perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${tilt.rx === 0 ? 1 : scale}) translateZ(${tilt.translateZ}px)`,
                transition: tilt.rx === 0 && tilt.ry === 0 ? 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' : 'transform 0.1s ease-out',
                willChange: 'transform'
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {children}
        </div>
    );
};

// --- RIPPLE WRAPPER ---
// Adds a material-style ripple on click.
export const RippleWrapper = ({ children, className = '', style = {}, onClick }: { children: React.ReactNode, className?: string, style?: React.CSSProperties, onClick?: (e: MouseEvent<HTMLDivElement>) => void }) => {
    const [ripples, setRipples] = useState<{ x: number, y: number, id: number }[]>([]);

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const id = Date.now();

        setRipples(prev => [...prev, { x, y, id }]);

        if (onClick) onClick(e);

        // Cleanup ripple after animation
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== id));
        }, 600);
    };

    return (
        <div
            className={className}
            style={{ ...style, position: 'relative', overflow: 'hidden' }}
            onClick={handleClick}
        >
            {children}
            {ripples.map(r => (
                <span
                    key={r.id}
                    style={{
                        position: 'absolute',
                        left: r.x,
                        top: r.y,
                        transform: 'translate(-50%, -50%)',
                        width: '0',
                        height: '0',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.4)',
                        animation: 'rippleAnim 0.6s linear forwards',
                        pointerEvents: 'none'
                    }}
                />
            ))}
            <style>
                {`
                    @keyframes rippleAnim {
                        0% { width: 0; height: 0; opacity: 0.5; }
                        100% { width: 500px; height: 500px; opacity: 0; }
                    }
                `}
            </style>
        </div>
    );
};
