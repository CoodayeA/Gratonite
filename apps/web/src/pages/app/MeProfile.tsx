import { useOutletContext, useNavigate } from 'react-router-dom';
import { Settings, Bell, Bookmark, HelpCircle, Bug, LogOut } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import { api } from '../../lib/api';

type OutletContextType = {
    setActiveModal: (modal: string | null) => void;
    userProfile: { id: string; username: string; displayName: string; avatarHash?: string | null } | null;
};

const menuItems = [
    { icon: Settings, label: 'Settings', action: 'settings' },
    { icon: Bell, label: 'Notifications', action: 'notifications' },
    { icon: Bookmark, label: 'Saved Messages', route: '/saved-messages' },
    { icon: HelpCircle, label: 'Help Center', route: '/help-center' },
    { icon: Bug, label: 'Report Bug', action: 'bugReport' },
];

const MeProfile = () => {
    const { userProfile, setActiveModal } = useOutletContext<OutletContextType>();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await api.auth.logout();
        } catch { /* ignore */ }
        window.location.href = '/login';
    };

    return (
        <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 16px', width: '100%' }}>
                {/* Profile header */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
                    <Avatar
                        userId={userProfile?.id || ''}
                        avatarHash={userProfile?.avatarHash || null}
                        displayName={userProfile?.displayName || 'User'}
                        size={80}
                        status="online"
                    />
                    <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '12px 0 2px', fontFamily: 'var(--font-display)' }}>
                        {userProfile?.displayName || 'User'}
                    </h1>
                    <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                        @{userProfile?.username || 'user'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success, #22c55e)' }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Online</span>
                    </div>
                </div>

                {/* Menu rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {menuItems.map((item) => (
                        <button
                            key={item.label}
                            onClick={() => {
                                if (item.action) setActiveModal(item.action);
                                else if (item.route) navigate(item.route);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '14px',
                                padding: '14px 16px',
                                minHeight: '48px',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '15px',
                                cursor: 'pointer',
                                width: '100%',
                                textAlign: 'left',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                            className="hover-lift"
                        >
                            <item.icon size={20} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                            {item.label}
                        </button>
                    ))}

                    <div style={{ height: '1px', background: 'var(--stroke)', margin: '8px 0' }} />

                    <button
                        onClick={handleLogout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '14px 16px',
                            minHeight: '48px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'var(--error, #ef4444)',
                            fontSize: '15px',
                            cursor: 'pointer',
                            width: '100%',
                            textAlign: 'left',
                            WebkitTapHighlightColor: 'transparent',
                        }}
                        className="hover-lift"
                    >
                        <LogOut size={20} style={{ flexShrink: 0 }} />
                        Log Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MeProfile;
