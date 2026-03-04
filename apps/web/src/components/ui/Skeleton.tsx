import React from 'react';

type SkeletonProps = {
    variant?: 'text' | 'rect' | 'circle' | 'card';
    width?: string | number;
    height?: string | number;
    className?: string;
    style?: React.CSSProperties;
    animated?: boolean;
};

const Skeleton = ({
    variant = 'rect',
    width,
    height,
    className = '',
    style = {},
    animated = true,
}: SkeletonProps) => {
    let baseStyle: React.CSSProperties = { ...style };

    if (width) baseStyle.width = width;
    if (height) baseStyle.height = height;

    let variantClasses = 'skeleton-box';
    switch (variant) {
        case 'text':
            baseStyle.height = height || '1em';
            baseStyle.borderRadius = '4px';
            break;
        case 'circle':
            baseStyle.borderRadius = '50%';
            break;
        case 'card':
            baseStyle.borderRadius = 'var(--radius-lg)';
            break;
        case 'rect':
        default:
            baseStyle.borderRadius = 'var(--radius-md)';
            break;
    }

    if (!animated) {
        // override animation if false
        baseStyle.animation = 'none';
        baseStyle.background = 'rgba(255, 255, 255, 0.05)';
    }

    return (
        <div
            className={`${variantClasses} ${className}`}
            style={baseStyle}
            aria-busy="true"
            aria-hidden="true"
        />
    );
};

export default Skeleton;
