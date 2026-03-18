import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Trash2, Check, X, AlertTriangle, MessageSquare, Flag } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';

interface MessageRequest {
    id: string;
    user: {
        id: string;
        username: string;
        displayName: string;
        avatarHash: string | null;
    };
    isSpam: boolean;
    preview: string;
    createdAt: string;
    mutualServers: number;
}

const MessageRequests = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'requests' | 'spam'>('requests');
    const [requests, setRequests] = useState<MessageRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = useCallback(async (bucket: 'requests' | 'spam' = 'requests') => {
        setLoading(true);
        try {
            const messageRequestList = await api.messageRequests.list(bucket);
            setRequests(Array.isArray(messageRequestList) ? messageRequestList : []);
        } catch {
            setRequests([]);
            addToast({ title: 'Failed to load message requests', variant: 'error' });
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchRequests(activeTab === 'spam' ? 'spam' : 'requests');
    }, [fetchRequests, activeTab]);

    const filteredRequests = requests.filter(r =>
        activeTab === 'spam' ? r.isSpam === true : r.isSpam !== true
    );

    const handleAccept = async (request: MessageRequest) => {
        try {
            await api.messageRequests.accept(request.user.id);
            setRequests(prev => prev.filter(r => r.id !== request.id));
            addToast({ title: 'Request Accepted', description: 'You can now message each other freely.', variant: 'success' });
            const dm = await api.relationships.openDm(request.user.id);
            navigate(`/dm/${dm.id}`);
        } catch {
            addToast({ title: 'Failed to accept request', variant: 'error' });
        }
    };

    const handleIgnore = async (request: MessageRequest) => {
        try {
            await api.messageRequests.ignore(request.user.id);
            setRequests(prev => prev.filter(r => r.id !== request.id));
            addToast({ title: 'Request Ignored', description: 'This message request has been dismissed.', variant: 'info' });
        } catch {
            addToast({ title: 'Failed to ignore request', variant: 'error' });
        }
    };

    const handleReport = async (request: MessageRequest) => {
        try {
            await api.messageRequests.report(request.user.id);
            setRequests(prev => prev.filter(r => r.id !== request.id));
            addToast({ title: 'User Reported', description: 'Thank you for helping keep Gratonite safe.', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to report', variant: 'error' });
        }
    };

    const spamCount = requests.filter(r => r.isSpam).length;
    const requestCount = requests.filter(r => !r.isSpam).length;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--stroke)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexShrink: 0,
            }}>
                <ShieldAlert size={22} style={{ color: 'var(--accent-primary)' }} />
                <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>Message Requests</h2>
            </div>

            {/* Tabs */}
            <div style={{
                display: 'flex',
                gap: '4px',
                padding: '12px 24px',
                borderBottom: '1px solid var(--stroke)',
                flexShrink: 0,
            }}>
                <button
                    onClick={() => setActiveTab('requests')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        background: activeTab === 'requests' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: activeTab === 'requests' ? 'white' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                    }}
                >
                    <MessageSquare size={14} />
                    Requests
                    {requestCount > 0 && (
                        <span style={{
                            background: activeTab === 'requests' ? 'rgba(255,255,255,0.25)' : 'var(--accent-primary)',
                            color: 'white',
                            borderRadius: '10px',
                            padding: '1px 6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            minWidth: '18px',
                            textAlign: 'center',
                        }}>{requestCount}</span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('spam')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500,
                        background: activeTab === 'spam' ? 'var(--error)' : 'var(--bg-tertiary)',
                        color: activeTab === 'spam' ? 'white' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                    }}
                >
                    <AlertTriangle size={14} />
                    Spam
                    {spamCount > 0 && (
                        <span style={{
                            background: activeTab === 'spam' ? 'rgba(255,255,255,0.25)' : 'var(--error)',
                            color: 'white',
                            borderRadius: '10px',
                            padding: '1px 6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            minWidth: '18px',
                            textAlign: 'center',
                        }}>{spamCount}</span>
                    )}
                </button>
            </div>

            {/* Info banner */}
            <div style={{
                margin: '16px 24px 0',
                padding: '12px 16px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--stroke)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                flexShrink: 0,
            }}>
                <ShieldAlert size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {activeTab === 'requests'
                        ? 'These are DMs from people you may not know. You can view their profile to check for mutual servers before accepting. Ignored requests cannot be retrieved, but the sender can try again based on your settings.'
                        : 'Messages flagged as potential spam are moved here. Review carefully before accepting. You can report suspicious accounts to help keep Gratonite safe.'}
                </span>
            </div>

            {/* Request list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                        Loading...
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'var(--bg-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            {activeTab === 'spam'
                                ? <AlertTriangle size={32} style={{ color: 'var(--text-muted)' }} />
                                : <MessageSquare size={32} style={{ color: 'var(--text-muted)' }} />
                            }
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
                            {activeTab === 'spam' ? 'No Spam' : 'No Message Requests'}
                        </h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto', lineHeight: '1.5' }}>
                            {activeTab === 'spam'
                                ? "You're all clear! No messages have been flagged as spam."
                                : "You don't have any pending message requests right now."}
                        </p>
                    </div>
                ) : (
                    filteredRequests.map(request => {
                        const displayName = request.user.displayName || request.user.username || 'Unknown User';
                        const username = request.user.username || 'unknown';

                        return (
                            <div
                                key={request.id}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '12px 16px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px solid var(--stroke)',
                                    marginBottom: '8px',
                                    transition: 'background 0.15s ease',
                                }}
                                className="hover-bg-tertiary-to-elevated"
                            >
                                {/* Avatar */}
                                <Avatar
                                    userId={request.user.id}
                                    avatarHash={request.user.avatarHash}
                                    displayName={displayName}
                                    size={40}
                                />

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{displayName}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{username}</span>
                                        {request.isSpam && (
                                            <span style={{
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                color: 'var(--error)',
                                                background: 'rgba(var(--error-rgb, 239, 68, 68), 0.15)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                textTransform: 'uppercase',
                                            }}>Spam</span>
                                        )}
                                    </div>
                                    <p style={{
                                        fontSize: '13px',
                                        color: 'var(--text-secondary)',
                                        margin: '2px 0 0',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {request.preview || 'Sent you a message'}
                                    </p>
                                    {(request.mutualServers ?? 0) > 0 && (
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'inline-block' }}>
                                            {request.mutualServers} mutual server{request.mutualServers !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    <button
                                        onClick={() => handleAccept(request)}
                                        title="Accept"
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            background: 'var(--success, #22c55e)',
                                            color: 'white',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'opacity 0.15s',
                                        }}
                                        className="hover-opacity-80"
                                    >
                                        <Check size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleIgnore(request)}
                                        title="Ignore"
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            border: 'none',
                                            background: 'var(--bg-elevated)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'opacity 0.15s',
                                        }}
                                        className="hover-opacity-80"
                                    >
                                        <X size={18} />
                                    </button>
                                    {request.isSpam && (
                                        <button
                                            onClick={() => handleReport(request)}
                                            title="Report"
                                            style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                border: 'none',
                                                background: 'var(--error)',
                                                color: 'white',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'opacity 0.15s',
                                            }}
                                            className="hover-opacity-80"
                                        >
                                            <Flag size={16} />
                                        </button>
                                    )}
                                    {!request.isSpam && (
                                        <button
                                            onClick={() => {
                                                setRequests(prev => prev.map(r => r.id === request.id ? { ...r, isSpam: true } : r));
                                                addToast({ title: 'Moved to Spam', variant: 'info' });
                                            }}
                                            title="Mark as Spam"
                                            style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                border: 'none',
                                                background: 'var(--bg-elevated)',
                                                color: 'var(--text-muted)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'opacity 0.15s',
                                            }}
                                            className="hover-opacity-80"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default MessageRequests;
