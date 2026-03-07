import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import {
    Send, Smile, Image as ImageIcon, Reply, X, Play, Hash, Menu,
    Volume2, Trash2, Copy, Pin, Sparkles, Share2, Link2, FileText, Download,
    Pause, MessageSquare, MoreHorizontal, Square, Plus, Mic, BarChart2, Clock, Users,
    ThumbsUp, Star, Flag, Edit2, Search, ChevronUp, ChevronDown
} from 'lucide-react';
import Skeleton from '../../components/ui/Skeleton';
import { SkeletonMessageList } from '../../components/ui/SkeletonLoader';
import { ErrorState } from '../../components/ui/ErrorState';
import { useContextMenu } from '../../components/ui/ContextMenu';
import { useToast } from '../../components/ui/ToastManager';
import { TopBarActions } from '../../components/ui/TopBarActions';
import { BackgroundMedia } from '../../components/ui/BackgroundMedia';
import UserProfilePopover from '../../components/ui/UserProfilePopover';
import { playSound } from '../../utils/SoundManager';
import { api, API_BASE } from '../../lib/api';
import { markRead } from '../../store/unreadStore';
import { getSocket, joinChannel as socketJoinChannel, leaveChannel as socketLeaveChannel } from '../../lib/socket';
import { onTypingStart, onMessageCreate, onMessageUpdate, onMessageDelete, onMessageDeleteBulk, onReactionAdd, onReactionRemove, onChannelPinsUpdate, onSocketReconnect, onChannelBackgroundUpdated, type TypingStartPayload, type MessageCreatePayload, type MessageUpdatePayload, type MessageDeletePayload, type MessageDeleteBulkPayload, type ReactionPayload, type ChannelPinsUpdatePayload } from '../../lib/socket';
import Avatar from '../../components/ui/Avatar';

type MediaType = 'image' | 'video';

type OutletContextType = {
    bgMedia: { url: string, type: MediaType } | null;
    hasCustomBg: boolean;
    setBgMedia: (media: { url: string, type: MediaType } | null) => void;
    setActiveModal: (modal: 'settings' | 'userProfile' | 'createGuild' | null) => void;
    toggleGuildRail: () => void;
    toggleSidebar: () => void;
    userProfile?: {
        id?: string;
        avatarFrame?: 'none' | 'neon' | 'gold' | 'glass' | 'rainbow' | 'pulse';
        nameplateStyle?: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch';
    };
};

type Attachment = {
    id: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
};

type Message = {
    id: number;
    apiId?: string; // original UUID from backend for updates/deletes
    authorId?: string;
    author: string;
    system: boolean;
    avatar: React.ReactNode | string;
    time: string;
    content: string;
    edited?: boolean;
    reactions?: Array<{ emoji: string; count: number; me: boolean }>;
    type?: 'text' | 'voice' | 'poll' | 'media';
    mediaUrl?: string;
    mediaAspectRatio?: number;
    duration?: string;
    isTyping?: boolean;
    pollData?: {
        pollId?: string;
        question: string;
        options: { id: string; text: string; votes: number; }[];
        totalVotes: number;
        multipleChoice?: boolean;
        myVotes?: string[];
    };
    forwarded?: boolean;
    forwardedFrom?: string;
    replyToId?: string;
    replyToAuthor?: string;
    replyToContent?: string;
    threadReplyCount?: number;
    attachments?: Attachment[];
    authorRoleColor?: string;
    authorAvatarHash?: string | null;
    authorNameplateStyle?: string | null;
    embeds?: Array<{ url: string; title?: string; description?: string; image?: string; siteName?: string }>;
    expiresAt?: string | null;
    createdAt?: string | null;
};

import { EmbedCard, OgEmbed } from '../../components/chat/EmbedCard';
import ThreadPanel from '../../components/chat/ThreadPanel';
import SoundboardMenu from '../../components/chat/SoundboardMenu';
import { playSynthSound } from '../../lib/soundSynth';
import EmojiPicker from '../../components/chat/EmojiPicker';
import ChatPoll from '../../components/chat/ChatPoll';
import { EmptyState } from '../../components/ui/EmptyState';
import { RichTextRenderer } from '../../components/chat/RichTextRenderer';
import { Tooltip } from '../../components/ui/Tooltip';
import ForwardModal from '../../components/modals/ForwardModal';
import { MemberListPanel } from '../../components/guild/MemberListPanel';

const ReactionBadge = ({ emoji, count, me, messageApiId, channelId, onReaction }: { emoji: string; count: number; me: boolean; messageApiId?: string; channelId?: string; onReaction?: (apiId: string, emoji: string, me: boolean) => void }) => {
    const [tooltip, setTooltip] = useState<{ users: Array<{ displayName?: string; username: string }>; total: number } | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        if (!messageApiId || !channelId) return;
        timerRef.current = setTimeout(() => {
            fetch(`${API_BASE}/api/v1/channels/${channelId}/messages/${messageApiId}/reactions/${encodeURIComponent(emoji)}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
            }).then(r => r.ok ? r.json() : []).then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setTooltip({ users: data.slice(0, 5), total: count });
                }
            }).catch(() => {});
        }, 300);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setTooltip(null);
    };

    return (
        <button
            onClick={() => onReaction?.(messageApiId!, emoji, me)}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: me ? 'rgba(var(--accent-primary-rgb, 139,92,246), 0.15)' : 'var(--bg-tertiary)', border: `1px solid ${me ? 'var(--accent-primary)' : 'var(--stroke)'}`, cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'all 0.15s', position: 'relative' }}
        >
            <span>{emoji}</span> <span style={{ fontSize: '11px', fontWeight: 600 }}>{count}</span>
            {tooltip && (
                <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 50, whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-primary)', pointerEvents: 'none' }}>
                    {tooltip.users.map((u, i) => (
                        <span key={i}>{u.displayName || u.username}{i < tooltip.users.length - 1 ? ', ' : ''}</span>
                    ))}
                    {tooltip.total > 5 && <span style={{ color: 'var(--text-muted)' }}> and {tooltip.total - 5} more</span>}
                </div>
            )}
        </button>
    );
};

const MemoizedMessageItem = memo(({
    msg,
    prevMsg,
    highlightedMessageId,
    playingMessageId,
    setPlayingMessageId,
    handleMessageContext,
    setActiveThreadMessage,
    activeThreadMessageId,
    isHypeMode,
    onImageClick,
    onReply,
    onProfileClick,
    onForward,
    onReaction,
    channelId: msgChannelId,
    customEmojis,
    members,
    channels,
    currentUserId,
    currentUserAvatarFrame,
    currentUserNameplateStyle,
    guildId,
    addToast,
}: any) => {
    const [isHovered, setIsHovered] = useState(false);
    const [famGiven, setFamGiven] = useState(false);
    const [showFameSparkle, setShowFameSparkle] = useState(false);
    const [fameLoading, setFameLoading] = useState(false);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const reactionPickerRef = useRef<HTMLDivElement>(null);
    const avatarRef = useRef<HTMLDivElement>(null);

    // Close reaction picker on click-outside
    useEffect(() => {
        if (!showReactionPicker) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
                setShowReactionPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showReactionPicker]);

    const quickReactions = ['👍', '❤️', '😂', '🔥', '👀', '🎉', '😮', '💯'];
    // Use reactions from message props (persisted via API), fall back to empty
    const reactions: Array<{ emoji: string; count: number; me: boolean }> = msg.reactions || [];

    const handleGiveFAME = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (msg.system || !msg.authorId || fameLoading) return;
        if (famGiven) return;
        if (msg.authorId === currentUserId) return;
        setFameLoading(true);
        try {
            await api.fame.give(msg.authorId, { messageId: msg.apiId, guildId: guildId || '' });
            setFamGiven(true);
            setShowFameSparkle(true);
            setTimeout(() => setShowFameSparkle(false), 1400);
        } catch (err: any) {
            const errMsg = err?.message || 'Failed to give FAME';
            addToast?.({ title: errMsg, variant: 'error' });
        } finally {
            setFameLoading(false);
        }
    };

    const isGrouped = prevMsg &&
        !msg.system && !prevMsg.system &&
        prevMsg.author === msg.author &&
        (Math.abs(msg.id - prevMsg.id) < 5 * 60 * 1000 || msg.time === prevMsg.time);

    const showNewMessageDivider = false; // Divider shown dynamically via unread tracking

    // Check if message is newly added (runtime messages use Date.now() IDs)
    const isNew = msg.id > 100000 && (Date.now() - msg.id < 5000);
    const isCurrentUserMessage = Boolean(msg.authorId && currentUserId && msg.authorId === currentUserId);

    return (
        <React.Fragment>
            {showNewMessageDivider && (
                <div style={{
                    display: 'flex', alignItems: 'center', margin: '24px 0', opacity: 0.8
                }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--error)' }}></div>
                    <div style={{
                        background: 'var(--error)', color: 'white', padding: '2px 8px',
                        borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: '8px', marginRight: '8px'
                    }}>
                        New Messages
                    </div>
                    <div style={{ flex: 1, height: '1px', background: 'var(--error)' }}></div>
                </div>
            )}
            <motion.div
                layout
                initial={isNew ? { opacity: 0, y: 20, scale: 0.98 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`message ${isGrouped ? 'grouped' : ''} ${highlightedMessageId === msg.id ? 'highlighted-message' : ''} ${activeThreadMessageId === msg.id ? 'active-thread-message' : ''}`}
                data-message-id={msg.apiId}
                style={{ position: 'relative', marginTop: isGrouped ? '2px' : '16px', paddingTop: isGrouped ? '2px' : '16px', paddingBottom: isGrouped ? '2px' : '16px' }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onContextMenu={(e) => handleMessageContext(e, msg)}
            >
                {isGrouped ? (
                    <div style={{ width: '40px', flexShrink: 0, position: 'relative' }}>
                        <span style={{
                            position: 'absolute', right: '0', top: '2px',
                            fontSize: '10px', color: 'var(--text-muted)',
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.2s'
                        }}>
                            {msg.time.split(' ')[0]}
                        </span>
                    </div>
                ) : (
                    <div style={{ position: 'relative', flexShrink: 0 }} ref={avatarRef}>
                        {typeof msg.avatar === 'string' ? (
                            <Avatar
                                userId={msg.authorId || String(msg.id)}
                                displayName={msg.author}
                                avatarHash={msg.authorAvatarHash}
                                frame={isCurrentUserMessage ? currentUserAvatarFrame : 'none'}
                                size={40}
                                style={{
                                    boxShadow: showFameSparkle ? '0 0 0 3px #f59e0b, 0 0 20px rgba(245,158,11,0.6)' : undefined,
                                    transition: 'box-shadow 0.3s',
                                }}
                            />
                        ) : (
                            <div className={`msg-avatar system ${isHypeMode ? 'hype-pulse' : ''}`}>
                                {msg.avatar}
                            </div>
                        )}
                        {/* FAME sparkle toast */}
                        {showFameSparkle && (
                            <div className="fame-toast">⭐ +FAME</div>
                        )}
                        {famGiven && (
                            <div style={{
                                position: 'absolute', bottom: '-2px', right: '-4px',
                                background: '#f59e0b', borderRadius: '50%',
                                width: '16px', height: '16px', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                border: '2px solid var(--bg-primary)'
                            }}>
                                <Star size={8} color="#111" fill="#111" />
                            </div>
                        )}
                    </div>
                )}

                <div className="msg-content">
                    {!isGrouped && (
                        <div className="msg-header">
                            <span
                                className={`msg-author ${msg.system ? 'system' : ''} ${msg.authorNameplateStyle && msg.authorNameplateStyle !== 'none' ? `nameplate-${msg.authorNameplateStyle}` : (isCurrentUserMessage && currentUserNameplateStyle && currentUserNameplateStyle !== 'none' ? `nameplate-${currentUserNameplateStyle}` : '')}`}
                                onClick={(e) => { if (!msg.system) onProfileClick?.({ user: msg.author, userId: msg.authorId || '', x: e.clientX, y: e.clientY }); }}
                                style={{ cursor: msg.system ? 'default' : 'pointer', color: msg.authorRoleColor || undefined }}
                            >
                                {msg.author}
                            </span>
                            <span className="msg-timestamp">{msg.time}</span>
                        </div>
                    )}
                    {/* Inline Reply Reference */}
                    {msg.replyToId && msg.replyToAuthor && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            fontSize: '11px', marginBottom: '4px',
                            paddingLeft: '8px', paddingRight: '8px',
                            paddingTop: '3px', paddingBottom: '3px',
                            background: 'rgba(255,255,255,0.03)',
                            borderLeft: '2px solid var(--accent-primary)',
                            borderRadius: '0 4px 4px 0',
                            cursor: 'pointer',
                            maxWidth: '100%', overflow: 'hidden',
                        }} onClick={() => {
                            const el = document.querySelector(`[data-message-id="${msg.replyToId}"]`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}>
                            <Reply size={11} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: 'var(--accent-primary)', flexShrink: 0, fontSize: '11px' }}>
                                {msg.replyToAuthor}
                            </span>
                            <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap', flex: 1, color: 'var(--text-muted)', fontSize: '11px',
                            }}>
                                {msg.replyToContent || '— click to view'}
                            </span>
                        </div>
                    )}
                    <div className="msg-body">
                        {msg.forwarded && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontStyle: 'italic' }}>
                                <Share2 size={12} />
                                <span>Forwarded{msg.forwardedFrom ? ` from ${msg.forwardedFrom}` : ''}</span>
                            </div>
                        )}
                        {msg.type === 'voice' ? (
                            msg.attachments?.[0]?.url
                                ? <VoicePlayer url={msg.attachments[0].url} duration={msg.duration} />
                                : <div style={{ background: 'var(--bg-tertiary)', padding: '8px 16px', borderRadius: '24px', display: 'inline-flex', alignItems: 'center', gap: '12px', marginTop: '4px', border: '1px solid var(--stroke)', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    <Mic size={16} />
                                    <span>Voice message unavailable</span>
                                  </div>
                        ) : msg.type === 'poll' && msg.pollData ? (
                            <ChatPoll
                                pollId={msg.pollData.pollId}
                                question={msg.pollData.question}
                                options={msg.pollData.options}
                                totalVotes={msg.pollData.totalVotes}
                                multipleChoice={msg.pollData.multipleChoice}
                                myVotes={msg.pollData.myVotes}
                            />
                        ) : msg.type === 'media' && msg.mediaUrl ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {msg.content && (
                                    <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                                        <RichTextRenderer content={msg.content} customEmojis={customEmojis} members={members} channels={channels} />
                                    </div>
                                )}
                                <div className="chat-media-attachment" onClick={() => onImageClick && onImageClick(msg.mediaUrl)} style={{
                                    width: '100%',
                                    maxWidth: '400px',
                                    aspectRatio: msg.mediaAspectRatio ? `${msg.mediaAspectRatio}` : '16/9',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: '1px solid var(--stroke)',
                                    cursor: 'pointer'
                                }}>
                                    <img src={msg.mediaUrl} alt="Attached Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            </div>
                        ) : (
                            <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.5', willChange: 'transform, opacity' }}>
                                <RichTextRenderer content={msg.content} customEmojis={customEmojis} members={members} channels={channels} />
                                {msg.edited && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>(edited)</span>}
                            </div>
                        )}
                        {/* Attachment rendering */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                {msg.attachments.map((att: Attachment) => {
                                    const isImage = att.mimeType?.startsWith('image/');
                                    const isVideo = att.mimeType?.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(att.filename);
                                    const isAudio = att.mimeType?.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac)$/i.test(att.filename);
                                    const isSticker = (att as any).type === 'sticker';
                                    if (isSticker) {
                                        return (
                                            <img key={att.id} src={att.url} alt={att.filename} style={{ width: '160px', height: '160px', objectFit: 'contain' }} />
                                        );
                                    }
                                    if (isImage) {
                                        return (
                                            <div key={att.id} className="chat-media-attachment" onClick={() => onImageClick?.(att.url)} style={{
                                                maxWidth: '400px', borderRadius: '8px', overflow: 'hidden',
                                                border: '1px solid var(--stroke)', cursor: 'pointer',
                                                background: 'var(--bg-tertiary)',
                                            }}>
                                                <img src={att.url} alt={att.filename} style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '350px' }} />
                                            </div>
                                        );
                                    }
                                    if (isVideo) {
                                        return (
                                            <video key={att.id} controls preload="metadata" src={att.url} style={{ maxWidth: '400px', borderRadius: '8px', display: 'block' }} />
                                        );
                                    }
                                    if (isAudio) {
                                        return (
                                            <audio key={att.id} controls src={att.url} style={{ width: '100%', maxWidth: '400px' }} />
                                        );
                                    }
                                    const sizeStr = att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${(att.size / 1024).toFixed(1)} KB` : `${(att.size / 1048576).toFixed(1)} MB`;
                                    return (
                                        <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" style={{
                                            display: 'flex', alignItems: 'center', gap: '10px',
                                            padding: '10px 14px', background: 'var(--bg-tertiary)',
                                            border: '1px solid var(--stroke)', borderRadius: '8px',
                                            textDecoration: 'none', color: 'var(--text-primary)',
                                            maxWidth: '320px', cursor: 'pointer',
                                            transition: 'background 0.15s',
                                        }}>
                                            <FileText size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent-primary)' }}>
                                                    {att.filename}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sizeStr}</div>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        )}
                        {/* URL Embeds */}
                        {msg.embeds && msg.embeds.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                {msg.embeds.map((embed: OgEmbed, i: number) => <EmbedCard key={i} embed={embed} />)}
                            </div>
                        )}
                        {/* Reaction badges */}
                        {reactions.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {reactions.map((r: any) => (
                                    <ReactionBadge key={r.emoji} emoji={r.emoji} count={r.count} me={r.me} messageApiId={msg.apiId} channelId={msgChannelId} onReaction={onReaction} />
                                ))}
                            </div>
                        )}
                        {/* Thread reply count */}
                        {(msg.threadReplyCount ?? 0) > 0 && (
                            <div
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                    marginTop: '4px', cursor: 'pointer', color: 'var(--accent-primary)',
                                    fontSize: '12px', fontWeight: 600,
                                }}
                                onClick={() => setActiveThreadMessage?.(msg)}
                            >
                                <MessageSquare size={12} />
                                {msg.threadReplyCount} {msg.threadReplyCount === 1 ? 'reply' : 'replies'}
                            </div>
                        )}
                    </div>
                </div>
                {/* Reaction Picker Popup */}
                {showReactionPicker && (
                    <div ref={reactionPickerRef} style={{ position: 'absolute', top: '-44px', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '20px', padding: '4px 8px', display: 'flex', gap: '2px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 20 }}>
                        {quickReactions.map(emoji => (
                            <button key={emoji} onClick={() => { onReaction?.(msg.apiId, emoji, false); setShowReactionPicker(false); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px 6px', borderRadius: '8px', transition: 'all 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
                {/* Interactive Message Toolbar */}
                {isHovered && (
                    <div style={{
                        position: 'absolute', top: isGrouped ? '-16px' : '-12px', right: '16px',
                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                        borderRadius: 'var(--radius-sm)', padding: '4px',
                        display: 'flex', gap: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        zIndex: 10
                    }}>
                        <Tooltip content="Add Reaction" position="top">
                            <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); setShowReactionPicker(!showReactionPicker); }}>
                                <Smile size={16} />
                            </button>
                        </Tooltip>
                        <Tooltip content="Reply" position="top">
                            <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); onReply?.({ id: msg.id, apiId: msg.apiId, author: msg.author, content: (msg.content || '').slice(0, 80) }); }}>
                                <Reply size={16} />
                            </button>
                        </Tooltip>
                        {!msg.system && (
                            <Tooltip content={famGiven ? 'FAME Given!' : 'Give FAME (+200 Gratonite)'} position="top">
                                <button
                                    className="message-action-btn"
                                    onClick={handleGiveFAME}
                                    style={{
                                        color: famGiven ? '#f59e0b' : undefined,
                                        background: famGiven ? 'rgba(245,158,11,0.15)' : undefined
                                    }}
                                >
                                    <ThumbsUp size={16} fill={famGiven ? '#f59e0b' : 'none'} />
                                </button>
                            </Tooltip>
                        )}
                        <Tooltip content="Create Thread" position="top">
                            <button className="message-action-btn" onClick={() => setActiveThreadMessage(msg)}>
                                <MessageSquare size={16} />
                            </button>
                        </Tooltip>
                        <Tooltip content="Forward" position="top">
                            <button className="message-action-btn" onClick={(e) => { e.stopPropagation(); onForward?.(msg); }}>
                                <Share2 size={16} />
                            </button>
                        </Tooltip>
                        <Tooltip content="More" position="top">
                            <button className="message-action-btn" onClick={(e) => handleMessageContext(e, msg)}>
                                <MoreHorizontal size={16} />
                            </button>
                        </Tooltip>
                    </div>
                )}
            </motion.div>
        </React.Fragment>
    );
});

// ── Emoji Rain (Hype Mode) ──────────────────────────────────────────────────
const HYPE_EMOJIS = ['🔥', '⚡', '💥', '🌟', '✨', '🎉', '🎊', '💫', '🚀', '🎯', '💯', '👑'];

const EmojiRain = ({ active }: { active: boolean }) => {
    const [particles, setParticles] = React.useState<{ id: number; emoji: string; left: number; dur: number; delay: number; size: number }[]>([]);
    const counter = React.useRef(0);

    React.useEffect(() => {
        if (!active) { setParticles([]); return; }
        const interval = setInterval(() => {
            setParticles(prev => {
                const id = ++counter.current;
                const next = [...prev.slice(-30), {
                    id,
                    emoji: HYPE_EMOJIS[Math.floor(Math.random() * HYPE_EMOJIS.length)],
                    left: Math.random() * 98,
                    dur: 2.5 + Math.random() * 2,
                    delay: 0,
                    size: 18 + Math.random() * 20,
                }];
                return next;
            });
        }, 120);
        return () => clearInterval(interval);
    }, [active]);

    if (!active || particles.length === 0) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 8000, overflow: 'hidden' }}>
            {particles.map(p => (
                <span
                    key={p.id}
                    className="emoji-rain-particle"
                    style={{
                        left: `${p.left}%`,
                        fontSize: `${p.size}px`,
                        animationDuration: `${p.dur}s`,
                    }}
                >
                    {p.emoji}
                </span>
            ))}
        </div>
    );
};

// Stable waveform bar heights — deterministic so they don't jump on re-render
const WAVEFORM_HEIGHTS = [6, 14, 10, 18, 8, 16, 12, 20, 7, 15, 11, 17, 9, 13, 6];

function VoicePlayer({ url, duration }: { url: string; duration?: string }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [elapsed, setElapsed] = useState('0:00');

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
            audio.pause();
            setPlaying(false);
        } else {
            audio.play().catch(() => {});
            setPlaying(true);
        }
    };

    return (
        <div style={{ background: 'var(--bg-tertiary)', padding: '8px 16px', borderRadius: '24px', display: 'inline-flex', alignItems: 'center', gap: '12px', marginTop: '4px', border: '1px solid var(--stroke)' }}>
            <button
                onClick={toggle}
                style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
                {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '20px', opacity: playing ? 1 : 0.7 }}>
                {WAVEFORM_HEIGHTS.map((h, i) => (
                    <div key={i} style={{ width: '3px', height: `${h}px`, background: playing ? 'var(--accent-primary)' : 'var(--text-primary)', borderRadius: '2px', transition: 'background 0.2s' }} />
                ))}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', minWidth: '32px' }}>
                {playing ? elapsed : (duration || '0:00')}
            </span>
            <audio
                ref={audioRef}
                src={url}
                onTimeUpdate={() => {
                    const audio = audioRef.current;
                    if (audio) {
                        const s = Math.floor(audio.currentTime);
                        setElapsed(`${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`);
                    }
                }}
                onEnded={() => { setPlaying(false); setElapsed('0:00'); }}
            />
        </div>
    );
}

const ChannelChat = () => {
    const { bgMedia, hasCustomBg, setBgMedia, toggleGuildRail, toggleSidebar, userProfile } = useOutletContext<OutletContextType>();
    const { channelId, guildId } = useParams<{ channelId: string; guildId: string }>();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [replyingTo, setReplyingTo] = useState<{ id: number; apiId?: string; author: string; content: string } | null>(null);
    const [editingMessage, setEditingMessage] = useState<{ id: number; apiId: string; content: string } | null>(null);
    const [editContent, setEditContent] = useState('');
    const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);

    // Forward Modal State
    const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);

    // Image Lightbox State
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

    // Member List Panel State
    const [memberListOpen, setMemberListOpen] = useState(() => localStorage.getItem('memberListOpen') !== 'false');

    // Chat File Attachment State
    const chatFileInputRef = useRef<HTMLInputElement>(null);
    const [chatAttachedFiles, setChatAttachedFiles] = useState<{name: string, size: string, file: File}[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);

    // Voice Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [voiceExpiry, setVoiceExpiry] = useState<number | null>(null); // seconds; null = never

    // Voice Playback State
    const [playingMessageId, setPlayingMessageId] = useState<number | null>(null);

    // Highlighted Message State
    const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);

    // Soundboard State
    const [soundboardOpen, setSoundboardOpen] = useState(false);

    // Channel management permission state (admin/moderator only can set themes)
    const [canManageChannel, setCanManageChannel] = useState(false);

    // Mentions State
    const [mentionSearch, setMentionSearch] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);

    // Channel autocomplete state
    const [channelSearch, setChannelSearch] = useState<string | null>(null);
    const [channelIndex, setChannelIndex] = useState(0);
    const [guildChannelsList, setGuildChannelsList] = useState<{ id: string; name: string; type?: string }[]>([]);

    // Slash command picker state
    const [slashSearch, setSlashSearch] = useState<string | null>(null);
    const [slashIndex, setSlashIndex] = useState(0);
    const [guildCommands, setGuildCommands] = useState<Array<{ id: string; name: string; description: string; options?: any[] }>>([]);

    const [isScheduleOpen, setIsScheduleOpen] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');
    const [scheduledMessages, setScheduledMessages] = useState<Array<{ id: string; content: string; scheduledAt: string }>>([]);

    // Draft state
    const [hasDraft, setHasDraft] = useState(false);
    const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [showPollCreator, setShowPollCreator] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [pollDuration, setPollDuration] = useState<number | null>(null); // minutes; null = no expiry
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [emojiSearch, setEmojiSearch] = useState<string | null>(null);
    const [emojiIndex, setEmojiIndex] = useState(0);

    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [messagesError, setMessagesError] = useState(false);
    const [profilePopover, setProfilePopover] = useState<{ user: string; userId: string; x: number; y: number } | null>(null);

    // Guild custom emojis for rendering :emojiName: in messages
    const [guildCustomEmojis, setGuildCustomEmojis] = useState<Array<{ name: string; url: string }>>([]);

    // Ctrl+F Search State
    const [showSearchBar, setShowSearchBar] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ id: string; authorId: string; content: string; createdAt: string; highlight: string }>>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ambient / Hype state
    const [roomVelocity, setRoomVelocity] = useState(0);
    const isHypeMode = roomVelocity >= 5;

    // Bulk message selection state
    const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);

    const { openMenu } = useContextMenu();
    const { addToast } = useToast();
    const [currentUserName, setCurrentUserName] = useState('');
    const [currentUserId, setCurrentUserId] = useState('');
    const [channelName, setChannelName] = useState('general');
    const [rateLimitPerUser, setRateLimitPerUser] = useState(0);
    const [lastSentAt, setLastSentAt] = useState<number | null>(null);
    const [slowRemaining, setSlowRemaining] = useState(0);

    // Slowmode countdown timer
    useEffect(() => {
        if (!lastSentAt || !rateLimitPerUser) return;
        const tick = () => {
            const remaining = Math.max(0, rateLimitPerUser - Math.floor((Date.now() - lastSentAt) / 1000));
            setSlowRemaining(remaining);
            if (remaining === 0) clearInterval(interval);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [lastSentAt, rateLimitPerUser]);

    // Typing indicator state: map of userId -> username, with auto-expiry
    const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
    const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const lastTypingSentRef = useRef(0);

    // Fetch current user info
    useEffect(() => {
        api.users.getMe().then(me => {
            setCurrentUserName(me.profile?.displayName || me.username);
            setCurrentUserId(me.id);
        }).catch(() => { addToast({ title: 'Failed to load user info', variant: 'error' }); });
    }, []);

    // Mark channel as read on mount
    useEffect(() => {
        if (!channelId) return;
        markRead(channelId);
        api.messages.ack(channelId).catch(() => {});
    }, [channelId]);

    // Listen for remote typing events
    useEffect(() => {
        if (!channelId) return;
        const unsub = onTypingStart((payload: TypingStartPayload) => {
            if (payload.channelId !== channelId) return;
            if (payload.userId === currentUserId) return;
            setTypingUsers(prev => {
                const next = new Map(prev);
                next.set(payload.userId, payload.username);
                return next;
            });
            // Clear existing timer for this user
            const existing = typingTimersRef.current.get(payload.userId);
            if (existing) clearTimeout(existing);
            // Auto-expire after 8s
            const timer = setTimeout(() => {
                setTypingUsers(prev => {
                    const next = new Map(prev);
                    next.delete(payload.userId);
                    return next;
                });
                typingTimersRef.current.delete(payload.userId);
            }, 8000);
            typingTimersRef.current.set(payload.userId, timer);
        });
        return () => {
            unsub();
            typingTimersRef.current.forEach(t => clearTimeout(t));
            typingTimersRef.current.clear();
            setTypingUsers(new Map());
        };
    }, [channelId, currentUserId]);

    // Send typing indicator (throttled to once per 5s)
    const sendTypingIndicator = useCallback(() => {
        if (!channelId) return;
        const now = Date.now();
        if (now - lastTypingSentRef.current < 5000) return;
        lastTypingSentRef.current = now;
        api.messages.startTyping(channelId).catch(() => { /* ignore */ });
    }, [channelId]);

    // Ctrl+F keyboard shortcut to open search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setShowSearchBar(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
            if (e.key === 'Escape' && selectionMode) {
                setSelectionMode(false);
                setSelectedMessages(new Set());
            }
            if (e.key === 'Escape' && showSearchBar) {
                setShowSearchBar(false);
                setSearchQuery('');
                setSearchResults([]);
                setCurrentSearchIndex(0);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [showSearchBar, selectionMode]);

    const handleMessageShiftClick = useCallback((e: React.MouseEvent, messageApiId: string | undefined) => {
        if (e.shiftKey && messageApiId && canManageChannel) {
            e.preventDefault();
            setSelectionMode(true);
            setSelectedMessages(prev => {
                const next = new Set(prev);
                if (next.has(messageApiId)) next.delete(messageApiId); else next.add(messageApiId);
                return next;
            });
        }
    }, [canManageChannel]);

    const handleBulkDelete = useCallback(async () => {
        if (!channelId || selectedMessages.size === 0) return;
        if (!window.confirm(`Delete ${selectedMessages.size} messages? This cannot be undone.`)) return;
        try {
            await api.messages.bulkDelete(channelId, [...selectedMessages]);
            setMessages(prev => prev.filter(m => !m.apiId || !selectedMessages.has(m.apiId)));
            addToast({ title: `Deleted ${selectedMessages.size} messages`, variant: 'success' });
        } catch {
            addToast({ title: 'Bulk delete failed', variant: 'error' });
        }
        setSelectedMessages(new Set());
        setSelectionMode(false);
    }, [channelId, selectedMessages, addToast]);

    // Debounced search API call
    const performSearch = useCallback((query: string) => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        if (!query.trim() || !channelId) {
            setSearchResults([]);
            setCurrentSearchIndex(0);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const res = await api.search.messages({ query: query.trim(), channelId, limit: 50 });
                setSearchResults(res.results || []);
                setCurrentSearchIndex(0);
                if (res.results && res.results.length > 0) {
                    // Scroll to first result
                    const firstId = res.results[0].id;
                    const el = document.querySelector(`[data-message-id="${firstId}"]`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setHighlightedMessageId(parseInt(firstId, 36) || 0);
                        setTimeout(() => setHighlightedMessageId(null), 2500);
                    }
                }
            } catch {
                addToast({ title: 'Search failed', variant: 'error' });
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    }, [channelId, addToast]);

    const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchQuery(val);
        performSearch(val);
    }, [performSearch]);

    const navigateSearchResult = useCallback((direction: 'up' | 'down') => {
        if (searchResults.length === 0) return;
        let newIndex: number;
        if (direction === 'down') {
            newIndex = (currentSearchIndex + 1) % searchResults.length;
        } else {
            newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        }
        setCurrentSearchIndex(newIndex);
        const resultId = searchResults[newIndex].id;
        const el = document.querySelector(`[data-message-id="${resultId}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMessageId(parseInt(resultId, 36) || 0);
            setTimeout(() => setHighlightedMessageId(null), 2500);
        }
    }, [searchResults, currentSearchIndex]);

    const closeSearch = useCallback(() => {
        setShowSearchBar(false);
        setSearchQuery('');
        setSearchResults([]);
        setCurrentSearchIndex(0);
        setIsSearching(false);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    }, []);

    // Fetch channel info for name
    useEffect(() => {
        if (channelId) {
            api.channels.get(channelId).then(ch => {
                setChannelName(ch.name);
                setRateLimitPerUser((ch as any).rateLimitPerUser || 0);
                // Load channel background if set (for all users to see same theme)
                if ((ch as any).backgroundUrl) {
                    setBgMedia({ 
                        url: (ch as any).backgroundUrl, 
                        type: (ch as any).backgroundType || 'image' 
                    });
                }
            }).catch(() => { addToast({ title: 'Failed to load channel info', variant: 'error' }); });
        }
    }, [channelId, setBgMedia]);

    // Check if current user can manage channel (owner or has MANAGE_CHANNELS permission)
    useEffect(() => {
        if (!guildId || !currentUserId) return;
        api.guilds.get(guildId).then(guild => {
            // Check if user is guild owner
            if (guild.ownerId === currentUserId) {
                setCanManageChannel(true);
                return;
            }
            // For non-owners, check member roles
            api.guilds.getMemberRoles(guildId, currentUserId).then((roles: any[]) => {
                // Check if member has any roles (simplified admin check)
                // In production, would check specific permission bits
                if (roles && roles.length > 0) {
                    setCanManageChannel(true);
                }
            }).catch(() => setCanManageChannel(false));
        }).catch(() => setCanManageChannel(false));
    }, [guildId, currentUserId]);

    const handleMessageContext = (e: React.MouseEvent, msg: Message) => {
        const isOwn = msg.authorId === currentUserId;
        openMenu(e, [
            { id: 'reply', label: 'Reply', icon: Reply, onClick: () => setReplyingTo({ id: msg.id, apiId: msg.apiId, author: msg.author, content: (msg.content || '').slice(0, 80) }) },
            ...(isOwn && msg.apiId ? [{
                id: 'edit', label: 'Edit Message', icon: Edit2, onClick: () => {
                    setEditingMessage({ id: msg.id, apiId: msg.apiId!, content: msg.content });
                    setEditContent(msg.content);
                }
            }] : []),
            { id: 'react', label: 'Add Reaction', icon: Smile, onClick: () => setIsEmojiPickerOpen(true) },
            { id: 'forward', label: 'Forward Message', icon: Share2, onClick: () => setForwardingMessage(msg) },
            { id: 'thread', label: 'Create Thread', icon: MessageSquare, onClick: () => setActiveThreadMessage(msg) },
            {
                id: 'copy', label: 'Copy Text', icon: Copy, onClick: () => {
                    if (msg.content) navigator.clipboard.writeText(msg.content);
                    addToast({ title: 'Copied to clipboard', variant: 'info' });
                }
            },
            {
                id: 'copy-link', label: 'Copy Message Link', icon: Link2, onClick: () => {
                    const link = msg.apiId
                        ? `${window.location.origin}/guild/${guildId}/channel/${channelId}?msg=${msg.apiId}`
                        : window.location.href;
                    navigator.clipboard.writeText(link).catch(() => {});
                    addToast({ title: 'Message link copied', variant: 'info' });
                }
            },
            {
                id: 'highlight', label: 'Highlight Message (Test)', icon: Sparkles, onClick: () => {
                    setHighlightedMessageId(msg.id);
                    setTimeout(() => setHighlightedMessageId(null), 2500);
                }
            },
            {
                id: 'pin', label: pinnedMessages.some(p => p.id === msg.apiId) ? 'Unpin Message' : 'Pin Message', icon: Pin, onClick: () => {
                    if (!channelId || !msg.apiId) return;
                    const isPinned = pinnedMessages.some(p => p.id === msg.apiId);
                    if (isPinned) {
                        api.messages.unpin(channelId, msg.apiId).then(() => {
                            setPinnedMessages(prev => prev.filter(p => p.id !== msg.apiId));
                            addToast({ title: 'Message Unpinned', variant: 'success' });
                        }).catch(() => addToast({ title: 'Failed to unpin message', variant: 'error' }));
                    } else {
                        api.messages.pin(channelId, msg.apiId).then(() => {
                            addToast({ title: 'Message Pinned', variant: 'success' });
                            loadPinnedMessages();
                        }).catch(() => addToast({ title: 'Failed to pin message', variant: 'error' }));
                    }
                }
            },
            ...(msg.apiId ? [{
                id: 'bookmark', label: 'Bookmark Message', icon: Star, onClick: () => {
                    fetch(`${API_BASE}/api/v1/users/@me/bookmarks`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messageId: msg.apiId }),
                    }).then(r => {
                        if (r.ok) addToast({ title: 'Message bookmarked', variant: 'success' });
                        else addToast({ title: 'Already bookmarked', variant: 'info' });
                    }).catch(() => addToast({ title: 'Failed to bookmark', variant: 'error' }));
                }
            }] : []),
            { divider: true, id: 'div1', label: '', onClick: () => { } },
            ...(!isOwn ? [{
                id: 'report', label: 'Report Message', icon: Flag, color: 'var(--warning)', onClick: () => {
                    addToast({ title: 'Report Submitted', description: `Message by ${msg.author} has been reported.`, variant: 'info' });
                }
            }] : []),
            ...((isOwn || canManageChannel) ? [{
                id: 'delete', label: 'Delete Message', icon: Trash2, color: 'var(--error)', onClick: () => {
                    if (channelId && msg.apiId) {
                        api.messages.delete(channelId, msg.apiId).then(() => {
                            setMessages(prev => prev.filter(m => m.id !== msg.id));
                            addToast({ title: 'Message Deleted', variant: 'success' });
                        }).catch(() => addToast({ title: 'Failed to delete message', variant: 'error' }));
                    } else {
                        setMessages(prev => prev.filter(m => m.id !== msg.id));
                    }
                }
            }] : [])
        ]);
    };

    // User cache for displaying author names from IDs
    const userCacheRef = useRef<Map<string, { username: string; displayName: string }>>(new Map());
    // Role color cache: userId -> hex color string of their highest role
    const roleColorCacheRef = useRef<Map<string, string>>(new Map());
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);

    // Pinned Messages Panel State
    const [showPinnedPanel, setShowPinnedPanel] = useState(false);
    const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
    const [isLoadingPins, setIsLoadingPins] = useState(false);

    const loadPinnedMessages = useCallback(async () => {
        if (!channelId) return;
        setIsLoadingPins(true);
        try {
            const pins = await api.messages.getPins(channelId);
            setPinnedMessages(pins || []);
        } catch {
            addToast({ title: 'Failed to load pinned messages', variant: 'error' });
        } finally {
            setIsLoadingPins(false);
        }
    }, [channelId]);

    const oldestMessageIdRef = useRef<string | null>(null);

    // Convert an API message into a local Message shape
    const convertApiMessage = (m: any): Message => {
        const authorInfo = userCacheRef.current.get(m.authorId);
        const authorName = m.author?.displayName || m.author?.username || authorInfo?.displayName || authorInfo?.username || m.authorId?.slice(0, 8) || 'Unknown';
        const attachments = Array.isArray(m.attachments) && m.attachments.length > 0 ? m.attachments : undefined;
        const isVoice = attachments?.length === 1 && attachments[0]?.mimeType?.startsWith('audio/');
        return {
            id: typeof m.id === 'string' ? parseInt(m.id, 36) || Date.now() : m.id,
            apiId: typeof m.id === 'string' ? m.id : undefined,
            authorId: m.authorId,
            author: authorName,
            system: m.type !== 0 && m.type !== undefined,
            avatar: authorName.charAt(0).toUpperCase(),
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: m.content || '',
            edited: m.edited || false,
            replyToId: m.replyToId || undefined,
            threadReplyCount: m.threadReplyCount ?? 0,
            attachments,
            ...(isVoice ? { type: 'voice' as const } : {}),
            reactions: Array.isArray(m.reactions) && m.reactions.length > 0 ? m.reactions : undefined,
            embeds: Array.isArray(m.embeds) && m.embeds.length > 0 ? m.embeds : undefined,
            authorRoleColor: m.authorId ? roleColorCacheRef.current.get(m.authorId) : undefined,
            authorAvatarHash: m.author?.avatarHash ?? null,
            authorNameplateStyle: (m.author as any)?.nameplateStyle ?? null,
            expiresAt: m.expiresAt ?? null,
            createdAt: m.createdAt ?? null,
        };
    };

    // Resolve author summaries for a batch of messages
    const resolveAuthors = async (authorIds: string[]) => {
        if (authorIds.length === 0) return;
        const unknownIds = authorIds.filter(id => !userCacheRef.current.has(id));
        if (unknownIds.length === 0) return;
        try {
            const summaries = await api.users.getSummaries(unknownIds);
            for (const s of summaries) {
                userCacheRef.current.set(s.id, { username: s.username, displayName: s.displayName });
            }
        } catch { /* ignore - will show IDs */ }
    };

    // Fetch messages from API
    const fetchMessages = useCallback(async (options?: { signal?: AbortSignal }) => {
        if (!channelId) {
            setIsLoadingMessages(false);
            return;
        }
        setIsLoadingMessages(true);
        setMessagesError(false);
        setHasMoreMessages(true);
        oldestMessageIdRef.current = null;
        try {
            const [apiMessages, apiPolls] = await Promise.all([
                api.messages.list(channelId, { limit: 50 }),
                api.polls.list(channelId).catch(() => [] as any[]),
            ]);
            // If this fetch was superseded by a newer one (channel changed), discard
            if (options?.signal?.aborted) return;
            const authorIds = [...new Set(apiMessages.map((m: any) => m.authorId))];
            await resolveAuthors(authorIds);
            if (options?.signal?.aborted) return;
            // API returns newest-first; reverse so oldest is at index 0 (top of chat)
            const converted = apiMessages.map(convertApiMessage).reverse();
            // Resolve reply references from loaded messages
            const apiMap = new Map(apiMessages.map((m: any) => [m.id, m]));
            for (const msg of converted) {
                if (msg.replyToId && apiMap.has(msg.replyToId)) {
                    const ref = apiMap.get(msg.replyToId);
                    const refAuthor = ref.author?.displayName || ref.author?.username || userCacheRef.current.get(ref.authorId)?.displayName || 'Unknown';
                    msg.replyToAuthor = refAuthor;
                    msg.replyToContent = (ref.content || '').slice(0, 100);
                }
            }
            // Merge polls into the message list, sorted by createdAt
            const pollMessages: Message[] = (apiPolls as any[]).map((poll: any) => ({
                id: Math.abs(parseInt(poll.id.replace(/-/g, '').slice(0, 8), 16)) || Date.now(),
                apiId: `poll:${poll.id}`,
                authorId: poll.creatorId,
                author: poll.creatorName || 'Unknown',
                system: false,
                avatar: (poll.creatorName || 'U').charAt(0).toUpperCase(),
                time: new Date(poll.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: '',
                createdAt: poll.createdAt,
                type: 'poll' as const,
                pollData: {
                    pollId: poll.id,
                    question: poll.question,
                    options: poll.options?.map((o: any) => ({ id: o.id, text: o.text, votes: o.voteCount ?? 0 })) ?? [],
                    totalVotes: poll.totalVoters ?? 0,
                    multipleChoice: poll.multipleChoice ?? false,
                    myVotes: poll.myVotes ?? [],
                },
            }));
            const merged = [...converted, ...pollMessages].sort((a, b) =>
                new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
            );
            setMessages(merged);
            if (apiMessages.length > 0) {
                // API returns newest-first; the last element is the oldest message
                oldestMessageIdRef.current = apiMessages[apiMessages.length - 1].id;
            }
            if (apiMessages.length < 50) {
                setHasMoreMessages(false);
            }
        } catch {
            if (options?.signal?.aborted) return;
            setMessagesError(true);
        } finally {
            if (!options?.signal?.aborted) {
                setIsLoadingMessages(false);
            }
        }
    }, [channelId]);

    // Reset state and fetch messages when channelId changes
    useEffect(() => {
        // Clear stale messages immediately so we don't show previous channel's messages
        setMessages([]);
        setIsLoadingMessages(true);
        setMessagesError(false);
        setHasMoreMessages(true);
        oldestMessageIdRef.current = null;

        const abortController = new AbortController();
        fetchMessages({ signal: abortController.signal });
        return () => { abortController.abort(); };
    }, [fetchMessages]);

    // Load draft and scheduled messages when channel changes
    useEffect(() => {
        if (!channelId) return;
        // Load draft
        fetch(`${API_BASE}/api/v1/channels/${channelId}/draft`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then(r => r.ok ? r.json() : null).then(draft => {
            if (draft?.content) {
                setInputValue(draft.content);
                setHasDraft(true);
            } else {
                setHasDraft(false);
            }
        }).catch(() => {});
        // Load scheduled messages
        fetch(`${API_BASE}/api/v1/channels/${channelId}/messages/scheduled`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }).then(r => r.ok ? r.json() : []).then(data => {
            setScheduledMessages(Array.isArray(data) ? data : []);
        }).catch(() => {});
    }, [channelId]);

    // Load older messages when scrolling to top
    const loadOlderMessages = useCallback(async () => {
        if (!channelId || !hasMoreMessages || isLoadingOlder || !oldestMessageIdRef.current) return;
        setIsLoadingOlder(true);
        try {
            const olderMessages = await api.messages.list(channelId, { limit: 50, before: oldestMessageIdRef.current });
            if (olderMessages.length === 0) {
                setHasMoreMessages(false);
                return;
            }
            const authorIds = [...new Set(olderMessages.map((m: any) => m.authorId))];
            await resolveAuthors(authorIds);
            // API returns newest-first; reverse so oldest is first, then prepend
            const converted = olderMessages.map(convertApiMessage).reverse();
            // The last element in the API response (newest-first) is the oldest
            oldestMessageIdRef.current = olderMessages[olderMessages.length - 1].id;
            setMessages(prev => [...converted, ...prev]);
            if (olderMessages.length < 50) {
                setHasMoreMessages(false);
            }
        } catch {
            addToast({ title: 'Failed to load older messages', variant: 'error' });
        } finally {
            setIsLoadingOlder(false);
        }
    }, [channelId, hasMoreMessages, isLoadingOlder, addToast]);

    // Fetch guild members for @mention autocomplete + role colors
    const [guildMembers, setGuildMembers] = useState<{ id: string; username: string; displayName: string; avatar?: string }[]>([]);
    useEffect(() => {
        if (guildId) {
            api.guilds.getMembers(guildId).then(async (members) => {
                const ids = members.map((m: any) => m.userId);
                if (ids.length === 0) return;

                // Fetch roles + summaries in parallel
                const [summaries, rolesData] = await Promise.all([
                    api.users.getSummaries(ids).catch(() => [] as any[]),
                    api.guilds.getRoles(guildId).catch(() => [] as any[]),
                ]);

                // Build sorted role map for computing highest role color
                const sortedRoles = (rolesData as any[]).sort((a: any, b: any) => (b.position ?? 0) - (a.position ?? 0));
                const roleById = new Map(sortedRoles.map((r: any) => [r.id, r]));

                // Compute highest role color per member
                roleColorCacheRef.current.clear();
                for (const m of members as any[]) {
                    const memberRoleIds: string[] = m.roleIds || [];
                    let highestRole: any = null;
                    for (const rid of memberRoleIds) {
                        const r = roleById.get(rid);
                        if (r && (!highestRole || (r.position ?? 0) > (highestRole.position ?? 0))) {
                            highestRole = r;
                        }
                    }
                    if (highestRole && highestRole.color) {
                        roleColorCacheRef.current.set(m.userId, `#${highestRole.color.toString(16).padStart(6, '0')}`);
                    }
                }

                // Update existing messages with role colors
                setMessages(prev => prev.map(msg => {
                    if (msg.authorId && roleColorCacheRef.current.has(msg.authorId)) {
                        return { ...msg, authorRoleColor: roleColorCacheRef.current.get(msg.authorId) };
                    }
                    return msg;
                }));

                setGuildMembers((summaries as any[]).map((s: any) => ({
                    id: s.id,
                    username: s.username,
                    displayName: s.displayName,
                })));
            }).catch(() => { addToast({ title: 'Failed to load member list', variant: 'error' }); });
        } else {
            roleColorCacheRef.current.clear();
        }
    }, [guildId]);

    // Fetch guild channels for #channel autocomplete
    useEffect(() => {
        if (!guildId) { setGuildChannelsList([]); return; }
        api.channels.getGuildChannels(guildId).then((channels: any[]) => {
            setGuildChannelsList(channels.map((c: any) => ({ id: c.id, name: c.name, type: c.type })));
        }).catch(() => {});
    }, [guildId]);

    // Fetch slash commands for this guild
    useEffect(() => {
        if (!guildId) { setGuildCommands([]); return; }
        api.guilds.getCommands(guildId).then((cmds: any[]) => {
            if (Array.isArray(cmds)) {
                setGuildCommands(cmds.map((c: any) => ({ id: c.id, name: c.name, description: c.description || '', options: c.options })));
            }
        }).catch(() => {});
    }, [guildId]);

    // Fetch guild custom emojis for :name: rendering in messages
    useEffect(() => {
        if (!guildId) { setGuildCustomEmojis([]); return; }
        api.guilds.getEmojis(guildId).then((emojis: any[]) => {
            setGuildCustomEmojis(emojis.map((e: any) => ({
                name: e.name,
                url: e.imageHash ? `${API_BASE}/files/${e.imageHash}` : '',
            })).filter((e: { name: string; url: string }) => e.url));
        }).catch(() => {});
    }, [guildId]);

    const STANDARD_EMOJIS = [
        { name: 'smile', emoji: '😄' },
        { name: 'rocket', emoji: '🚀' },
        { name: 'fire', emoji: '🔥' },
        { name: 'skull', emoji: '💀' },
        { name: 'heart', emoji: '❤️' },
        { name: 'thumbsup', emoji: '👍' },
        { name: 'wave', emoji: '👋' },
        { name: 'laugh', emoji: '😂' },
        { name: 'thinking', emoji: '🤔' },
        { name: 'star', emoji: '⭐' },
    ];

    const allEmojis = [
        ...guildCustomEmojis.map(e => ({ name: e.name, emoji: e.url ? `custom:${e.name}:${e.url}` : e.name, isCustom: true, url: e.url })),
        ...STANDARD_EMOJIS.map(e => ({ ...e, isCustom: false, url: '' })),
    ];

    const filteredEmojis = allEmojis.filter(e =>
        emojiSearch !== null && e.name.toLowerCase().includes(emojiSearch.toLowerCase())
    );

    const filteredUsers = guildMembers.filter(u =>
        mentionSearch !== null &&
        (u.username.toLowerCase().includes(mentionSearch.toLowerCase()) || u.displayName.toLowerCase().includes(mentionSearch.toLowerCase()))
    );

    const filteredChannels = guildChannelsList.filter(c =>
        channelSearch !== null &&
        c.name.toLowerCase().includes(channelSearch.toLowerCase())
    );

    const [messages, setMessages] = useState<Message[]>([]);

    // Reset channel-specific UI state when switching channels (since the component
    // is reused across channels without a key-based remount)
    useEffect(() => {
        setReplyingTo(null);
        setEditingMessage(null);
        setEditContent('');
        setActiveThreadMessage(null);
        setForwardingMessage(null);
        setLightboxUrl(null);
        setShowPinnedPanel(false);
        setPinnedMessages([]);
        setShowSearchBar(false);
        setSearchQuery('');
        setSearchResults([]);
        setTypingUsers(new Map());
        setHighlightedMessageId(null);
        setProfilePopover(null);
        setRoomVelocity(0);
    }, [channelId]);

    // Join/leave channel rooms for real-time events
    useEffect(() => {
        if (!channelId) return;
        socketJoinChannel(channelId);
        const unsubReconnect = onSocketReconnect(() => {
            socketJoinChannel(channelId);
        });
        return () => {
            unsubReconnect();
            socketLeaveChannel(channelId);
        };
    }, [channelId]);

    // Listen for channel background updates from other users/admins
    useEffect(() => {
        if (!channelId) return;
        return onChannelBackgroundUpdated((data) => {
            if (data.channelId !== channelId) return;
            if (data.backgroundUrl) {
                setBgMedia({ url: data.backgroundUrl, type: (data.backgroundType || 'image') as MediaType });
            } else {
                setBgMedia(null);
            }
        });
    }, [channelId, setBgMedia]);

    // Socket listener for real-time messages (create, update, delete)
    useEffect(() => {
        if (!channelId) return;

        const unsubCreate = onMessageCreate((data: MessageCreatePayload) => {
            if (data.channelId !== channelId) return;
            // Don't duplicate messages we sent optimistically
            if (data.authorId === currentUserId) return;
            const authorInfo = userCacheRef.current.get(data.authorId);
            const authorName = data.author?.displayName || data.author?.username || authorInfo?.displayName || authorInfo?.username || data.authorId?.slice(0, 8) || 'Unknown';
            // Resolve reply reference if present
            let replyToAuthor: string | undefined;
            let replyToContent: string | undefined;
            if ((data as any).replyToId) {
                setMessages(currentMsgs => {
                    const refMsg = currentMsgs.find(m => m.apiId === (data as any).replyToId);
                    if (refMsg) {
                        replyToAuthor = refMsg.author;
                        replyToContent = (refMsg.content || '').slice(0, 100);
                    }
                    return currentMsgs;
                });
            }
            const incomingPollData = (data as any).pollData;
            const incomingAttachments = Array.isArray((data as any).attachments) && (data as any).attachments.length > 0 ? (data as any).attachments : undefined;
            const isVoiceMsg = incomingAttachments?.length === 1 && incomingAttachments[0]?.mimeType?.startsWith('audio/');
            setMessages(prev => [...prev, {
                id: typeof data.id === 'string' ? parseInt(data.id, 36) || Date.now() : data.id,
                apiId: data.id,
                authorId: data.authorId,
                author: authorName,
                system: false,
                avatar: authorName.charAt(0).toUpperCase(),
                time: new Date(data.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: data.content || '',
                edited: data.edited || false,
                replyToId: (data as any).replyToId || undefined,
                replyToAuthor,
                replyToContent,
                attachments: incomingAttachments,
                embeds: Array.isArray((data as any).embeds) && (data as any).embeds.length > 0 ? (data as any).embeds : undefined,
                authorRoleColor: data.authorId ? roleColorCacheRef.current.get(data.authorId) : undefined,
                authorAvatarHash: (data as any).author?.avatarHash ?? null,
                authorNameplateStyle: (data as any).author?.nameplateStyle ?? null,
                expiresAt: data.expiresAt ?? null,
                createdAt: data.createdAt ?? null,
                ...(incomingPollData ? {
                    type: 'poll' as const,
                    pollData: {
                        pollId: incomingPollData.id,
                        question: incomingPollData.question,
                        options: incomingPollData.options?.map((o: any) => ({ id: o.id, text: o.text, votes: o.voteCount ?? 0 })) ?? [],
                        totalVotes: incomingPollData.totalVoters ?? 0,
                        multipleChoice: incomingPollData.multipleChoice ?? false,
                        myVotes: incomingPollData.myVotes ?? [],
                    },
                } : {}),
                ...(!incomingPollData && isVoiceMsg ? { type: 'voice' as const } : {}),
            }]);
            playSound('messageReceive');
        });

        const unsubUpdate = onMessageUpdate((data: MessageUpdatePayload) => {
            if (data.channelId !== channelId) return;
            setMessages(prev => prev.map(msg =>
                msg.apiId === data.id
                    ? { ...msg, content: data.content || '', edited: true }
                    : msg
            ));
        });

        const unsubDelete = onMessageDelete((data: MessageDeletePayload) => {
            if (data.channelId !== channelId) return;
            setMessages(prev => prev.filter(msg => msg.apiId !== data.id));
        });

        const unsubDeleteBulk = onMessageDeleteBulk((data: MessageDeleteBulkPayload) => {
            if (data.channelId !== channelId) return;
            const deletedSet = new Set(data.ids);
            setMessages(prev => prev.filter(msg => !msg.apiId || !deletedSet.has(msg.apiId)));
        });

        const unsubReactionAdd = onReactionAdd((data: ReactionPayload) => {
            if (data.channelId !== channelId) return;
            // Skip own reactions (handled optimistically)
            if (data.userId === currentUserId) return;
            setMessages(prev => prev.map(msg => {
                if (msg.apiId !== data.messageId) return msg;
                const existing = (msg.reactions || []).slice();
                const idx = existing.findIndex(r => r.emoji === data.emoji);
                if (idx >= 0) existing[idx] = { ...existing[idx], count: existing[idx].count + 1 };
                else existing.push({ emoji: data.emoji, count: 1, me: false });
                return { ...msg, reactions: existing };
            }));
        });

        const unsubReactionRemove = onReactionRemove((data: ReactionPayload) => {
            if (data.channelId !== channelId) return;
            if (data.userId === currentUserId) return;
            setMessages(prev => prev.map(msg => {
                if (msg.apiId !== data.messageId) return msg;
                const existing = (msg.reactions || []).slice();
                const idx = existing.findIndex(r => r.emoji === data.emoji);
                if (idx >= 0) {
                    if (existing[idx].count <= 1) existing.splice(idx, 1);
                    else existing[idx] = { ...existing[idx], count: existing[idx].count - 1 };
                }
                return { ...msg, reactions: existing };
            }));
        });

        return () => { unsubCreate(); unsubUpdate(); unsubDelete(); unsubDeleteBulk(); unsubReactionAdd(); unsubReactionRemove(); };
    }, [channelId, currentUserId]);

    // Socket listener for embed updates (URL unfurling)
    useEffect(() => {
        if (!channelId) return;
        const socket = getSocket();
        if (!socket) return;
        const handler = ({ messageId, embeds }: { messageId: string; embeds: any[] }) => {
            setMessages(prev => prev.map(m =>
                m.apiId === messageId ? { ...m, embeds } : m
            ));
        };
        socket.on('MESSAGE_EMBED_UPDATE', handler);
        return () => { socket.off('MESSAGE_EMBED_UPDATE', handler); };
    }, [channelId]);

    // Socket listener for pin updates
    useEffect(() => {
        if (!channelId) return;

        const unsubPins = onChannelPinsUpdate((data: ChannelPinsUpdatePayload) => {
            if (data.channelId !== channelId) return;
            
            if (data.pinned) {
                // Message was pinned - reload pins if panel is open
                if (showPinnedPanel) {
                    loadPinnedMessages();
                }
            } else {
                // Message was unpinned - remove from local state
                setPinnedMessages(prev => prev.filter(p => p.id !== data.messageId));
            }
        });

        return () => { unsubPins(); };
    }, [channelId, showPinnedPanel]);

    // Decay velocity
    useEffect(() => {
        const interval = setInterval(() => {
            setRoomVelocity(prev => Math.max(0, prev - 0.25));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80, // estimated height of a message
        overscan: 10, // preload outside view for smooth scrolling
    });

    // Remove expired disappearing messages from the display list (A2)
    useEffect(() => {
        const now = Date.now();
        const hasAnyExpiry = messages.some(m => m.expiresAt);
        if (!hasAnyExpiry) return;
        // Immediately remove already-past-due messages
        setMessages(prev => {
            const filtered = prev.filter(m => !m.expiresAt || new Date(m.expiresAt).getTime() > Date.now());
            return filtered.length < prev.length ? filtered : prev;
        });
        // Schedule removal of the next-to-expire message
        const futureExpiries = messages
            .filter(m => m.expiresAt && new Date(m.expiresAt).getTime() > now)
            .map(m => new Date(m.expiresAt!).getTime())
            .sort((a, b) => a - b);
        if (futureExpiries.length === 0) return;
        const delay = futureExpiries[0] - Date.now() + 500;
        const timer = setTimeout(() => {
            setMessages(prev => prev.filter(m => !m.expiresAt || new Date(m.expiresAt).getTime() > Date.now()));
        }, delay);
        return () => clearTimeout(timer);
    }, [messages]);

    const scrollToBottom = useCallback(() => {
        if (messages.length > 0) {
            if (parentRef.current) parentRef.current.scrollTop = parentRef.current.scrollHeight;
        }
    }, [messages.length, rowVirtualizer]);

    // Load older messages when user scrolls near top
    useEffect(() => {
        const el = parentRef.current;
        if (!el) return;
        const handleScroll = () => {
            if (el.scrollTop < 200 && hasMoreMessages && !isLoadingOlder) {
                loadOlderMessages();
            }
            const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            setShowScrollButton(distFromBottom > 200);
        };
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, [hasMoreMessages, isLoadingOlder, loadOlderMessages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isRecording) {
            recordingInterval.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } else {
            if (recordingInterval.current) clearInterval(recordingInterval.current);
        }
        return () => {
            if (recordingInterval.current) clearInterval(recordingInterval.current);
        };
    }, [isRecording]);

    const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 25 * 1024 * 1024) {
            addToast({ title: 'File too large', description: 'Background files must be under 25MB.', variant: 'error' });
            return;
        }
        const isVideo = file.type.startsWith('video/');
        const bgType: 'image' | 'video' = isVideo ? 'video' : 'image';

        try {
            // Upload the file via the files API to get a proper URL
            const uploaded = await api.files.upload(file);
            const url = uploaded.url;

            // Update local background immediately for this user
            setBgMedia({ url, type: bgType });

            // Persist to the channel so all users see the same background
            if (channelId) {
                await api.channels.update(channelId, { backgroundUrl: url, backgroundType: bgType });
                addToast({ title: 'Channel theme updated', description: 'All users in this channel will now see this background.', variant: 'success' });
            }

            setMessages(prev => [...prev, {
                id: Date.now(),
                author: 'System',
                system: true,
                avatar: <ImageIcon size={24} />,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: `${currentUserName || 'User'} updated the channel theme.`
            }]);
        } catch {
            addToast({ title: 'Failed to update channel theme', variant: 'error' });
        }
    };

    const emoticonMap: Record<string, string> = {
        ':)': '🙂', ':D': '😃', ':(': '🙁', ':O': '😲', ';)': '😉', ':/': '😕'
    };

    const processEmojis = (text: string) => {
        let result = text;
        for (const [emoticon, emoji] of Object.entries(emoticonMap)) {
            const escapedEmoticon = emoticon.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
            const regex = new RegExp(`(?<!\\\\)${escapedEmoticon}`, 'g');
            result = result.replace(regex, emoji);
        }
        for (const emoticon of Object.keys(emoticonMap)) {
            const escapedEmoticon = emoticon.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
            const regex = new RegExp(`\\\\${escapedEmoticon}`, 'g');
            result = result.replace(regex, emoticon);
        }

        result = result.replace(/(?<!\\):([a-zA-Z0-9_]+):/g, (match, name) => {
            const found = allEmojis.find(e => e.name === name);
            if (found) return found.isCustom ? `:${found.name}:` : (found as any).emoji;
            return match;
        });
        result = result.replace(/\\:([a-zA-Z0-9_]+):/g, ':$1:');
        return result;
    };

    const handleSendMessage = async () => {
        if (inputValue.trim() === '' && chatAttachedFiles.length === 0) return;
        if (!channelId) return;
        if (slowRemaining > 0) {
            addToast({ title: `Slowmode active. Wait ${slowRemaining}s`, variant: 'error' });
            return;
        }
        playSound('messageSend');

        const processedContent = processEmojis(inputValue);

        // Upload attached files and collect IDs
        let attachmentIds: string[] = [];
        if (chatAttachedFiles.length > 0) {
            try {
                const uploadResults = await Promise.all(
                    chatAttachedFiles.map(f => api.files.upload(f.file, 'attachment'))
                );
                attachmentIds = uploadResults.map(r => r.id);
            } catch {
                addToast({ title: 'Failed to upload attachments', variant: 'error' });
                return;
            }
        }

        // Build the reply reference for the optimistic message
        const replyToApiId = replyingTo?.apiId || undefined;
        const replyToAuthor = replyingTo?.author || undefined;
        const replyToContent = replyingTo?.content || undefined;

        // Optimistic local message
        const optimisticId = Date.now();
        setMessages(prev => [...prev, {
            id: optimisticId,
            authorId: currentUserId,
            author: currentUserName || 'You',
            system: false,
            avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: processedContent,
            ...(replyToApiId ? { replyToId: replyToApiId, replyToAuthor, replyToContent } : {}),
            authorRoleColor: currentUserId ? roleColorCacheRef.current.get(currentUserId) : undefined,
        }]);

        // Track slowmode
        if (rateLimitPerUser > 0) setLastSentAt(Date.now());

        // Send to API
        api.messages.send(channelId, {
            content: processedContent || ' ',
            ...(replyToApiId ? { replyToId: replyToApiId } : {}),
            ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
        }).then((sent: any) => {
            // Patch optimistic message with real API ID and attachments
            if (sent?.id) {
                setMessages(prev => prev.map(m =>
                    m.id === optimisticId ? {
                        ...m,
                        apiId: sent.id,
                        authorId: sent.authorId,
                        attachments: sent.attachments?.length > 0 ? sent.attachments : undefined,
                    } : m
                ));
            }
        }).catch(() => {
            // Remove optimistic message on failure
            setMessages(prev => prev.filter(m => m.id !== optimisticId));
            addToast({ title: 'Failed to send message', variant: 'error' });
        });

        setInputValue('');
        setChatAttachedFiles([]);
        setReplyingTo(null);
        setMentionSearch(null);
        setChannelSearch(null);
        setEmojiSearch(null);
        setRoomVelocity(prev => Math.min(10, prev + 2));
        setHasDraft(false);
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };

    // Edit message handler
    const handleEditSubmit = useCallback(async () => {
        if (!editingMessage || !channelId || !editContent.trim()) return;
        try {
            await api.messages.edit(channelId, editingMessage.apiId, { content: editContent.trim() });
            setMessages(prev => prev.map(m =>
                m.apiId === editingMessage.apiId ? { ...m, content: editContent.trim(), edited: true } : m
            ));
            setEditingMessage(null);
            setEditContent('');
        } catch {
            addToast({ title: 'Failed to edit message', variant: 'error' });
        }
    }, [editingMessage, channelId, editContent, addToast]);

    // Reaction handler — toggles add/remove via API
    const handleReaction = useCallback(async (messageApiId: string, emoji: string, alreadyReacted: boolean) => {
        if (!channelId || !messageApiId) return;
        try {
            if (alreadyReacted) {
                await api.messages.removeReaction(channelId, messageApiId, emoji);
            } else {
                await api.messages.addReaction(channelId, messageApiId, emoji);
            }
            // Optimistically update local state
            setMessages(prev => prev.map(m => {
                if (m.apiId !== messageApiId) return m;
                const existing = (m.reactions || []).slice();
                const idx = existing.findIndex((r: any) => r.emoji === emoji);
                if (alreadyReacted) {
                    if (idx >= 0) {
                        if (existing[idx].count <= 1) existing.splice(idx, 1);
                        else existing[idx] = { ...existing[idx], count: existing[idx].count - 1, me: false };
                    }
                } else {
                    if (idx >= 0) existing[idx] = { ...existing[idx], count: existing[idx].count + 1, me: true };
                    else existing.push({ emoji, count: 1, me: true });
                }
                return { ...m, reactions: existing };
            }));
        } catch { /* ignore */ }
    }, [channelId]);

    const handleSendGif = (url: string, _previewUrl: string) => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            author: currentUserName,
            system: false,
            avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: '',
            type: 'media' as const,
            mediaUrl: url,
            mediaAspectRatio: 16 / 9
        }]);
        setIsEmojiPickerOpen(false);
    };

    const handleSendSticker = (sticker: { id: string; name: string; url: string }) => {
        const optimisticId = Date.now();
        setMessages(prev => [...prev, {
            id: optimisticId,
            authorId: currentUserId,
            author: currentUserName || 'You',
            system: false,
            avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: '',
            attachments: [{ id: sticker.id, url: sticker.url, filename: sticker.name, size: 0, mimeType: 'image/png', type: 'sticker' } as any],
        }]);
        setIsEmojiPickerOpen(false);
        if (channelId) {
            api.messages.send(channelId, { content: ' ', stickerId: sticker.id } as any).then((sent: any) => {
                if (sent?.id) {
                    setMessages(prev => prev.map(m => m.id === optimisticId ? { ...m, apiId: sent.id } : m));
                }
            }).catch(() => {
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
                addToast({ title: 'Failed to send sticker', variant: 'error' });
            });
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);

        // Debounced draft auto-save (2s)
        if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
        if (channelId) {
            if (val.trim().length > 0) {
                setHasDraft(true);
                draftSaveTimerRef.current = setTimeout(() => {
                    fetch(`${API_BASE}/api/v1/channels/${channelId}/draft`, {
                        method: 'PUT',
                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: val }),
                    }).catch(() => {});
                }, 2000);
            } else {
                setHasDraft(false);
                fetch(`${API_BASE}/api/v1/channels/${channelId}/draft`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                }).catch(() => {});
            }
        }

        // Notify server that we're typing
        if (val.trim().length > 0) sendTypingIndicator();

        // Slash command detection: starts with "/" and no spaces before cursor
        const slashMatch = val.match(/^\/([a-zA-Z0-9_]*)$/);
        if (slashMatch) {
            setSlashSearch(slashMatch[1]);
            setSlashIndex(0);
            setMentionSearch(null);
            setChannelSearch(null);
            setEmojiSearch(null);
            return;
        } else {
            setSlashSearch(null);
        }

        const mentionMatch = val.match(/@([a-zA-Z0-9_]*)$/);
        const channelMatch = val.match(/#([a-zA-Z0-9_-]*)$/);
        const emojiMatch = val.match(/(?<!\\):([a-zA-Z0-9_]{1,})$/); // at least 1 char for autocomplete

        if (mentionMatch) {
            setMentionSearch(mentionMatch[1]);
            setMentionIndex(0);
            setChannelSearch(null);
            setEmojiSearch(null);
        } else if (channelMatch) {
            setChannelSearch(channelMatch[1]);
            setChannelIndex(0);
            setMentionSearch(null);
            setEmojiSearch(null);
        } else if (emojiMatch) {
            setEmojiSearch(emojiMatch[1]);
            setEmojiIndex(0);
            setMentionSearch(null);
            setChannelSearch(null);
        } else {
            setMentionSearch(null);
            setChannelSearch(null);
            setEmojiSearch(null);
        }
    };

    const insertMention = (userId: string) => {
        if (mentionSearch === null) return;
        const val = inputValue.replace(/@([a-zA-Z0-9_]*)$/, `<@${userId}> `);
        setInputValue(val);
        setMentionSearch(null);
    };

    const insertChannelMention = (chId: string) => {
        if (channelSearch === null) return;
        const val = inputValue.replace(/#([a-zA-Z0-9_-]*)$/, `<#${chId}> `);
        setInputValue(val);
        setChannelSearch(null);
    };

    const selectSlashCommand = (cmd: { id: string; name: string; description: string; options?: any[] }) => {
        // Replace /search with /commandName, then send as interaction
        setInputValue(`/${cmd.name} `);
        setSlashSearch(null);
        // If command has no options, send it immediately
        if (!cmd.options || cmd.options.length === 0) {
            api.messages.send(channelId!, { content: `/${cmd.name}` }).catch(() => {});
            setInputValue('');
        }
    };

    const filteredCommands = slashSearch !== null ? guildCommands.filter(c => c.name.toLowerCase().includes(slashSearch.toLowerCase())).slice(0, 10) : [];

    const insertEmoji = (emojiName: string) => {
        if (emojiSearch === null) return;
        const val = inputValue.replace(/:([a-zA-Z0-9_]*)$/, `:${emojiName}: `);
        setInputValue(val);
        setEmojiSearch(null);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Slash command navigation
        if (slashSearch !== null && filteredCommands.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSlashIndex(prev => (prev + 1) % filteredCommands.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSlashIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                selectSlashCommand(filteredCommands[slashIndex]);
                return;
            } else if (e.key === 'Escape') {
                setSlashSearch(null);
                return;
            }
        }

        if (mentionSearch !== null && filteredUsers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % filteredUsers.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(filteredUsers[mentionIndex].id);
                return;
            } else if (e.key === 'Escape') {
                setMentionSearch(null);
                return;
            }
        }

        if (channelSearch !== null && filteredChannels.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setChannelIndex(prev => (prev + 1) % filteredChannels.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setChannelIndex(prev => (prev - 1 + filteredChannels.length) % filteredChannels.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertChannelMention(filteredChannels[channelIndex].id);
                return;
            } else if (e.key === 'Escape') {
                setChannelSearch(null);
                return;
            }
        }

        if (emojiSearch !== null && filteredEmojis.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setEmojiIndex(prev => (prev + 1) % filteredEmojis.length);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setEmojiIndex(prev => (prev - 1 + filteredEmojis.length) % filteredEmojis.length);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertEmoji(filteredEmojis[emojiIndex].name);
                return;
            } else if (e.key === 'Escape') {
                setEmojiSearch(null);
                return;
            }
        }

        if (e.key === 'Escape' && editingMessage) {
            setEditingMessage(null);
            setEditContent('');
            return;
        }

        if (e.key === 'Enter') {
            if (editingMessage) {
                handleEditSubmit();
            } else {
                handleSendMessage();
            }
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
            const recorder = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch {
            addToast({ title: 'Microphone access denied', description: 'Allow microphone access to send voice messages.', variant: 'error' });
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current) {
            // Null out ondataavailable before stopping so stale chunks don't leak into the next recording
            mediaRecorderRef.current.ondataavailable = null;
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
        }
        audioChunksRef.current = [];
        setIsRecording(false);
        setRecordingTime(0);
    };

    const handleSendVoiceNote = async () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;

        // Collect the final chunk and wait for onstop — both inside onstop to guarantee ordering
        const chunks = await new Promise<Blob[]>(resolve => {
            const collected: Blob[] = [...audioChunksRef.current];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) collected.push(e.data); };
            recorder.onstop = () => resolve(collected);
            recorder.stop();
            // Stop tracks AFTER stop() so the encoder can flush its final buffer
            recorder.stream.getTracks().forEach(t => t.stop());
        });
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];

        const durationStr = `0:${recordingTime.toString().padStart(2, '0')}`;
        setIsRecording(false);
        setRecordingTime(0);
        setVoiceExpiry(null);
        setRoomVelocity(prev => Math.min(10, prev + 1.5));

        if (chunks.length === 0 || chunks.reduce((sum, b) => sum + b.size, 0) === 0) {
            addToast({ title: 'Recording too short', description: 'Hold the mic button longer to record a voice message.', variant: 'error' });
            return;
        }

        if (!channelId) return;
        const mimeType = chunks[0]?.type || 'audio/webm';
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(chunks, { type: mimeType });
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, { type: mimeType });

        try {
            const uploaded = await api.files.upload(audioFile, 'attachment');
            const optimisticId = Date.now();
            const expirySnapshot = voiceExpiry;
            setMessages(prev => [...prev, {
                id: optimisticId,
                authorId: currentUserId,
                author: currentUserName || 'You',
                system: false,
                avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                content: '',
                type: 'voice' as const,
                duration: durationStr,
                attachments: [{ id: uploaded.id, url: uploaded.url, filename: audioFile.name, size: audioFile.size, mimeType }],
            }]);
            api.messages.send(channelId, {
                attachmentIds: [uploaded.id],
                ...(expirySnapshot ? { expiresIn: expirySnapshot } : {}),
            }).catch(() => {
                setMessages(prev => prev.filter(m => m.id !== optimisticId));
                addToast({ title: 'Failed to send voice message', variant: 'error' });
            });
        } catch {
            addToast({ title: 'Failed to upload voice message', variant: 'error' });
        }
    };

    const submitPoll = async () => {
        if (!pollQuestion.trim()) {
            addToast({ title: 'Please enter a poll question', variant: 'error' });
            return;
        }
        const validOptions = pollOptions.filter(o => o.trim() !== '');
        if (validOptions.length < 2) {
            addToast({ title: 'Please provide at least 2 options', variant: 'error' });
            return;
        }

        // Try API first
        if (channelId) {
            try {
                const poll = await api.polls.create(channelId, {
                    question: pollQuestion.trim(),
                    options: validOptions.map(o => o.trim()),
                    ...(pollDuration ? { duration: pollDuration } : {}),
                });
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    author: currentUserName,
                    system: false,
                    avatar: (currentUserName || 'Y').charAt(0).toUpperCase(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    content: 'Created a poll',
                    type: 'poll' as const,
                    pollData: {
                        pollId: poll?.id,
                        question: pollQuestion.trim(),
                        options: poll?.options
                            ? poll.options.map((o: any) => ({ id: o.id, text: o.text, votes: o.voteCount ?? 0 }))
                            : validOptions.map((text, i) => ({ id: String(i + 1), text: text.trim(), votes: 0 })),
                        totalVotes: poll?.totalVoters ?? 0,
                        multipleChoice: poll?.multipleChoice ?? false,
                        myVotes: poll?.myVotes ?? [],
                    }
                }]);
                setPollQuestion('');
                setPollOptions(['', '']);
                setPollDuration(null);
                setShowPollCreator(false);
                return;
            } catch {
                addToast({
                    title: 'Could not create poll',
                    description: 'Please try again in a moment.',
                    variant: 'error',
                });
                return;
            }
        }
        addToast({
            title: 'Could not create poll',
            description: 'Missing channel context for poll creation.',
            variant: 'error',
        });
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handlePlaySound = (sound: { name: string, emoji: string }) => {
        playSynthSound(sound.name);
        setMessages(prev => [...prev, {
            id: Date.now(),
            author: 'System',
            system: true,
            avatar: '🔊',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            content: `${currentUserName || 'User'} played ${sound.emoji} ${sound.name}`
        }]);
        setSoundboardOpen(false);
        setRoomVelocity(prev => Math.min(10, prev + 1));
    };

    const bgWarmingOpacity = Math.min(0.15, roomVelocity / 60);

    return (
        <main
            className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`}
            style={{ position: 'relative' }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragOver(false);
                const droppedFiles = e.dataTransfer?.files;
                if (!droppedFiles || droppedFiles.length === 0) return;
                const newFiles = Array.from(droppedFiles).map(f => ({
                    name: f.name,
                    size: f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`,
                    file: f,
                }));
                setChatAttachedFiles(prev => [...prev, ...newFiles]);
            }}
        >
            {/* Drag & Drop Overlay */}
            {isDragOver && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 100,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                    border: '3px dashed var(--accent-primary)',
                    borderRadius: '8px',
                }}>
                    <div style={{
                        background: 'var(--bg-elevated)', padding: '24px 40px',
                        borderRadius: '12px', textAlign: 'center',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}>
                        <ImageIcon size={40} style={{ color: 'var(--accent-primary)', marginBottom: '8px' }} />
                        <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Drop files to upload</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Files will be attached to your message</div>
                    </div>
                </div>
            )}
            <EmojiRain active={isHypeMode} />
            <BackgroundMedia media={bgMedia} />

            {/* Reactive Ambient Background */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: 'var(--accent-primary)',
                opacity: bgWarmingOpacity,
                pointerEvents: 'none',
                transition: 'opacity 1s ease-out',
                zIndex: 0
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1, background: 'transparent', overflow: 'hidden' }}>

            <header className="top-bar">
                {/* Mobile Toggles */}
                <div className="mobile-header-toggles">
                    <Menu size={20} className="mobile-toggle-btn" onClick={toggleGuildRail} />
                    <Hash size={24} style={{ color: 'var(--text-muted)', marginLeft: '8px' }} />
                </div>

                <Hash size={24} className="desktop-hash-icon" style={{ color: 'var(--text-muted)' }} />
                <h2>{channelName}</h2>

                <div style={{ flex: 1 }}></div>

                <div className="unified-top-actions" style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                    {canManageChannel && (
                        <div className="bg-upload-btn action-icon-btn hidden-on-mobile" onClick={() => fileInputRef.current?.click()}>
                            <ImageIcon size={18} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Set Theme</span>
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" onChange={handleUploadBg} />

                    <div
                        className="action-icon-btn hidden-on-mobile"
                        onClick={() => { setShowPinnedPanel(!showPinnedPanel); if (!showPinnedPanel) loadPinnedMessages(); }}
                        style={{ cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Pin size={18} style={{ color: showPinnedPanel ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                    </div>

                    <TopBarActions />

                    <div className="action-divider hidden-on-mobile" style={{ width: '1px', height: '24px', background: 'var(--stroke)' }}></div>

                    <div
                        className="action-icon-btn member-list-toggle-btn"
                        onClick={() => {
                            // Desktop: toggle member list panel; Mobile: toggle sidebar
                            if (window.innerWidth <= 768) {
                                toggleSidebar();
                            } else {
                                const next = !memberListOpen;
                                setMemberListOpen(next);
                                localStorage.setItem('memberListOpen', String(next));
                            }
                        }}
                        style={{ cursor: 'pointer', color: memberListOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                        title="Members"
                    >
                        <Users size={20} />
                    </div>
                </div>
            </header>

            {/* Ctrl+F Search Bar */}
            {showSearchBar && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 16px',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--stroke)',
                    zIndex: 3,
                    position: 'relative',
                }}>
                    <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchInputChange}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') { closeSearch(); return; }
                            if (e.key === 'Enter') {
                                if (e.shiftKey) navigateSearchResult('up');
                                else navigateSearchResult('down');
                                e.preventDefault();
                            }
                        }}
                        placeholder="Search messages in this channel..."
                        style={{
                            flex: 1,
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 10px',
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            outline: 'none',
                        }}
                    />
                    <span style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                        minWidth: '60px',
                        textAlign: 'center',
                    }}>
                        {isSearching ? 'Searching...' :
                            searchQuery.trim() ?
                                searchResults.length > 0 ? `${currentSearchIndex + 1} / ${searchResults.length}` : 'No results'
                                : ''}
                    </span>
                    <button
                        onClick={() => navigateSearchResult('up')}
                        disabled={searchResults.length === 0}
                        style={{
                            background: 'transparent', border: 'none', cursor: searchResults.length > 0 ? 'pointer' : 'default',
                            color: searchResults.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                            padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: searchResults.length > 0 ? 1 : 0.4,
                        }}
                        title="Previous result (Shift+Enter)"
                    >
                        <ChevronUp size={16} />
                    </button>
                    <button
                        onClick={() => navigateSearchResult('down')}
                        disabled={searchResults.length === 0}
                        style={{
                            background: 'transparent', border: 'none', cursor: searchResults.length > 0 ? 'pointer' : 'default',
                            color: searchResults.length > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                            padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: searchResults.length > 0 ? 1 : 0.4,
                        }}
                        title="Next result (Enter)"
                    >
                        <ChevronDown size={16} />
                    </button>
                    <button
                        onClick={closeSearch}
                        style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', padding: '4px', borderRadius: '4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="Close search (Escape)"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Content area wrapper — positions pinned panel between header and input */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', minHeight: 0 }}>
            {showScrollButton && (
                <button
                    onClick={scrollToBottom}
                    style={{
                        position: 'absolute',
                        bottom: '80px',
                        right: '24px',
                        zIndex: 10,
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--accent-primary)',
                        border: '2px solid var(--stroke)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-panel)',
                        color: '#000',
                    }}
                    title="Scroll to bottom"
                >
                    <ChevronDown size={20} />
                </button>
            )}
            <div ref={parentRef} className="message-area" style={{ overflowY: 'auto', zIndex: 2, position: 'relative' }}>
                {!isLoadingMessages && messages.length === 0 && (
                    <EmptyState
                        type="chat"
                        title={`Welcome to #${channelName}`}
                        description="Be the first to say something! This channel is waiting for its first message."
                        actionLabel="Break the ice"
                        onAction={() => {
                            document.querySelector<HTMLInputElement>('.chat-input')?.focus();
                        }}
                    />
                )}

                {isLoadingMessages ? (
                    <SkeletonMessageList count={6} />
                ) : messagesError ? (
                    <ErrorState
                        message="Failed to load messages"
                        description="There was a problem loading the messages for this channel."
                        onRetry={fetchMessages}
                    />
                ) : (
                    <>
                    {isLoadingOlder && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                            <div style={{ width: '20px', height: '20px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        </div>
                    )}
                    {!hasMoreMessages && messages.length > 0 && (
                        <div style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                            Beginning of channel history
                        </div>
                    )}
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                            const msg = messages[virtualRow.index];
                            const prevMsg = messages[virtualRow.index - 1];

                            return (
                                <div
                                    key={virtualRow.key}
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    onClick={(e) => handleMessageShiftClick(e, msg.apiId)}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                        ...(msg.apiId && selectedMessages.has(msg.apiId) ? { background: 'rgba(88, 101, 242, 0.15)', borderLeft: '3px solid var(--accent-primary, #5865f2)' } : {}),
                                    }}
                                >
                                    <MemoizedMessageItem
                                        msg={msg}
                                        prevMsg={prevMsg}
                                        highlightedMessageId={highlightedMessageId}
                                        playingMessageId={playingMessageId}
                                        setPlayingMessageId={setPlayingMessageId}
                                        handleMessageContext={handleMessageContext}
                                        setActiveThreadMessage={setActiveThreadMessage}
                                        activeThreadMessageId={activeThreadMessage?.id ?? null}
                                        isHypeMode={isHypeMode}
                                        onImageClick={(url: string) => setLightboxUrl(url)}
                                        onReply={(r: any) => setReplyingTo(r)}
                                        onProfileClick={(p: any) => setProfilePopover(p)}
                                        onForward={(m: Message) => setForwardingMessage(m)}
                                        onReaction={handleReaction}
                                        channelId={channelId}
                                        customEmojis={guildCustomEmojis}
                                        members={guildMembers}
                                        channels={guildChannelsList}
                                        currentUserId={currentUserId || userProfile?.id || ''}
                                        currentUserAvatarFrame={userProfile?.avatarFrame || 'none'}
                                        currentUserNameplateStyle={userProfile?.nameplateStyle || 'none'}
                                        guildId={guildId}
                                        addToast={addToast}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    </>
                )}
            </div >

            {/* Bulk Delete Action Bar */}
            {selectedMessages.size > 0 && canManageChannel && (
                <div style={{
                    position: 'sticky', bottom: 0,
                    background: 'var(--bg-secondary, #2f3136)',
                    borderTop: '1px solid var(--stroke, #40444b)',
                    padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    zIndex: 50,
                }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {selectedMessages.size} message{selectedMessages.size !== 1 ? 's' : ''} selected
                    </span>
                    <button
                        onClick={handleBulkDelete}
                        style={{
                            padding: '8px 16px', background: 'var(--error, #ed4245)', color: '#fff',
                            border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                        }}
                    >
                        Delete {selectedMessages.size} message{selectedMessages.size !== 1 ? 's' : ''}
                    </button>
                    <button
                        onClick={() => { setSelectedMessages(new Set()); setSelectionMode(false); }}
                        style={{
                            padding: '8px 16px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                            border: '1px solid var(--stroke)', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* Pinned Messages Panel */}
            {showPinnedPanel && (
                <div style={{
                    width: '340px', flexShrink: 0, borderLeft: '1px solid var(--stroke)',
                    background: 'var(--bg-secondary, #2f3136)', display: 'flex', flexDirection: 'column',
                    position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 30,
                }}>
                    <div style={{
                        padding: '16px', borderBottom: '1px solid var(--stroke)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Pinned Messages</h3>
                        <button onClick={() => setShowPinnedPanel(false)} style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', padding: '4px', borderRadius: '4px'
                        }}>
                            <X size={18} />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                        {isLoadingPins ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                                <div style={{ width: '24px', height: '24px', border: '2px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            </div>
                        ) : pinnedMessages.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                                <Pin size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                                <p style={{ fontWeight: 600 }}>No pinned messages</p>
                                <p style={{ fontSize: '13px' }}>Pin important messages to keep them here.</p>
                            </div>
                        ) : (
                            pinnedMessages.map((pin: any) => (
                                <div key={pin.id} style={{
                                    padding: '12px', margin: '4px 0', borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => {
                                    setShowPinnedPanel(false);
                                    const msgEl = document.querySelector(`[data-message-id="${pin.id}"]`);
                                    if (msgEl) {
                                        msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        const localMsg = messages.find(m => m.apiId === pin.id);
                                        if (localMsg) {
                                            setHighlightedMessageId(localMsg.id);
                                            setTimeout(() => setHighlightedMessageId(null), 2500);
                                        }
                                    }
                                }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                                            {(pin.author?.displayName || pin.author?.username || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {pin.author?.displayName || pin.author?.username || 'Unknown'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                            {pin.createdAt ? new Date(pin.createdAt).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                                        {pin.content || '(attachment)'}
                                    </p>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                        <button onClick={(e) => {
                                            e.stopPropagation();
                                            if (channelId && pin.id) {
                                                api.messages.unpin(channelId, pin.id).then(() => {
                                                    setPinnedMessages(prev => prev.filter(p => p.id !== pin.id));
                                                    addToast({ title: 'Message Unpinned', variant: 'success' });
                                                }).catch(() => addToast({ title: 'Failed to unpin', variant: 'error' }));
                                            }
                                        }} style={{
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                            color: 'var(--text-muted)', fontSize: '12px', padding: '4px 8px',
                                            borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--error)')}
                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                                        >
                                            <X size={12} /> Unpin
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            </div>{/* end content area wrapper */}

            <div className="input-area" style={{ zIndex: 2, position: 'relative' }}>
                {slowRemaining > 0 && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px',
                        fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
                        margin: '0 16px 4px', borderRadius: '8px',
                    }}>
                        <Clock size={14} style={{ flexShrink: 0 }} />
                        <span>Slowmode enabled. You can send another message in <strong style={{ color: 'var(--text-primary)' }}>{slowRemaining}s</strong></span>
                    </div>
                )}
                {typingUsers.size > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', paddingLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ display: 'flex', gap: '4px' }}>
                            <span className="typing-dot" style={{ animationDelay: '0ms' }}></span>
                            <span className="typing-dot" style={{ animationDelay: '150ms' }}></span>
                            <span className="typing-dot" style={{ animationDelay: '300ms' }}></span>
                        </span>
                        {(() => {
                            const names = [...typingUsers.values()];
                            if (names.length === 1) return `${names[0]} is typing...`;
                            if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
                            if (names.length <= 4) return `${names[0]}, ${names[1]}, and ${names.length - 2} more are typing...`;
                            return `Multiple people are typing...`;
                        })()}
                    </div>
                )}

                {/* Edit Banner */}
                {editingMessage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--warning, #f59e0b)', margin: '0 16px 4px', borderRadius: '0 8px 8px 0' }}>
                        <Edit2 size={14} style={{ color: 'var(--warning, #f59e0b)', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>Editing message</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{editingMessage.content}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>Esc to cancel</span>
                        <button onClick={() => { setEditingMessage(null); setEditContent(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Scheduled Messages Indicator */}
                {scheduledMessages.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 16px 4px', maxHeight: '100px', overflowY: 'auto' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={12} /> {scheduledMessages.length} scheduled
                        </div>
                        {scheduledMessages.map(sm => (
                            <div key={sm.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', padding: '2px 0' }}>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    "{sm.content.slice(0, 60)}" — {new Date(sm.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <button onClick={() => {
                                    if (!channelId) return;
                                    fetch(`${API_BASE}/api/v1/channels/${channelId}/messages/scheduled/${sm.id}`, {
                                        method: 'DELETE',
                                        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                                    }).then(r => {
                                        if (r.ok) {
                                            setScheduledMessages(prev => prev.filter(s => s.id !== sm.id));
                                            addToast({ title: 'Scheduled message cancelled', variant: 'info' });
                                        }
                                    }).catch(() => {});
                                }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }} title="Cancel">
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Reply Banner */}
                {replyingTo && !editingMessage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent-primary)', margin: '0 16px 4px', borderRadius: '0 8px 8px 0' }}>
                        <Reply size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>Replying to</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{replyingTo.author}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{replyingTo.content}</span>
                        <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Attached file chips */}
                {chatAttachedFiles.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 16px 8px' }}>
                        {chatAttachedFiles.map((f, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <ImageIcon size={12} />
                                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{f.size}</span>
                                <button onClick={() => setChatAttachedFiles(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="chat-input-wrapper" style={{ position: 'relative' }}>

                    {/* Mentions Autocomplete */}
                    {mentionSearch !== null && (
                        <div style={{
                            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '300px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '4px'
                        }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '4px 8px', marginBottom: '4px' }}>
                                Members
                            </div>
                            {filteredUsers.length > 0 ? filteredUsers.map((user, idx) => (
                                <div
                                    key={user.id}
                                    onClick={() => insertMention(user.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: mentionIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                        transition: 'background 0.1s'
                                    }}
                                    onMouseEnter={() => setMentionIndex(idx)}
                                >
                                    <Avatar
                                        userId={user.id}
                                        displayName={user.displayName || user.username}
                                        size={28}
                                    />
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{user.displayName}</span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{user.username}</span>
                                    </div>
                                </div>
                            )) : (
                                <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>No members found</div>
                            )}
                        </div>
                    )}

                    {/* Channel Autocomplete */}
                    {channelSearch !== null && filteredChannels.length > 0 && (
                        <div style={{
                            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-md)', padding: '8px', minWidth: '300px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '4px'
                        }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '4px 8px', marginBottom: '4px' }}>
                                Channels
                            </div>
                            {filteredChannels.slice(0, 8).map((ch, idx) => (
                                <div
                                    key={ch.id}
                                    onClick={() => insertChannelMention(ch.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: channelIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                        transition: 'background 0.1s'
                                    }}
                                    onMouseEnter={() => setChannelIndex(idx)}
                                >
                                    <Hash size={18} style={{ color: 'var(--text-muted)' }} />
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{ch.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <SoundboardMenu
                        isOpen={soundboardOpen}
                        onClose={() => setSoundboardOpen(false)}
                        onPlaySound={handlePlaySound}
                    />

                    {isRecording ? (
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '12px', padding: '0 8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--error)', animation: 'pulse 1.5s infinite', flexShrink: 0 }}></div>
                            <span style={{ color: 'var(--error)', fontWeight: 600, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{formatTime(recordingTime)}</span>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: '24px', opacity: 0.5 }}>
                                {WAVEFORM_HEIGHTS.map((h, i) => (
                                    <div key={i} style={{ width: '4px', height: `${h}px`, background: 'var(--error)', borderRadius: '2px', animation: `pulse ${0.7 + i * 0.1}s infinite alternate` }} />
                                ))}
                            </div>
                            <select
                                value={voiceExpiry ?? ''}
                                onChange={e => setVoiceExpiry(e.target.value ? Number(e.target.value) : null)}
                                style={{ fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-secondary)', padding: '2px 4px', cursor: 'pointer', flexShrink: 0 }}
                                title="Voice message expiry"
                            >
                                <option value="">Never expires</option>
                                <option value={3600}>1 hour</option>
                                <option value={86400}>24 hours</option>
                                <option value={604800}>7 days</option>
                            </select>
                            <button className="input-icon-btn" style={{ color: 'var(--text-secondary)' }} onClick={cancelRecording} title="Cancel">
                                <Square size={18} />
                            </button>
                            <button className="input-icon-btn primary" onClick={handleSendVoiceNote} title="Send voice message">
                                <Send size={18} />
                            </button>
                        </div>
                    ) : (
                        <>
                            <input type="file" multiple ref={chatFileInputRef} hidden onChange={(e) => {
                                const files = e.target.files;
                                if (!files) return;
                                const newFiles = Array.from(files).map(f => ({
                                    name: f.name,
                                    size: f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`,
                                    file: f
                                }));
                                setChatAttachedFiles(prev => [...prev, ...newFiles]);
                                e.target.value = '';
                            }} />
                            <button className="input-icon-btn" title="Upload Attachment" onClick={() => chatFileInputRef.current?.click()}>
                                <Plus size={20} />
                            </button>
                            {hasDraft && !editingMessage && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Draft</span>
                            )}
                            <input
                                type="text"
                                className="chat-input"
                                placeholder={editingMessage ? 'Edit your message...' : `Message #${channelName}...`}
                                value={editingMessage ? editContent : inputValue}
                                onChange={editingMessage ? (e) => setEditContent(e.target.value) : handleInputChange}
                                onKeyDown={handleInputKeyDown}
                            />
                            <button className="input-icon-btn" title="Record Voice Note" onClick={startRecording}>
                                <Mic size={20} />
                            </button>
                            {inputValue.trim().length === 0 && (
                                <>
                                    <button className={`input-icon-btn ${isEmojiPickerOpen ? 'primary' : ''}`} title="Select Emoji" onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}>
                                        <Smile size={20} />
                                    </button>
                                    <button className="input-icon-btn" title="Create Poll" onClick={() => setShowPollCreator(!showPollCreator)}>
                                        <BarChart2 size={20} />
                                    </button>
                                    <button className={`input-icon-btn ${soundboardOpen ? 'primary' : ''}`} title="Soundboard" onClick={() => setSoundboardOpen(!soundboardOpen)}>
                                        <Volume2 size={20} />
                                    </button>
                                </>
                            )}
                            {(editingMessage ? editContent.trim().length > 0 : inputValue.trim().length > 0) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {!editingMessage && (
                                        <button
                                            className="input-icon-btn"
                                            title="Schedule Message"
                                            onClick={() => setIsScheduleOpen(!isScheduleOpen)}
                                            style={{ color: isScheduleOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                        >
                                            <Clock size={18} />
                                        </button>
                                    )}
                                    <button
                                        className="input-icon-btn primary"
                                        onClick={editingMessage ? handleEditSubmit : handleSendMessage}
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Slash Command Picker Popover */}
                    {slashSearch !== null && filteredCommands.length > 0 && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '8px', width: '340px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '300px', overflowY: 'auto' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', padding: '0 8px' }}>COMMANDS</div>
                            {filteredCommands.map((cmd, idx) => (
                                <div
                                    key={cmd.id}
                                    onClick={() => selectSlashCommand(cmd)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: slashIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                    }}
                                >
                                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>/</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>/{cmd.name}</div>
                                        {cmd.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cmd.description}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Emoji Autocomplete Popover */}
                    {emojiSearch !== null && filteredEmojis.length > 0 && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '8px', width: '260px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', padding: '0 8px' }}>EMOJIS MATCHING "{emojiSearch}"</div>
                            {filteredEmojis.map((emoji, idx) => (
                                <div
                                    key={emoji.name}
                                    onClick={() => insertEmoji(emoji.name)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
                                        borderRadius: '6px', cursor: 'pointer',
                                        background: emojiIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                        transition: 'background 0.1s'
                                    }}
                                    onMouseEnter={() => setEmojiIndex(idx)}
                                >
                                    {emoji.isCustom && emoji.url ? (
                                        <img src={emoji.url} alt={emoji.name} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                    ) : (
                                        <span style={{ fontSize: '20px' }}>{emoji.isCustom ? emoji.name : (emoji as any).emoji}</span>
                                    )}
                                    <span style={{ fontSize: '14px', fontWeight: 500 }}>:{emoji.name}:</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Emoji Picker Popover */}
                    {isEmojiPickerOpen && (
                        <EmojiPicker
                            onSelectEmoji={(emoji) => {
                                setInputValue(prev => prev + emoji);
                            }}
                            onSendGif={handleSendGif}
                            onStickerSelect={handleSendSticker}
                            guildId={guildId}
                        />
                    )}

                    {/* Schedule Message Popover */}
                    {isScheduleOpen && (
                        <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', width: '300px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '16px', animation: 'scaleIn 0.2s ease-out' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={16} color="var(--accent-primary)" />
                                    Schedule Message
                                </div>
                                <button onClick={() => setIsScheduleOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Date</label>
                                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', padding: '8px', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Time</label>
                                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', padding: '8px', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                                </div>
                            </div>

                            <button className="auth-button" style={{ margin: 0, padding: '8px 0', height: 'auto', fontSize: '13px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)' }} onClick={() => {
                                if (!channelId || !scheduleDate || !scheduleTime) {
                                    addToast({ title: 'Pick a date and time', variant: 'error' });
                                    return;
                                }
                                const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
                                const processedContent = processEmojis(inputValue);
                                fetch(`${API_BASE}/api/v1/channels/${channelId}/messages`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ content: processedContent || ' ', scheduledAt }),
                                }).then(r => {
                                    if (r.ok) {
                                        r.json().then(sm => {
                                            setScheduledMessages(prev => [...prev, sm]);
                                            addToast({ title: 'Message scheduled', variant: 'success' });
                                        });
                                    } else {
                                        addToast({ title: 'Failed to schedule', variant: 'error' });
                                    }
                                }).catch(() => addToast({ title: 'Failed to schedule', variant: 'error' }));
                                setIsScheduleOpen(false);
                                setInputValue('');
                                setScheduleDate('');
                                setScheduleTime('');
                                setHasDraft(false);
                                if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
                            }}>
                                Schedule Message
                            </button>
                        </div>
                    )}

                    {showPollCreator && (
                        <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            right: '80px',
                            marginBottom: '8px',
                            width: '360px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            zIndex: 100,
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    <BarChart2 size={16} color="var(--accent-primary)" />
                                    Create Poll
                                </div>
                                <button onClick={() => setShowPollCreator(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>Question</label>
                                <input
                                    type="text"
                                    value={pollQuestion}
                                    onChange={e => setPollQuestion(e.target.value)}
                                    placeholder="Ask a question..."
                                    style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Options</label>
                                {pollOptions.map((option, index) => (
                                    <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={e => {
                                                const updated = [...pollOptions];
                                                updated[index] = e.target.value;
                                                setPollOptions(updated);
                                            }}
                                            placeholder={`Option ${index + 1}`}
                                            style={{ flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', padding: '8px 10px', borderRadius: 'var(--radius-md)', fontSize: '13px', outline: 'none' }}
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {pollOptions.length < 6 && (
                                    <button
                                        onClick={() => setPollOptions([...pollOptions, ''])}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px dashed var(--stroke)', color: 'var(--text-secondary)', padding: '8px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', justifyContent: 'center' }}
                                    >
                                        <Plus size={14} />
                                        Add Option
                                    </button>
                                )}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>Poll Duration</label>
                                <select
                                    value={pollDuration ?? ''}
                                    onChange={e => setPollDuration(e.target.value ? Number(e.target.value) : null)}
                                    style={{ width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                                >
                                    <option value="">No expiry</option>
                                    <option value={60}>1 hour</option>
                                    <option value={60 * 6}>6 hours</option>
                                    <option value={60 * 24}>24 hours</option>
                                    <option value={60 * 24 * 3}>3 days</option>
                                    <option value={60 * 24 * 7}>7 days</option>
                                </select>
                            </div>

                            <button
                                onClick={submitPoll}
                                style={{ background: 'var(--accent-primary)', border: 'none', color: 'white', padding: '8px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                            >
                                Create Poll
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {
                activeThreadMessage && channelId && (
                    <ThreadPanel
                        originalMessage={activeThreadMessage}
                        channelId={channelId}
                        onClose={() => setActiveThreadMessage(null)}
                    />
                )
            }

            {profilePopover && (
                <UserProfilePopover
                    user={{
                        id: profilePopover.userId,
                        name: profilePopover.user,
                        handle: profilePopover.user.toLowerCase().replace(/\s+/g, '_'),
                        status: 'online',
                        guildId: guildId,
                    }}
                    position={{ x: profilePopover.x, y: profilePopover.y }}
                    onClose={() => setProfilePopover(null)}
                    onMessage={async () => {
                        const userId = profilePopover.userId;
                        setProfilePopover(null);
                        if (userId) {
                            try {
                                const dm = await api.relationships.openDm(userId) as any;
                                navigate(`/dm/${dm.id}`);
                            } catch {
                                addToast({ title: 'Failed to open DM', variant: 'error' });
                            }
                        }
                    }}
                    onAddFriend={async () => {
                        const userId = profilePopover.userId;
                        setProfilePopover(null);
                        if (userId) {
                            try {
                                await api.relationships.sendFriendRequest(userId);
                                addToast({ title: 'Friend request sent!', variant: 'success' });
                            } catch {
                                addToast({ title: 'Failed to send friend request', variant: 'error' });
                            }
                        }
                    }}
                />
            )}

            {/* Image Lightbox */}
            {lightboxUrl && (
                <div onClick={() => setLightboxUrl(null)} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9000, cursor: 'zoom-out'
                }}>
                    <button onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }} style={{
                        position: 'absolute', top: '24px', right: '24px',
                        background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
                        width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'white', backdropFilter: 'blur(8px)',
                        transition: 'background 0.2s'
                    }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')} onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}>
                        <X size={20} />
                    </button>
                    <img
                        src={lightboxUrl}
                        alt="Enlarged"
                        onClick={e => e.stopPropagation()}
                        style={{
                            maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
                            borderRadius: '8px', cursor: 'default',
                            boxShadow: '0 32px 80px rgba(0,0,0,0.6)'
                        }}
                    />
                </div>
            )}

            {/* Member List Panel */}
            {memberListOpen && guildId && (
                <div style={{
                    position: 'absolute', right: 0, top: '64px', bottom: 0, zIndex: 4,
                    width: '240px',
                }}>
                    <MemberListPanel
                        guildId={guildId}
                        onMemberClick={(userId, displayName, e) => {
                            setProfilePopover({
                                userId,
                                user: displayName,
                                x: e.clientX,
                                y: e.clientY,
                            });
                        }}
                    />
                </div>
            )}

            {/* Forward Modal */}
            {forwardingMessage && (
                <ForwardModal
                    message={{ author: forwardingMessage.author, content: forwardingMessage.content, mediaUrl: forwardingMessage.mediaUrl }}
                    onClose={() => setForwardingMessage(null)}
                    onForward={(destinations, note) => {
                        addToast({ title: 'Message Forwarded', description: `Sent to ${destinations.length} destination${destinations.length > 1 ? 's' : ''}`, variant: 'success' });
                        setForwardingMessage(null);
                    }}
                />
            )}

            </div>
        </main >
    );
};

export default ChannelChat;
