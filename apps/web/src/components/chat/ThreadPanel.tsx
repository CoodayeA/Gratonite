import { useState, useRef, useEffect } from 'react';
import { X, MessageSquare, Send, Smile, Plus, Paperclip } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';

type Message = {
    id: number;
    author: string;
    avatar: string | React.ReactNode;
    time: string;
    content: string;
    bgColor?: string;
    createdAt?: number;
};

interface ThreadPanelProps {
    originalMessage: Message | null;
    onClose: () => void;
}

const ThreadPanel = ({ originalMessage, onClose }: ThreadPanelProps) => {
    const [replies, setReplies] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<{name: string, size: string}[]>([]);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const EMOJI_LIST = ['😄','😂','❤️','🔥','👍','👎','😮','🎉','💀','🚀','✨','💯','👀','😢','🤔','😡'];

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        const newFiles = Array.from(files).map(f => ({ name: f.name, size: formatFileSize(f.size) }));
        setAttachedFiles(prev => [...prev, ...newFiles]);
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleEmojiClick = (emoji: string) => {
        setInputValue(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    // Use authenticated user from UserContext
    const { user: ctxUser } = useUser();
    const currentUserName = ctxUser.name || ctxUser.handle || 'You';

    const scrollToBottom = () => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [replies]);

    if (!originalMessage) return null;

    const handleSend = () => {
        if (inputValue.trim() === '' && attachedFiles.length === 0) return;
        const fileNote = attachedFiles.length > 0
            ? '\n📎 ' + attachedFiles.map(f => `${f.name} (${f.size})`).join(', ')
            : '';
        const now = Date.now();
        setReplies(prev => [...prev, {
            id: now,
            author: currentUserName,
            avatar: 'E',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: (inputValue + fileNote).trim(),
            createdAt: now,
        }]);
        setInputValue('');
        setAttachedFiles([]);
        setShowEmojiPicker(false);
    };

    return (
        <div className="thread-panel">
            <div className="thread-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={20} color="var(--text-muted)" />
                    <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Thread</h3>
                </div>
                <button onClick={onClose} className="message-action-btn" style={{ width: '28px', height: '28px' }}>
                    <X size={18} />
                </button>
            </div>

            <div className="thread-content">
                {/* Original Message */}
                <div className="message" style={{ padding: '16px', borderBottom: '1px solid var(--stroke)', background: 'rgba(0,0,0,0.2)' }}>
                    <div className="msg-avatar" style={originalMessage.bgColor ? { background: originalMessage.bgColor, color: 'white' } : {}}>
                        {originalMessage.avatar}
                    </div>
                    <div className="msg-content">
                        <div className="msg-header">
                            <span className="msg-author">{originalMessage.author}</span>
                            <span className="msg-timestamp">{originalMessage.time}</span>
                        </div>
                        <div className="msg-body">
                            {originalMessage.content}
                        </div>
                    </div>
                </div>

                <div style={{ padding: '16px 16px 8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {replies.length} Replies
                </div>

                {/* Replies */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {replies.map(reply => (
                        <div key={reply.id} className="message" style={{ padding: '8px 16px' }}>
                            <div className="msg-avatar" style={{ width: '30px', height: '30px', fontSize: '14px' }}>
                                {reply.avatar}
                            </div>
                            <div className="msg-content">
                                <div className="msg-header" style={{ fontSize: '13px' }}>
                                    <span className="msg-author">{reply.author}</span>
                                    <span className="msg-timestamp" title={reply.createdAt ? new Date(reply.createdAt).toLocaleString() : reply.time}>
                                        {reply.createdAt ? formatRelative(reply.createdAt) : reply.time}
                                    </span>
                                </div>
                                <div className="msg-body" style={{ fontSize: '13px' }}>
                                    {reply.content}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={endRef} />
                </div>
            </div>

            <div className="thread-input">
                {/* Emoji Picker */}
                {showEmojiPicker && (
                    <div className="thread-emoji-picker" style={{
                        position: 'absolute',
                        bottom: '100%',
                        right: '16px',
                        marginBottom: '8px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--stroke)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '8px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '4px',
                        zIndex: 100,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}>
                        {EMOJI_LIST.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleEmojiClick(emoji)}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '18px',
                                    background: 'transparent',
                                    border: 'none',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}

                {/* Attached Files Chips */}
                {attachedFiles.length > 0 && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginBottom: '8px',
                    }}>
                        {attachedFiles.map((file, index) => (
                            <div key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 8px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--stroke)',
                            }}>
                                <Paperclip size={12} />
                                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{file.size}</span>
                                <button
                                    onClick={() => removeFile(index)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        padding: '0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: 'var(--text-muted)',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />

                <div className="chat-input-wrapper" style={{ minHeight: '40px', padding: '0 8px' }}>
                    <button className="input-icon-btn" style={{ width: '28px', height: '28px' }} onClick={() => fileInputRef.current?.click()}>
                        <Plus size={16} />
                    </button>
                    <input
                        type="text"
                        className="chat-input"
                        placeholder="Reply in thread..."
                        style={{ fontSize: '13px' }}
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        className="input-icon-btn"
                        style={{ width: '28px', height: '28px', color: showEmojiPicker ? 'var(--accent-primary)' : undefined }}
                        onClick={() => setShowEmojiPicker(prev => !prev)}
                    >
                        <Smile size={16} />
                    </button>
                    <button
                        className={`input-icon-btn ${(inputValue.trim() || attachedFiles.length > 0) ? 'primary' : ''}`}
                        style={{ width: '28px', height: '28px', opacity: (inputValue.trim() || attachedFiles.length > 0) ? 1 : 0.5 }}
                        onClick={handleSend}
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

function formatRelative(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return new Date(timestamp).toLocaleDateString();
}

export default ThreadPanel;
