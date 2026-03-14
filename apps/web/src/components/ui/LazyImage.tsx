/**
 * LazyImage — Image component with IntersectionObserver-based lazy loading.
 *
 * Phase 9, Item 150: Image lazy loading with preloading.
 *
 * Features:
 * - Uses native loading="lazy" as baseline
 * - IntersectionObserver with rootMargin to preload images just before they scroll into view
 * - Blur-up placeholder effect while loading
 * - Graceful fallback if IntersectionObserver is unavailable
 */

import React, { useState, useRef, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Distance from viewport to start loading (default "200px") */
  preloadMargin?: string;
  /** Show a blur-up placeholder effect */
  blurPlaceholder?: boolean;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '',
  preloadMargin = '200px',
  blurPlaceholder = false,
  style,
  onLoad,
  ...rest
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    // If IntersectionObserver is not available, show immediately
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: preloadMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [preloadMargin]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoaded(true);
    onLoad?.(e as React.SyntheticEvent<HTMLImageElement, Event>);
  };

  const placeholderStyle: React.CSSProperties = blurPlaceholder && !isLoaded
    ? { filter: 'blur(10px)', transform: 'scale(1.05)', transition: 'filter 0.3s ease, transform 0.3s ease' }
    : { filter: 'none', transform: 'scale(1)', transition: 'filter 0.3s ease, transform 0.3s ease' };

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : undefined}
      alt={alt}
      loading="lazy"
      onLoad={handleLoad}
      style={{
        ...placeholderStyle,
        ...style,
      }}
      {...rest}
    />
  );
};

export default LazyImage;
