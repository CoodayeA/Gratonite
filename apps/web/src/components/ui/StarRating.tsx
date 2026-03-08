import { useState } from 'react';
import { Star } from 'lucide-react';

export const StarRating = ({
    value, onChange, readOnly = false, size = 20
}: { value: number; onChange?: (v: number) => void; readOnly?: boolean; size?: number }) => {
    const [hovered, setHovered] = useState(0);

    return (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(i => (
                <Star
                    key={i}
                    size={size}
                    fill={(hovered || value) >= i ? '#f59e0b' : 'none'}
                    color={(hovered || value) >= i ? '#f59e0b' : 'var(--text-muted)'}
                    style={{ cursor: readOnly ? 'default' : 'pointer', transition: 'color 0.15s, fill 0.15s' }}
                    onMouseEnter={() => !readOnly && setHovered(i)}
                    onMouseLeave={() => !readOnly && setHovered(0)}
                    onClick={() => !readOnly && onChange?.(i)}
                />
            ))}
        </div>
    );
};
