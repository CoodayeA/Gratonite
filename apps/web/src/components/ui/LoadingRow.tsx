import { Loader2 } from 'lucide-react';

type LoadingRowProps = {
    label?: string;
    padding?: string | number;
    size?: number;
    inline?: boolean;
};

const LoadingRow = ({ label = 'Loading…', padding = '32px 16px', size = 18, inline = false }: LoadingRowProps) => (
    <div
        role="status"
        aria-live="polite"
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: inline ? 0 : padding,
            color: 'var(--text-muted)',
            fontSize: '13px',
        }}
    >
        <Loader2 size={size} style={{ animation: 'spin 1s linear infinite' }} aria-hidden="true" />
        <span>{label}</span>
    </div>
);

export default LoadingRow;
