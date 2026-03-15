import React, { useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, Eye } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import { SkeletonMessageList } from '../ui/SkeletonLoader';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import { ChannelWelcomeCard } from './ChannelWelcomeCard';
import SwipeableMessage from './SwipeableMessage';
import { MemoizedMessageItem } from './MessageItem';
import ForumView from './ForumView';
import Avatar from '../ui/Avatar';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import { useIsMobile } from '../../hooks/useIsMobile';
import { haptic } from '../../utils/haptics';
import { saveScrollPosition, getScrollPosition } from '../../store/scrollPositionStore';

import type { Message } from './chatTypes';

interface MessageListProps {
    messages: Message[];
    channelId: string | undefined;
    channelName: string;
    channelTopic: string | null;
    channelTypeStr: string;
    channelForumTags: Array<{ id: string; name: string; color?: string }>;
    isLoadingMessages: boolean;
    messagesError: boolean;
    hasMoreMessages: boolean;
    isLoadingOlder: boolean;
    isViewingHistory: boolean;
    showScrollButton: boolean;
    newMsgCount: number;
    highlightedMessageId: number | null;
    playingMessageId: number | null;
    activeThreadMessage: Message | null;
    isHypeMode: boolean;
    compactMode: boolean;
    lastReadMessageId: string | null;
    decryptedFileUrls: Map<string, { url: string; filename: string; mimeType: string }>;
    editingMessage: { id: number; apiId: string; content: string } | null;
    editContent: string;
    selectedMessages: Set<string>;
    selectionMode: boolean;
    canManageChannel: boolean;
    showReadReceipts: boolean;
    otherReadStates: { userId: string; lastReadMessageId: string | null }[];
    guildMembers: { id: string; username: string; displayName: string; avatar?: string }[];
    guildCustomEmojis: Array<{ name: string; url: string }>;
    guildChannelsList: { id: string; name: string; type?: string }[];
    currentUserId: string;
    currentUserName: string;
    currentUserAvatarFrame: string;
    currentUserNameplateStyle: string;
    guildId: string | undefined;
    userProfile: any;
    parentRef: React.RefObject<HTMLDivElement>;
    // Callbacks
    fetchMessages: (options?: { signal?: AbortSignal }) => Promise<void>;
    loadOlderMessages: () => Promise<void>;
    setShowScrollButton: (v: boolean) => void;
    setNewMsgCount: (v: number | ((c: number) => number)) => void;
    setPlayingMessageId: (v: number | null) => void;
    setHighlightedMessageId: (v: number | null) => void;
    setActiveThreadMessage: (v: Message | null) => void;
    setReplyingTo: (v: { id: number; apiId?: string; author: string; content: string } | null) => void;
    setLightboxUrl: (v: string | null) => void;
    setLightboxZoom: (v: number) => void;
    setProfilePopover: (v: { user: string; userId: string; x: number; y: number } | null) => void;
    setForwardingMessage: (v: Message | null) => void;
    setEditContent: (v: string) => void;
    setIsViewingHistory: (v: boolean) => void;
    handleMessageContext: (e: React.MouseEvent, msg: Message) => void;
    handleReaction: (messageApiId: string, emoji: string, alreadyReacted: boolean) => void;
    handleUserContext: (e: React.MouseEvent, userId: string, username: string) => void;
    handleEditSubmit: () => void;
    handleEditCancel: () => void;
    handleMessageShiftClick: (e: React.MouseEvent, messageApiId: string | undefined) => void;
    addToast: (t: any) => void;
}

const MessageList: React.FC<MessageListProps> = ({
    messages,
    channelId,
    channelName,
    channelTopic,
    channelTypeStr,
    channelForumTags,
    isLoadingMessages,
    messagesError,
    hasMoreMessages,
    isLoadingOlder,
    isViewingHistory,
    showScrollButton,
    newMsgCount,
    highlightedMessageId,
    playingMessageId,
    activeThreadMessage,
    isHypeMode,
    compactMode,
    lastReadMessageId,
    decryptedFileUrls,
    editingMessage,
    editContent,
    selectedMessages,
    selectionMode,
    canManageChannel,
    showReadReceipts,
    otherReadStates,
    guildMembers,
    guildCustomEmojis,
    guildChannelsList,
    currentUserId,
    currentUserName,
    currentUserAvatarFrame,
    currentUserNameplateStyle,
    guildId,
    userProfile,
    parentRef,
    fetchMessages,
    loadOlderMessages,
    setShowScrollButton,
    setNewMsgCount,
    setPlayingMessageId,
    setHighlightedMessageId,
    setActiveThreadMessage,
    setReplyingTo,
    setLightboxUrl,
    setLightboxZoom,
    setProfilePopover,
    setForwardingMessage,
    setEditContent,
    setIsViewingHistory,
    handleMessageContext,
    handleReaction,
    handleUserContext,
    handleEditSubmit,
    handleEditCancel,
    handleMessageShiftClick,
    addToast,
}) => {
    const isMobile = useIsMobile();

    // Pull-to-refresh: reload messages when user pulls down on mobile
    const { isRefreshing: isPullRefreshing, pullDistance } = usePullToRefresh(parentRef as React.RefObject<HTMLElement>, {
        onRefresh: async () => {
            haptic.pullThreshold();
            await fetchMessages();
        },
        disabled: !isMobile,
    });

    const rowVirtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 80,
        overscan: 10,
    });

    return (
        <>
            {/* Forum View — renders instead of message list for GUILD_FORUM channels */}
            {channelTypeStr === 'GUILD_FORUM' && channelForumTags.length > 0 ? (
                <ForumView
                    channelId={channelId!}
                    channelName={channelName}
                    forumTags={channelForumTags}
                    onOpenThread={(threadId) => setActiveThreadMessage?.({ id: 0, apiId: threadId } as any)}
                />
            ) : null}

            <div ref={parentRef} className="message-area" role="log" aria-label={`Messages in #${channelName}`} aria-live="polite" style={{ overflowY: 'auto', zIndex: 2, position: 'relative', ...(channelTypeStr === 'GUILD_FORUM' && channelForumTags.length > 0 ? { display: 'none' } : {}) }}>
                {/* Pull-to-refresh indicator (mobile) */}
                {isMobile && pullDistance > 0 && (
                    <div className="pull-to-refresh-indicator" style={{ height: `${pullDistance}px` }}>
                        <div className={`pull-to-refresh-spinner${isPullRefreshing ? ' spinning' : ''}`}
                            style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
                    </div>
                )}
                {/* Channel Welcome Card */}
                {channelId && !isLoadingMessages && (
                    <ChannelWelcomeCard channelId={channelId} channelName={channelName} topic={channelTopic} />
                )}
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
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative', flexShrink: 0 }}>
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
                                    <SwipeableMessage onSwipeRight={() => !msg.system && msg.apiId && setReplyingTo({ id: Number(msg.apiId), author: msg.author, content: msg.content })} disabled={msg.system}>
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
                                        onImageClick={(url: string) => { setLightboxUrl(url); setLightboxZoom(1); }}
                                        onReply={(r: any) => setReplyingTo(r)}
                                        onProfileClick={(p: any) => setProfilePopover(p)}
                                        onForward={(m: Message) => setForwardingMessage(m)}
                                        onReaction={handleReaction}
                                        onReplyHighlight={(replyApiId: string) => {
                                            const localMsg = messages.find(m => m.apiId === replyApiId);
                                            if (localMsg) {
                                                setHighlightedMessageId(localMsg.id);
                                                setTimeout(() => setHighlightedMessageId(null), 2500);
                                            }
                                        }}
                                        onUserContext={handleUserContext}
                                        channelId={channelId}
                                        customEmojis={guildCustomEmojis}
                                        members={guildMembers}
                                        channels={guildChannelsList}
                                        currentUserId={currentUserId || userProfile?.id || ''}
                                        currentUsername={currentUserName}
                                        currentUserAvatarFrame={userProfile?.avatarFrame || currentUserAvatarFrame || 'none'}
                                        currentUserNameplateStyle={userProfile?.nameplateStyle || currentUserNameplateStyle || 'none'}
                                        guildId={guildId}
                                        addToast={addToast}
                                        compactMode={compactMode}
                                        isNewMessageDivider={!!(lastReadMessageId && prevMsg?.apiId === lastReadMessageId && msg.apiId !== lastReadMessageId)}
                                        decryptedFileUrls={decryptedFileUrls}
                                        editingMessageApiId={editingMessage?.apiId ?? null}
                                        editContent={editContent}
                                        setEditContent={setEditContent}
                                        onEditSubmit={handleEditSubmit}
                                        onEditCancel={handleEditCancel}
                                    />
                                    </SwipeableMessage>
                                    {/* Feature 12: Read Receipt Dots */}
                                    {showReadReceipts && msg.apiId && (() => {
                                        const nextMsg = messages[virtualRow.index + 1];
                                        const readers = otherReadStates.filter(s => s.lastReadMessageId === msg.apiId);
                                        if (readers.length === 0) return null;
                                        const readerMembers = readers.map(r => guildMembers.find(m => m.id === r.userId)).filter((m): m is NonNullable<typeof m> => Boolean(m));
                                        if (readerMembers.length === 0) return null;
                                        return (
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '2px 8px 0', gap: '4px' }}>
                                                <Eye size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                {readerMembers.slice(0, 5).map((member: any) => (
                                                    <Avatar
                                                        key={member.id}
                                                        userId={member.id}
                                                        displayName={member.displayName || member.username}
                                                        avatarHash={member.avatarHash}
                                                        size={14}
                                                    />
                                                ))}
                                                {readerMembers.length > 5 && (
                                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', lineHeight: '14px' }}>+{readerMembers.length - 5}</span>
                                                )}
                                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }} title={readerMembers.map((m: any) => m.displayName || m.username).join(', ')}>
                                                    {readerMembers.length === 1 ? (readerMembers[0].displayName || readerMembers[0].username) : `${readerMembers.length} read`}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                    </div>
                    </>
                )}
            </div>
        </>
    );
};

export default MessageList;
