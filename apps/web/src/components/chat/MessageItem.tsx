import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import {
    Reply, Smile, Image as ImageIcon, Share2, FileText,
    Pause, MessageSquare, MoreHorizontal, Plus, Mic, Play,
    ThumbsUp, Star, Edit2, Eye, Zap, Code
} from 'lucide-react';
import { API_BASE } from '../../lib/api';
import { api } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import { userQueryKey } from '../../hooks/queries/useUserQuery';
import Avatar from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';
import { RichTextRenderer } from './RichTextRenderer';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import ChatPoll from './ChatPoll';
import { LazyEmbed, OgEmbed } from './EmbedCard';
import { RichEmbedCard, RichEmbed } from './RichEmbedCard';
import { MessageComponents } from './MessageComponents';
import { MessageLinkPreview } from './MessageLinkPreview';
import EditHistoryPopover from './EditHistoryPopover';
import EmbeddedWidget from './EmbeddedWidget';
import { SlowClapReaction } from './SlowClapReaction';
import { ReactionBadge } from './ReactionBar';
import TextReaction from './TextReaction';
import { Languages, Timer } from 'lucide-react';
import { Loader2 as Loader2Icon } from 'lucide-react';

import type { Message, Attachment } from './chatTypes';

/** Item 91: Auto-collapse long messages */
const CollapsibleMessage = ({ content, threshold = 10, children }: { content: string; threshold?: number; children: React.ReactNode }) => {
    const [collapsed, setCollapsed] = useState(true);
    const lineCount = (content || '').split('\n').length;
    const isLong = lineCount > threshold;

    if (!isLong) {
        return <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{children}</div>;
    }

    return (
        <div style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: '1.5', position: 'relative' }}>
            <div style={{
                maxHeight: collapsed ? `${threshold * 1.5}em` : 'none',
                overflow: 'hidden',
                transition: 'max-height 0.3s ease',
            }}>
                {children}
            </div>
            {collapsed && (
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: '3em',
                    background: 'linear-gradient(transparent, var(--bg-primary))',
                    pointerEvents: 'none',
                }} />
            )}
            <button
                onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
                style={{
                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                    borderRadius: '4px', padding: '2px 10px', fontSize: '11px', fontWeight: 600,
                    color: 'var(--accent-primary)', cursor: 'pointer', marginTop: collapsed ? '-8px' : '4px',
                    position: 'relative', zIndex: 1,
                }}
            >
                {collapsed ? `Show more (${lineCount} lines)` : 'Show less'}
            </button>
        </div>
    );
};

/** Disappearing message countdown component */
const DisappearCountdown = ({ expiresAt }: { expiresAt: string }) => {
    const [remaining, setRemaining] = useState('');
    useEffect(() => {
        const tick = () => {
            const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
            if (diff <= 0) { setRemaining('expiring...'); return; }
            if (diff < 60) setRemaining(`${diff}s`);
            else if (diff < 3600) setRemaining(`${Math.floor(diff / 60)}m`);
            else if (diff < 86400) setRemaining(`${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`);
            else setRemaining(`${Math.floor(diff / 86400)}d ${Math.floor((diff % 86400) / 3600)}h`);
        };
        tick();
        const iv = setInterval(tick, 1000);
        return () => clearInterval(iv);
    }, [expiresAt]);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
            <Timer size={10} />
            <span>Disappears in {remaining}</span>
        </div>
    );
};

// Inline code file preview component
const CodeFilePreview = ({ url, filename, sizeStr }: { url: string; filename: string; sizeStr: string }) => {
    const [code, setCode] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error('fetch failed');
                return r.text();
            })
            .then(text => setCode(text.slice(0, 8000)))
            .catch(() => setLoadError(true));
    }, [url]);

    const ext = filename.split('.').pop()?.toLowerCase() || '';

    if (loadError || code === null) {
        return (
            <a href={url} download={filename} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', background: 'var(--bg-tertiary)',
                border: '1px solid var(--stroke)', borderRadius: '8px',
                textDecoration: 'none', color: 'var(--text-primary)',
                maxWidth: '320px', cursor: 'pointer',
            }}>
                <FileText size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--accent-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{loadError ? 'Preview unavailable' : 'Loading...'} · {sizeStr}</div>
                </div>
            </a>
        );
    }

    const lines = code.split('\n');
    const displayLines = collapsed ? [] : lines.slice(0, 25);
    const truncated = lines.length > 25;

    return (
        <div style={{ maxWidth: '520px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Code size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{sizeStr}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: 0 }}>{collapsed ? 'Expand' : 'Collapse'}</button>
                    <a href={url} download={filename} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '12px', textDecoration: 'none', fontWeight: 500 }}>Download</a>
                </div>
            </div>
            {!collapsed && (
                <pre style={{ margin: 0, padding: '10px 12px', fontSize: '12px', lineHeight: '1.5', fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)', overflowX: 'auto', maxHeight: '350px', overflowY: 'auto', whiteSpace: 'pre' }}>
                    <code>{displayLines.map((line, i) => (
                        <div key={i} style={{ display: 'flex' }}>
                            <span style={{ color: 'var(--text-muted)', minWidth: '3ch', textAlign: 'right', marginRight: '12px', userSelect: 'none', flexShrink: 0, opacity: 0.6 }}>{i + 1}</span>
                            <span>{line}</span>
                        </div>
                    ))}</code>
                    {truncated && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', marginTop: '4px', paddingLeft: '3ch' }}>
                            ... {lines.length - 25} more lines
                        </div>
                    )}
                </pre>
            )}
        </div>
    );
};

export const MemoizedMessageItem = memo(({
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
    onReplyHighlight,
    onUserContext,
    channelId: msgChannelId,
    customEmojis,
    members,
    channels,
    currentUserId,
    currentUsername,
    currentUserAvatarFrame,
    currentUserNameplateStyle,
    guildId,
    addToast,
    compactMode,
    isNewMessageDivider,
    decryptedFileUrls = new Map(),
    editingMessageApiId,
    editContent,
    setEditContent,
    onEditSubmit,
    onEditCancel,
}: any) => {
    const isBeingEdited = editingMessageApiId === msg.apiId;
    const inlineEditRef = useRef<HTMLTextAreaElement>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [famGiven, setFamGiven] = useState(false);
    const [showFameSparkle, setShowFameSparkle] = useState(false);
    const [fameLoading, setFameLoading] = useState(false);
    const fameSparkleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showReactionPicker, setShowReactionPicker] = useState(false);
    const reactionPickerRef = useRef<HTMLDivElement>(null);
    const avatarRef = useRef<HTMLDivElement>(null);
    const [translatedText, setTranslatedText] = useState<string | null>(null);
    const [translatedLang, setTranslatedLang] = useState<string | null>(null);
    const [translating, setTranslating] = useState(false);
    const userPrefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prefetchUserOnEnter = useCallback(() => {
        if (!msg.authorId || msg.system) return;
        userPrefetchTimer.current = setTimeout(() => {
            queryClient.prefetchQuery({
                queryKey: userQueryKey(msg.authorId),
                queryFn: () => api.users.get(msg.authorId),
                staleTime: 60_000,
            });
        }, 200);
    }, [msg.authorId, msg.system]);
    const cancelUserPrefetch = useCallback(() => {
        if (userPrefetchTimer.current) { clearTimeout(userPrefetchTimer.current); userPrefetchTimer.current = null; }
    }, []);

    useEffect(() => {
        return () => { if (fameSparkleTimerRef.current) clearTimeout(fameSparkleTimerRef.current); };
    }, []);

    // Auto-focus and auto-resize inline edit textarea
    useEffect(() => {
        if (isBeingEdited && inlineEditRef.current) {
            const ta = inlineEditRef.current;
            ta.focus();
            ta.selectionStart = ta.selectionEnd = ta.value.length;
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }
    }, [isBeingEdited]);

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

    const quickReactions = ['👍', '❤️', '😂', '🔥', '👀', '🎉', '😮', '💯', '\u{1F44F}'];
    // Use reactions from message props (persisted via API), fall back to empty
    const reactions: Array<{ emoji: string; emojiUrl?: string; isCustom?: boolean; count: number; me: boolean }> = msg.reactions || [];

    const handleGiveFAME = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (msg.system || !msg.authorId || fameLoading) return;
        if (famGiven) return;
        if (msg.authorId === currentUserId) return;
        setFameLoading(true);
        try {
            if (!guildId) return;
            await api.fame.give(msg.authorId, { messageId: msg.apiId, guildId });
            setFamGiven(true);
            setShowFameSparkle(true);
            if (fameSparkleTimerRef.current) clearTimeout(fameSparkleTimerRef.current);
            fameSparkleTimerRef.current = setTimeout(() => { fameSparkleTimerRef.current = null; setShowFameSparkle(false); }, 1400);
        } catch (err: any) {
            const errMsg = err?.message || 'Failed to give FAME';
            addToast?.({ title: errMsg, variant: 'error' });
        } finally {
            setFameLoading(false);
        }
    };

    const isGrouped = !!(prevMsg &&
        !msg.system && !prevMsg.system &&
        !msg.replyToId &&
        (msg.authorId && prevMsg.authorId ? msg.authorId === prevMsg.authorId : prevMsg.author === msg.author) &&
        msg.createdAt && prevMsg.createdAt &&
        new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000);

    // Feature 3 + Item 87: Mention highlight detection (personal + @everyone/@here/@channel/@online)
    const isMentioned = Boolean(
        msg.content && (
            (currentUserId && currentUsername && (
                msg.content.includes(`@${currentUsername}`) ||
                msg.content.includes(`<@${currentUserId}>`)
            )) ||
            msg.content.includes('@everyone') ||
            msg.content.includes('@here') ||
            msg.content.includes('@channel') ||
            msg.content.includes('@online')
        )
    );
    const isEveryoneMention = Boolean(msg.content && (msg.content.includes('@everyone') || msg.content.includes('@here') || msg.content.includes('@channel') || msg.content.includes('@online')));
    const isPersonalMention = Boolean(
        currentUserId && currentUsername && msg.content && (
            msg.content.includes(`@${currentUsername}`) ||
            msg.content.includes(`<@${currentUserId}>`)
        )
    );

    // Check if message is newly added (runtime messages use Date.now() IDs)
    const isNew = msg.id > 100000 && (Date.now() - msg.id < 5000);
    const isCurrentUserMessage = Boolean(msg.authorId && currentUserId && msg.authorId === currentUserId);
    const msgDivRef = useRef<HTMLDivElement>(null);
    const isHighlighted = highlightedMessageId === msg.id;

    // GSAP highlight bar slide-in
    useEffect(() => {
        const el = msgDivRef.current;
        if (!el || !isHighlighted) return;
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) return;

        // Create a highlight bar element
        const bar = document.createElement('div');
        bar.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent-primary);border-radius:0 2px 2px 0;transform:scaleY(0);transform-origin:top;z-index:1;';
        el.style.position = 'relative';
        el.appendChild(bar);

        gsap.to(bar, { scaleY: 1, duration: 0.3, ease: 'power2.out' });
        gsap.to(el, { backgroundColor: 'var(--accent-primary-alpha)', duration: 0.3, ease: 'power2.out' });

        // Fade out after 1.5s
        gsap.to(bar, { scaleY: 0, duration: 0.4, ease: 'power2.in', delay: 1.5 });
        gsap.to(el, { backgroundColor: 'transparent', duration: 0.4, ease: 'power2.in', delay: 1.5, onComplete: () => { bar.remove(); } });
    }, [isHighlighted]);

    return (
        <React.Fragment>
            {isNewMessageDivider && (
                <div className="new-messages-divider" style={{
                    display: 'flex', alignItems: 'center', margin: '17px 0 4px', padding: '0 16px', position: 'relative',
                }}>
                    <div style={{ flex: 1, height: '1px', background: '#ed4245' }}></div>
                    <span style={{
                        color: '#ed4245', fontSize: '11px', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1,
                        padding: '0 0 0 4px', flexShrink: 0,
                    }}>
                        NEW
                    </span>
                </div>
            )}
            <motion.div
                ref={msgDivRef}
                layout
                initial={isNew ? { opacity: 0, y: 20, scale: 0.98 } : false}
                animate={{ opacity: msg.sendStatus === 'sending' ? 0.6 : msg.sendStatus === 'failed' ? 0.75 : 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`message ${isGrouped ? 'grouped message-grouped' : 'message-standalone'} ${isHighlighted ? 'highlighted-message' : ''} ${activeThreadMessageId === msg.id ? 'active-thread-message' : ''} ${isMentioned ? 'mentioned-message' : ''} ${compactMode ? 'compact-message' : ''}`}
                data-message-id={msg.apiId}
                style={{
                    position: 'relative',
                    marginTop: isGrouped ? '2px' : (compactMode ? '1px' : '16px'),
                    paddingTop: isGrouped ? '2px' : (compactMode ? '2px' : '16px'),
                    paddingBottom: isGrouped ? '2px' : (compactMode ? '2px' : '16px'),
                    ...(isPersonalMention ? { borderLeft: '3px solid var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' }
                      : isEveryoneMention ? { borderLeft: '3px solid #f59e0b', background: 'rgba(245, 158, 11, 0.06)' }
                      : {}),
                }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onContextMenu={(e) => handleMessageContext(e, msg)}
                onDoubleClick={() => { if (msg.apiId && msgChannelId && !msg.system) { const alreadyHearted = (msg.reactions || []).some((r: any) => r.emoji === '❤️' && r.me); onReaction(msg.apiId, '❤️', alreadyHearted); } }}
            >
                {compactMode ? (
                    /* Feature 13: Compact mode - no avatar, inline timestamp */
                    null
                ) : isGrouped ? (
                    <div style={{ width: '40px', flexShrink: 0, position: 'relative' }}>
                        <Tooltip content={msg.createdAt ? new Date(msg.createdAt).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : msg.time} position="top" delay={200}>
                            <span style={{
                                position: 'absolute', right: '0', top: '2px',
                                fontSize: '10px', color: 'var(--text-muted)',
                                opacity: isHovered ? 1 : 0.4,
                                transition: 'opacity 0.2s'
                            }}>
                                {msg.time.split(' ')[0]}
                            </span>
                        </Tooltip>
                    </div>
                ) : (
                    <div
                        style={{ position: 'relative', flexShrink: 0, cursor: msg.system ? 'default' : 'pointer' }}
                        ref={avatarRef}
                        onClick={(e) => { if (!msg.system) onProfileClick?.({ user: msg.author, userId: msg.authorId || '', x: e.clientX, y: e.clientY }); }}
                        onContextMenu={(e) => { if (!msg.system && msg.authorId) onUserContext?.(e, msg.authorId, msg.author); }}
                        onMouseEnter={prefetchUserOnEnter}
                        onMouseLeave={cancelUserPrefetch}
                    >
                        {typeof msg.avatar === 'string' ? (
                            <Avatar
                                userId={msg.authorId || String(msg.id)}
                                displayName={msg.author}
                                avatarHash={msg.authorAvatarHash}
                                frame={isCurrentUserMessage ? currentUserAvatarFrame : 'none'}
                                size={40}
                                style={{
                                    boxShadow: showFameSparkle ? '0 0 0 3px var(--warning), 0 0 20px color-mix(in srgb, var(--warning) 60%, transparent)' : undefined,
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
                                background: 'var(--warning)', borderRadius: '50%',
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
                    {compactMode ? (
                        /* Feature 13: Compact mode header — timestamp inline before author */
                        (!isGrouped || compactMode) && (
                            <div className="msg-header" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <Tooltip content={msg.createdAt ? new Date(msg.createdAt).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : msg.time} position="top" delay={200}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{msg.time}</span>
                                </Tooltip>
                                <span
                                    className={`msg-author ${msg.system ? 'system' : ''} ${msg.authorNameplateStyle && msg.authorNameplateStyle !== 'none' ? `nameplate-${msg.authorNameplateStyle}` : (isCurrentUserMessage && currentUserNameplateStyle && currentUserNameplateStyle !== 'none' ? `nameplate-${currentUserNameplateStyle}` : '')}`}
                                    onClick={(e) => { if (!msg.system) onProfileClick?.({ user: msg.author, userId: msg.authorId || '', x: e.clientX, y: e.clientY }); }}
                                    onContextMenu={(e) => { if (!msg.system && msg.authorId) onUserContext?.(e, msg.authorId, msg.author); }}
                                    onMouseEnter={prefetchUserOnEnter}
                                    onMouseLeave={cancelUserPrefetch}
                                    style={{ cursor: msg.system ? 'default' : 'pointer', color: msg.authorRoleColor || undefined, fontSize: '13px' }}
                                >
                                    {msg.author}{msg.isBot && <span style={{ display: 'inline-block', marginLeft: '4px', background: 'var(--accent-primary)', color: '#000', fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', verticalAlign: 'middle', letterSpacing: '0.5px', lineHeight: '14px' }}>BOT</span>}:
                                </span>
                            </div>
                        )
                    ) : (
                        !isGrouped && (
                            <div className="msg-header">
                                <span
                                    className={`msg-author ${msg.system ? 'system' : ''} ${msg.authorNameplateStyle && msg.authorNameplateStyle !== 'none' ? `nameplate-${msg.authorNameplateStyle}` : (isCurrentUserMessage && currentUserNameplateStyle && currentUserNameplateStyle !== 'none' ? `nameplate-${currentUserNameplateStyle}` : '')}`}
                                    onClick={(e) => { if (!msg.system) onProfileClick?.({ user: msg.author, userId: msg.authorId || '', x: e.clientX, y: e.clientY }); }}
                                    onContextMenu={(e) => { if (!msg.system && msg.authorId) onUserContext?.(e, msg.authorId, msg.author); }}
                                    onMouseEnter={prefetchUserOnEnter}
                                    onMouseLeave={cancelUserPrefetch}
                                    style={{ cursor: msg.system ? 'default' : 'pointer', color: msg.authorRoleColor || undefined }}
                                >
                                    {msg.author}
                                </span>
                                <Tooltip content={msg.createdAt ? new Date(msg.createdAt).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : msg.time} position="top" delay={200}>
                                    <span className="msg-timestamp">{msg.time}</span>
                                </Tooltip>
                            </div>
                        )
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
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                onReplyHighlight?.(msg.replyToId);
                            }
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
                                ? <VoiceMessagePlayer url={msg.attachments[0].url} duration={msg.duration} />
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
                                {msg.content && msg.content !== msg.mediaUrl && (
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
                                    <img src={msg.mediaUrl} alt="Attached Media" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            </div>
                        ) : isBeingEdited ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                <textarea
                                    ref={inlineEditRef}
                                    value={editContent}
                                    onChange={(e) => {
                                        setEditContent(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            e.stopPropagation();
                                            onEditCancel?.();
                                        } else if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onEditSubmit?.();
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--accent-primary)',
                                        borderRadius: '6px',
                                        color: 'var(--text-primary)',
                                        fontSize: '15px',
                                        lineHeight: '1.5',
                                        padding: '8px 10px',
                                        resize: 'none',
                                        overflow: 'hidden',
                                        fontFamily: 'inherit',
                                        outline: 'none',
                                        minHeight: '38px',
                                    }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                    <span>escape to <button onClick={onEditCancel} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: '11px', fontFamily: 'inherit', textDecoration: 'underline' }}>cancel</button></span>
                                    <span style={{ margin: '0 2px' }}>·</span>
                                    <span>enter to <button onClick={onEditSubmit} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: '11px', fontFamily: 'inherit', textDecoration: 'underline' }}>save</button></span>
                                </div>
                            </div>
                        ) : (
                            <CollapsibleMessage content={msg.content} threshold={10}>
                                <RichTextRenderer content={msg.content} customEmojis={customEmojis} members={members} channels={channels} />
                                {msg.edited && msg.apiId && msgChannelId && <EditHistoryPopover channelId={msgChannelId} messageApiId={msg.apiId} />}
                                {/* Item 90: Inline message link previews */}
                                {msg.content && (() => {
                                    const linkMatches = msg.content.match(/channels\/[a-f0-9-]+(?:\/messages\/|#)[a-f0-9-]+/gi);
                                    if (!linkMatches) return null;
                                    return linkMatches.map((url: string, li: number) => (
                                        <MessageLinkPreview key={li} messageUrl={url} />
                                    ));
                                })()}
                            </CollapsibleMessage>
                        )}
                        {/* Attachment rendering — skip duplicates of mediaUrl */}
                        {msg.attachments && msg.attachments.length > 0 && (() => {
                            const filteredAttachments = msg.attachments.filter((att: Attachment) => att.url !== msg.mediaUrl);
                            if (filteredAttachments.length === 0) return null;
                            return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                {filteredAttachments.map((att: Attachment) => {
                                    // Use decrypted file URL if available (E2E encrypted file)
                                    const decFile = decryptedFileUrls.get(att.id);
                                    const displayUrl = decFile?.url || att.url;
                                    const displayName = decFile?.filename || att.filename;
                                    const displayMime = decFile?.mimeType || att.mimeType;
                                    // If encrypted but not yet decrypted, show loading state
                                    if (msg.isEncrypted && !decFile && att.mimeType === 'application/octet-stream') {
                                        return (
                                            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', maxWidth: '320px' }}>
                                                <Loader2Icon size={16} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                                                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Decrypting file...</span>
                                            </div>
                                        );
                                    }
                                    const isImage = displayMime?.startsWith('image/');
                                    const isVideo = displayMime?.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(displayName);
                                    const isAudio = displayMime?.startsWith('audio/') || /\.(mp3|wav|flac|m4a|aac)$/i.test(displayName);
                                    const isSticker = att.type === 'sticker';
                                    if (isSticker) {
                                        return (
                                            <img key={att.id} src={displayUrl} alt={displayName} loading="lazy" decoding="async" width={160} height={160} style={{ width: '160px', height: '160px', objectFit: 'contain' }} />
                                        );
                                    }
                                    if (isImage) {
                                        return (
                                            <div key={att.id} className="chat-media-attachment" onClick={() => onImageClick?.(displayUrl)} style={{
                                                maxWidth: '400px', borderRadius: '8px', overflow: 'hidden',
                                                border: '1px solid var(--stroke)', cursor: 'pointer',
                                                background: 'var(--bg-tertiary)',
                                            }}>
                                                <img src={displayUrl} alt={displayName} loading="lazy" decoding="async" style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: '350px' }} />
                                            </div>
                                        );
                                    }
                                    if (isVideo) {
                                        return (
                                            <video
                                                key={att.id}
                                                controls
                                                preload="metadata"
                                                src={displayUrl}
                                                style={{ maxWidth: '400px', borderRadius: '8px', display: 'block' }}
                                                onPlay={(e) => {
                                                    const video = e.currentTarget;
                                                    if (document.pictureInPictureEnabled && !document.pictureInPictureElement) {
                                                        // Set up IntersectionObserver for PiP
                                                        const observer = new IntersectionObserver((entries) => {
                                                            entries.forEach(entry => {
                                                                if (!entry.isIntersecting && !video.paused && document.pictureInPictureEnabled) {
                                                                    video.requestPictureInPicture().catch(() => {});
                                                                }
                                                            });
                                                        }, { threshold: 0.5 });
                                                        observer.observe(video);
                                                        video.dataset.pipObserver = 'true';
                                                        const cleanup = () => { observer.disconnect(); video.removeEventListener('pause', cleanup); video.removeEventListener('ended', cleanup); };
                                                        video.addEventListener('pause', cleanup);
                                                        video.addEventListener('ended', cleanup);
                                                    }
                                                }}
                                            />
                                        );
                                    }
                                    if (isAudio) {
                                        return (
                                            <audio key={att.id} controls src={displayUrl} style={{ width: '100%', maxWidth: '400px' }} />
                                        );
                                    }
                                    const sizeStr = att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${(att.size / 1024).toFixed(1)} KB` : `${(att.size / 1048576).toFixed(1)} MB`;
                                    const isPdf = displayMime === 'application/pdf' || /\.pdf$/i.test(displayName);
                                    const codeExts = /\.(js|jsx|ts|tsx|py|rb|go|rs|java|c|cpp|h|hpp|cs|swift|kt|sh|bash|zsh|yml|yaml|json|toml|xml|html|css|scss|sass|less|sql|md|txt|log|ini|cfg|conf|env|dockerfile|makefile)$/i;
                                    const isCode = codeExts.test(displayName) || displayMime?.startsWith('text/') || displayMime === 'application/json' || displayMime === 'application/xml';
                                    if (isPdf) {
                                        return (
                                            <div key={att.id} style={{ maxWidth: '480px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--stroke)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                        <FileText size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                                                        <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>{sizeStr}</span>
                                                    </div>
                                                    <a href={displayUrl} download={displayName} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontSize: '12px', textDecoration: 'none', flexShrink: 0, fontWeight: 500 }}>Open</a>
                                                </div>
                                                <iframe src={displayUrl} style={{ width: '100%', height: '400px', border: 'none', background: 'var(--bg-primary)' }} title={displayName} />
                                            </div>
                                        );
                                    }
                                    if (isCode) {
                                        return (
                                            <CodeFilePreview key={att.id} url={displayUrl} filename={displayName} sizeStr={sizeStr} />
                                        );
                                    }
                                    return (
                                        <a key={att.id} href={displayUrl} download={displayName} target="_blank" rel="noopener noreferrer" style={{
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
                                                    {displayName}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sizeStr}</div>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                            );
                        })()}
                        {/* Translated text */}
                        {translatedText && (
                            <div style={{
                                marginTop: '6px', padding: '8px 12px',
                                background: 'rgba(var(--accent-primary-rgb, 99,102,241), 0.08)',
                                borderLeft: '3px solid var(--accent-primary)',
                                borderRadius: '0 6px 6px 0',
                                fontSize: '14px', fontStyle: 'italic',
                                color: 'var(--text-secondary)', lineHeight: '1.5',
                            }}>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
                                    Translated from {translatedLang || 'Unknown'}
                                </div>
                                <RichTextRenderer content={translatedText} customEmojis={customEmojis} members={members} channels={channels} />
                            </div>
                        )}
                        {/* URL Embeds + Rich Bot Embeds */}
                        {msg.embeds && msg.embeds.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                {msg.embeds.map((embed: any, i: number) =>
                                    embed.type === 'rich'
                                        ? <RichEmbedCard key={i} embed={embed as RichEmbed} />
                                        : <LazyEmbed key={i} embed={embed as OgEmbed} />
                                )}
                            </div>
                        )}
                        {/* Message Components (buttons, select menus) */}
                        {msg.components && Array.isArray(msg.components) && msg.components.length > 0 && (
                            <MessageComponents components={msg.components} channelId={msgChannelId!} messageId={msg.id} />
                        )}
                        {msg.widgetData && (
                            <EmbeddedWidget type={msg.widgetData.type} data={msg.widgetData.data} />
                        )}
                        {/* Reaction badges */}
                        {reactions.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                                {reactions.map((r: any) => (
                                    <ReactionBadge key={r.emoji} emoji={r.emoji} emojiUrl={r.emojiUrl} isCustom={r.isCustom} count={r.count} me={r.me} messageApiId={msg.apiId} channelId={msgChannelId} onReaction={onReaction} />
                                ))}
                            </div>
                        )}
                        {/* Text Reactions */}
                        {msg.apiId && msgChannelId && !msg.system && (
                            <TextReaction messageId={msg.apiId} channelId={msgChannelId} guildId={guildId} currentUserId={currentUserId} />
                        )}
                        {/* Disappearing message countdown */}
                        {msg.expiresAt && (
                            <DisappearCountdown expiresAt={msg.expiresAt} />
                        )}
                        {/* Optimistic send status indicator */}
                        {msg.sendStatus === 'sending' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <div style={{ width: '10px', height: '10px', border: '1.5px solid var(--text-muted)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                Sending...
                            </div>
                        )}
                        {msg.sendStatus === 'failed' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '11px', color: '#ef4444' }}>
                                <span>Failed to send.</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); (window as any).__gratoniteRetryMessage?.(msg.id); }}
                                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', fontWeight: 600, textDecoration: 'underline', padding: 0 }}
                                >Retry</button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); (window as any).__gratoniteDismissMessage?.(msg.id); }}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                                >Dismiss</button>
                            </div>
                        )}
                        {/* Thread reply count — auto-collapse at 3+ */}
                        {(msg.threadReplyCount ?? 0) > 0 && (
                            <div
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                    marginTop: '4px', cursor: 'pointer', color: 'var(--accent-primary)',
                                    fontSize: '12px', fontWeight: 600,
                                    padding: '4px 8px',
                                    background: (msg.threadReplyCount ?? 0) >= 3 ? 'rgba(var(--accent-primary-rgb, 99,102,241), 0.08)' : 'transparent',
                                    borderRadius: '6px',
                                    transition: 'background 0.15s',
                                }}
                                onClick={() => setActiveThreadMessage?.(msg)}
                                className="thread-reply-btn"
                            >
                                <MessageSquare size={12} />
                                {(msg.threadReplyCount ?? 0) >= 3
                                    ? `View ${msg.threadReplyCount} replies`
                                    : `${msg.threadReplyCount} ${msg.threadReplyCount === 1 ? 'reply' : 'replies'}`
                                }
                            </div>
                        )}
                    </div>
                </div>
                {/* Reaction Picker Popup */}
                {showReactionPicker && (
                    <div ref={reactionPickerRef} style={{ position: 'absolute', top: '-44px', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '20px', padding: '4px 8px', display: 'flex', gap: '2px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 20 }}>
                        {quickReactions.map(qEmoji => (
                            qEmoji === '\u{1F44F}' ? (
                                <SlowClapReaction key={qEmoji} onClap={() => { onReaction?.(msg.apiId, qEmoji, false); setShowReactionPicker(false); }} />
                            ) : (
                                <button key={qEmoji} onClick={() => { onReaction?.(msg.apiId, qEmoji, false); setShowReactionPicker(false); }} className="reaction-picker-btn" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '4px 6px', borderRadius: '8px' }}>
                                    {qEmoji}
                                </button>
                            )
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
                                        color: famGiven ? 'var(--warning)' : undefined,
                                        background: famGiven ? 'color-mix(in srgb, var(--warning) 15%, transparent)' : undefined
                                    }}
                                >
                                    <ThumbsUp size={16} fill={famGiven ? 'var(--warning)' : 'none'} />
                                </button>
                            </Tooltip>
                        )}
                        {!msg.system && msg.content && (
                            <Tooltip content={translating ? 'Translating...' : (translatedText ? 'Show Original' : 'Translate')} position="top">
                                <button
                                    className="message-action-btn"
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        if (translatedText) {
                                            setTranslatedText(null);
                                            setTranslatedLang(null);
                                            return;
                                        }
                                        if (!msg.apiId || !msgChannelId || translating) return;
                                        setTranslating(true);
                                        try {
                                            const result = await api.messages.translate(msgChannelId, msg.apiId);
                                            setTranslatedText(result.translatedText);
                                            setTranslatedLang(result.detectedLanguage);
                                        } catch {
                                            addToast?.({ title: 'Translation failed', variant: 'error' });
                                        } finally {
                                            setTranslating(false);
                                        }
                                    }}
                                    style={{ opacity: translating ? 0.5 : 1 }}
                                >
                                    <Languages size={16} />
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
                        {msg._isAnnouncementChannel && msg.apiId && (
                            <Tooltip content="Publish to followers" position="top">
                                <button className="message-action-btn" onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        const result: any = await api.channels.crosspost(msgChannelId!, msg.apiId!);
                                        addToast?.({ title: `Published to ${result?.crossposted ?? 0} follower(s)`, variant: 'success' });
                                    } catch { addToast?.({ title: 'Failed to publish', variant: 'error' }); }
                                }} style={{ color: '#10b981' }}>
                                    <Zap size={16} />
                                </button>
                            </Tooltip>
                        )}
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

export default MemoizedMessageItem;
