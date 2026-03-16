/**
 * Skip Navigation Link (Feature 14: WCAG 2.1 AA Compliance).
 * Hidden by default, visible on focus — lets keyboard users skip past navigation.
 */
export default function SkipNav() {
    return (
        <a
            href="#main-content"
            style={{
                position: 'fixed',
                top: '-100px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '12px 24px',
                background: 'var(--accent-primary)',
                color: 'white',
                borderRadius: '0 0 8px 8px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                zIndex: 10000,
                transition: 'top 0.2s',
            }}
            onFocus={e => { e.currentTarget.style.top = '0'; }}
            onBlur={e => { e.currentTarget.style.top = '-100px'; }}
        >
            Skip to main content
        </a>
    );
}
