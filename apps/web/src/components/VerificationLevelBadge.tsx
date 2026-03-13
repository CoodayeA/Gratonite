import { Shield, ShieldCheck, ShieldAlert, ShieldOff } from 'lucide-react';

const LEVEL_CONFIG: Record<number, { label: string; color: string; icon: typeof Shield }> = {
    0: { label: 'Unverified', color: 'var(--text-muted)', icon: ShieldOff },
    1: { label: 'Email Verified', color: 'var(--accent-primary)' , icon: Shield },
    2: { label: 'Phone Verified', color: 'var(--success)', icon: ShieldCheck },
    3: { label: 'ID Verified', color: '#f59e0b', icon: ShieldAlert },
};

interface Props {
    level: number;
    size?: number;
    showLabel?: boolean;
}

export default function VerificationLevelBadge({ level, size = 14, showLabel = false }: Props) {
    const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[0];
    const Icon = config.icon;

    return (
        <span
            title={`Verification Level ${level}: ${config.label}`}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '11px', color: config.color, fontWeight: 600,
            }}
        >
            <Icon size={size} />
            {showLabel && <span>{config.label}</span>}
        </span>
    );
}
