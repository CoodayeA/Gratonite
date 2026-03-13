import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of the input value.
 * The debounced value updates only after `delay` ms of inactivity.
 */
export function useDebounce<T>(value: T, delay = 300): T {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debouncedValue;
}
