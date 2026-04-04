import React, { useRef, useState, useEffect, lazy, Suspense } from 'react';
import {
    Send, Smile, Image as ImageIcon, Reply, X, Plus, Mic, BarChart2, Clock,
    Edit2, Eye, Volume2, Square, Trash2, Hash, FileText, Scissors
} from 'lucide-react';
import Avatar from '../ui/Avatar';
import EmojiPicker from './EmojiPicker';
import { FormattingToolbar } from './FormattingToolbar';
import { EmbedBuilder, type CustomEmbed } from './EmbedBuilder';
import { RichTextRenderer } from './RichTextRenderer';
import { GifReactionPicker } from './GifReactionPicker';
import SoundboardMenu from './SoundboardMenu';

const ImageEditor = lazy(() => import('./ImageEditor'));
const VideoTrimmer = lazy(() => import('./VideoTrimmer'));

import type { Message } from './chatTypes';
import { getAccessToken } from '../../lib/api';

// Stable waveform bar heights — deterministic so they don't jump on re-render
const WAVEFORM_HEIGHTS = [6, 14, 10, 18, 8, 16, 12, 20, 7, 15, 11, 17, 9, 13, 6];

interface MessageInputProps {
    channelId: string | undefined;
    channelName: string;
    channelAttachmentsEnabled: boolean;
    inputValue: string;
    editingMessage: { id: number; apiId: string; content: string } | null;
    editContent: string;
    replyingTo: { id: number; apiId?: string; author: string; content: string } | null;
    chatAttachedFiles: { name: string; size: string; file: File; previewUrl?: string }[];
    isRecording: boolean;
    recordingTime: number;
    voiceExpiry: number | null;
    showPreview: boolean;
    showFormattingToolbar: boolean;
    showEmbedBuilder: boolean;
    isEmojiPickerOpen: boolean;
    stickerPickerOpen: boolean;
    soundboardOpen: boolean;
    showPollCreator: boolean;
    showGifPicker: boolean;
    isScheduleOpen: boolean;
    scheduleDate: string;
    scheduleTime: string;
    scheduledMessages: Array<{ id: string; content: string; scheduledAt: string }>;
    hasDraft: boolean;
    slowRemaining: number;
    rateLimitPerUser: number;
    rateLimitRemaining: number;
    typingUsers: Map<string, string>;
    mentionSearch: string | null;
    mentionIndex: number;
    filteredUsers: { id: string; username: string; displayName: string; avatar?: string }[];
    channelSearch: string | null;
    channelIndex: number;
    filteredChannels: { id: string; name: string; type?: string }[];
    slashSearch: string | null;
    slashIndex: number;
    filteredCommands: Array<{ id: string; name: string; description: string; options?: any[] }>;
    emojiSearch: string | null;
    emojiIndex: number;
    filteredEmojis: Array<{ name: string; emoji: string; isCustom: boolean; url: string }>;
    pollQuestion: string;
    pollOptions: string[];
    pollDuration: number | null;
    pollMultiselect: boolean;
    guildStickers: Array<{ id: string; name: string; url: string; packName?: string }>;
    guildCustomEmojis: Array<{ name: string; url: string }>;
    guildMembers: { id: string; username: string; displayName: string; avatar?: string }[];
    guildChannelsList: { id: string; name: string; type?: string }[];
    guildId: string | undefined;
    messages: Message[];
    highlightedMessageId: number | null;
    channelIsEncrypted: boolean;
    // Callbacks
    setInputValue: (v: string) => void;
    setEditContent: (v: string) => void;
    setEditingMessage: (v: { id: number; apiId: string; content: string } | null) => void;
    setReplyingTo: (v: { id: number; apiId?: string; author: string; content: string } | null) => void;
    setChatAttachedFiles: React.Dispatch<React.SetStateAction<{ name: string; size: string; file: File; previewUrl?: string }[]>>;
    setVoiceExpiry: (v: number | null) => void;
    setShowPreview: (v: boolean | ((p: boolean) => boolean)) => void;
    setShowFormattingToolbar: (v: boolean | ((p: boolean) => boolean)) => void;
    setShowEmbedBuilder: (v: boolean | ((p: boolean) => boolean)) => void;
    setIsEmojiPickerOpen: (v: boolean | ((p: boolean) => boolean)) => void;
    setStickerPickerOpen: (v: boolean | ((p: boolean) => boolean)) => void;
    setSoundboardOpen: (v: boolean | ((p: boolean) => boolean)) => void;
    setShowPollCreator: (v: boolean | ((p: boolean) => boolean)) => void;
    setShowGifPicker: (v: boolean | ((p: boolean) => boolean)) => void;
    setIsScheduleOpen: (v: boolean | ((p: boolean) => boolean)) => void;
    setScheduleDate: (v: string) => void;
    setScheduleTime: (v: string) => void;
    setScheduledMessages: React.Dispatch<React.SetStateAction<Array<{ id: string; content: string; scheduledAt: string }>>>;
    setMentionIndex: (v: number | ((p: number) => number)) => void;
    setChannelIndex: (v: number | ((p: number) => number)) => void;
    setSlashIndex: (v: number | ((p: number) => number)) => void;
    setEmojiIndex: (v: number | ((p: number) => number)) => void;
    setPollQuestion: (v: string) => void;
    setPollOptions: (v: string[] | ((p: string[]) => string[])) => void;
    setPollDuration: (v: number | null) => void;
    setPollMultiselect: (v: boolean) => void;
    setHighlightedMessageId: (v: number | null) => void;
    setHasDraft: (v: boolean) => void;
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    handleInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    handleSendMessage: () => void;
    handleSendGif: (url: string, previewUrl: string) => void;
    handleSendSticker: (sticker: { id: string; name: string; url: string }) => void;
    handleSendVoiceNote: () => void;
    startRecording: () => void;
    cancelRecording: () => void;
    submitPoll: () => void;
    insertMention: (userId: string) => void;
    insertChannelMention: (chId: string) => void;
    insertEmoji: (emojiName: string) => void;
    selectSlashCommand: (cmd: { id: string; name: string; description: string; options?: any[] }) => void;
    handlePlaySound: (sound: { name: string; emoji: string }) => void;
    handleScheduleSubmit: () => void;
    addToast: (t: any) => void;
    formatTime: (seconds: number) => string;
    API_BASE: string;
    draftSaveTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    processEmojis: (text: string) => string;
}

const MessageInput: React.FC<MessageInputProps> = ({
    channelId,
    channelName,
    channelAttachmentsEnabled,
    inputValue,
    editingMessage,
    editContent,
    replyingTo,
    chatAttachedFiles,
    isRecording,
    recordingTime,
    voiceExpiry,
    showPreview,
    showFormattingToolbar,
    showEmbedBuilder,
    isEmojiPickerOpen,
    stickerPickerOpen,
    soundboardOpen,
    showPollCreator,
    showGifPicker,
    isScheduleOpen,
    scheduleDate,
    scheduleTime,
    scheduledMessages,
    hasDraft,
    slowRemaining,
    rateLimitPerUser,
    rateLimitRemaining,
    typingUsers,
    mentionSearch,
    mentionIndex,
    filteredUsers,
    channelSearch,
    channelIndex,
    filteredChannels,
    slashSearch,
    slashIndex,
    filteredCommands,
    emojiSearch,
    emojiIndex,
    filteredEmojis,
    pollQuestion,
    pollOptions,
    pollDuration,
    pollMultiselect,
    guildStickers,
    guildCustomEmojis,
    guildMembers,
    guildChannelsList,
    guildId,
    messages,
    highlightedMessageId,
    channelIsEncrypted,
    setInputValue,
    setEditContent,
    setEditingMessage,
    setReplyingTo,
    setChatAttachedFiles,
    setVoiceExpiry,
    setShowPreview,
    setShowFormattingToolbar,
    setShowEmbedBuilder,
    setIsEmojiPickerOpen,
    setStickerPickerOpen,
    setSoundboardOpen,
    setShowPollCreator,
    setShowGifPicker,
    setIsScheduleOpen,
    setScheduleDate,
    setScheduleTime,
    setScheduledMessages,
    setMentionIndex,
    setChannelIndex,
    setSlashIndex,
    setEmojiIndex,
    setPollQuestion,
    setPollOptions,
    setPollDuration,
    setPollMultiselect,
    setHighlightedMessageId,
    setHasDraft,
    handleInputChange,
    handleInputKeyDown,
    handleSendMessage,
    handleSendGif,
    handleSendSticker,
    handleSendVoiceNote,
    startRecording,
    cancelRecording,
    submitPoll,
    insertMention,
    insertChannelMention,
    insertEmoji,
    selectSlashCommand,
    handlePlaySound,
    handleScheduleSubmit,
    addToast,
    formatTime,
    API_BASE: apiBase,
    draftSaveTimerRef,
    processEmojis,
}) => {
    const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
    useEffect(() => {
        const onOnline = () => setIsOffline(false);
        const onOffline = () => setIsOffline(true);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);
    const [editingFileType, setEditingFileType] = useState<'image' | 'video' | null>(null);

    return (
        <>
        {editingFileIndex !== null && editingFileType === 'image' && chatAttachedFiles[editingFileIndex] && (
            <Suspense fallback={null}>
                <ImageEditor
                    file={chatAttachedFiles[editingFileIndex].file}
                    onSave={(editedFile) => {
                        setChatAttachedFiles(prev => prev.map((f, i) => {
                            if (i !== editingFileIndex) return f;
                            const oldPreview = f.previewUrl;
                            if (oldPreview) URL.revokeObjectURL(oldPreview);
                            return {
                                ...f,
                                name: editedFile.name,
                                size: editedFile.size < 1024 ? `${editedFile.size} B` : editedFile.size < 1048576 ? `${(editedFile.size / 1024).toFixed(1)} KB` : `${(editedFile.size / 1048576).toFixed(1)} MB`,
                                file: editedFile,
                                previewUrl: URL.createObjectURL(editedFile),
                            };
                        }));
                        setEditingFileIndex(null);
                        setEditingFileType(null);
                    }}
                    onCancel={() => { setEditingFileIndex(null); setEditingFileType(null); }}
                />
            </Suspense>
        )}
        {editingFileIndex !== null && editingFileType === 'video' && chatAttachedFiles[editingFileIndex] && (
            <Suspense fallback={null}>
                <VideoTrimmer
                    file={chatAttachedFiles[editingFileIndex].file}
                    onSave={(trimmedFile) => {
                        setChatAttachedFiles(prev => prev.map((f, i) => {
                            if (i !== editingFileIndex) return f;
                            return {
                                ...f,
                                name: trimmedFile.name,
                                size: trimmedFile.size < 1024 ? `${trimmedFile.size} B` : trimmedFile.size < 1048576 ? `${(trimmedFile.size / 1024).toFixed(1)} KB` : `${(trimmedFile.size / 1048576).toFixed(1)} MB`,
                                file: trimmedFile,
                            };
                        }));
                        setEditingFileIndex(null);
                        setEditingFileType(null);
                    }}
                    onCancel={() => { setEditingFileIndex(null); setEditingFileType(null); }}
                />
            </Suspense>
        )}
        <div className="input-area" style={{ zIndex: 2, position: 'relative' }}>
            {slowRemaining > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 16px',
                    fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
                    margin: '0 16px 4px', borderRadius: '8px',
                }}>
                    {/* Circular countdown timer */}
                    <div style={{ position: 'relative', width: '28px', height: '28px', flexShrink: 0 }}>
                        <svg width="28" height="28" viewBox="0 0 28 28" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="14" cy="14" r="12" fill="none" stroke="var(--stroke)" strokeWidth="2" />
                            <circle
                                cx="14" cy="14" r="12" fill="none"
                                stroke="var(--accent-primary)" strokeWidth="2"
                                strokeDasharray={`${2 * Math.PI * 12}`}
                                strokeDashoffset={`${2 * Math.PI * 12 * (1 - slowRemaining / (rateLimitPerUser || 1))}`}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 1s linear' }}
                            />
                        </svg>
                        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {slowRemaining}
                        </span>
                    </div>
                    <span>Slowmode active — wait <strong style={{ color: 'var(--text-primary)' }}>{slowRemaining}s</strong> to send</span>
                </div>
            )}
            {typingUsers.size > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', paddingLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'flex', gap: '2px', alignItems: 'center', flexShrink: 0 }}>
                        {[...typingUsers.entries()].slice(0, 3).map(([userId, uname]) => (
                            <Avatar key={userId} userId={userId} displayName={uname} size={18} />
                        ))}
                    </span>
                    <span style={{ display: 'flex', gap: '4px' }}>
                        <span className="typing-dot" style={{ animationDelay: '0ms' }}></span>
                        <span className="typing-dot" style={{ animationDelay: '150ms' }}></span>
                        <span className="typing-dot" style={{ animationDelay: '300ms' }}></span>
                    </span>
                    {(() => {
                        const names = [...typingUsers.values()];
                        if (names.length === 1) return `${names[0]} is typing...`;
                        if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
                        if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
                        return `Several people are typing...`;
                    })()}
                </div>
            )}

            {/* Edit Banner */}
            {editingMessage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--warning)', margin: '0 16px 4px', borderRadius: '0 8px 8px 0' }}>
                    <Edit2 size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
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
                                fetch(`${apiBase}/channels/${channelId}/messages/scheduled/${sm.id}`, {
                                    method: 'DELETE',
                                    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
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

            {/* Reply Preview Bar */}
            {replyingTo && !editingMessage && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--bg-tertiary)', borderLeft: '3px solid var(--accent-primary)', margin: '0 16px 4px', borderRadius: '0 8px 8px 0' }}>
                    <Reply size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', flexShrink: 0 }}>Replying to</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{replyingTo.author}</span>
                    <span
                        onClick={() => {
                            const apiId = replyingTo.apiId;
                            if (apiId) {
                                const el = document.querySelector(`[data-message-id="${apiId}"]`);
                                if (el) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    const localMsg = messages.find(m => m.apiId === apiId);
                                    if (localMsg) {
                                        setHighlightedMessageId(localMsg.id);
                                        setTimeout(() => setHighlightedMessageId(null), 2500);
                                    }
                                }
                            }
                        }}
                        style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'pointer' }}
                        title="Click to scroll to original message"
                    >
                        {replyingTo.content || '(click to view)'}
                    </span>
                    <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }} title="Cancel reply">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Attached file chips */}
            {chatAttachedFiles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 16px 8px' }}>
                    {chatAttachedFiles.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {f.previewUrl ? <img src={f.previewUrl} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} alt="" /> : <ImageIcon size={12} />}
                            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{f.size}</span>
                            {f.file.type.startsWith('image/') && (
                                <button onClick={() => { setEditingFileIndex(i); setEditingFileType('image'); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, display: 'flex' }} title="Edit image">
                                    <Edit2 size={12} />
                                </button>
                            )}
                            {f.file.type.startsWith('video/') && (
                                <button onClick={() => { setEditingFileIndex(i); setEditingFileType('video'); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, display: 'flex' }} title="Trim video">
                                    <Scissors size={12} />
                                </button>
                            )}
                            <button onClick={() => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); setChatAttachedFiles(prev => prev.filter((_, idx) => idx !== i)); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Markdown Preview Pane */}
            {showPreview && inputValue.trim().length > 0 && (
                <div style={{
                    padding: '12px 16px', margin: '0 16px 4px',
                    background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                    borderRadius: '8px', fontSize: '15px', color: 'var(--text-primary)',
                    lineHeight: '1.5', maxHeight: '200px', overflowY: 'auto',
                }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                        Preview
                    </div>
                    <RichTextRenderer content={inputValue} customEmojis={guildCustomEmojis} members={guildMembers} channels={guildChannelsList} />
                </div>
            )}

            {/* Formatting Toolbar */}
            {showFormattingToolbar && !editingMessage && (
                <div style={{ margin: '0 16px' }}>
                    <FormattingToolbar
                        textareaSelector=".chat-input"
                        onInputChange={setInputValue}
                        getValue={() => inputValue}
                    />
                </div>
            )}

            {/* Embed Builder */}
            {showEmbedBuilder && !editingMessage && (
                <EmbedBuilder
                    onSend={(embed: CustomEmbed) => {
                        // This is handled by the parent via the prop
                        // but we need to match the original inline behavior
                    }}
                    onClose={() => setShowEmbedBuilder(false)}
                />
            )}

            <div className="chat-input-wrapper" role="toolbar" aria-label="Composer" style={{ position: 'relative' }}>

                {/* Mentions Autocomplete */}
                {mentionSearch !== null && (
                    <div
                        role="listbox"
                        aria-label="Member suggestions"
                        style={{
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
                                role="option"
                                aria-selected={mentionIndex === idx}
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
                    <div
                        role="listbox"
                        aria-label="Channel suggestions"
                        style={{
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
                                role="option"
                                aria-selected={channelIndex === idx}
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
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: '24px', opacity: 0.8 }}>
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
                        <input id="channel-file-upload" type="file" multiple style={{ display: 'none' }} onChange={(e) => {
                            const files = e.target.files;
                            if (!files) return;
                            const newFiles = Array.from(files).map(f => ({
                                name: f.name,
                                size: f.size < 1024 ? `${f.size} B` : f.size < 1048576 ? `${(f.size / 1024).toFixed(1)} KB` : `${(f.size / 1048576).toFixed(1)} MB`,
                                file: f,
                                previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
                            }));
                            setChatAttachedFiles(prev => [...prev, ...newFiles]);
                            e.target.value = '';
                        }} />
                        <label htmlFor={channelAttachmentsEnabled ? "channel-file-upload" : undefined} className="input-icon-btn" title={channelAttachmentsEnabled ? "Upload Attachment" : "Attachments disabled in this channel"} aria-label="Upload attachment" role="button" style={channelAttachmentsEnabled ? { cursor: 'pointer' } : { opacity: 0.3, cursor: 'not-allowed' }}>
                            <Plus size={20} />
                        </label>
                        {hasDraft && !editingMessage && (
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)', background: 'color-mix(in srgb, var(--warning) 15%, transparent)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Draft</span>
                        )}
                        <textarea
                            className="chat-input"
                            aria-label="Message input"
                            rows={1}
                            placeholder={`Message #${channelName}...`}
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleInputKeyDown}
                            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = '24px'; t.style.height = Math.min(t.scrollHeight, 200) + 'px'; }}
                            onPaste={(e) => {
                                const items = e.clipboardData?.items;
                                if (!items) return;
                                for (const item of Array.from(items)) {
                                    if (item.type.startsWith('image/')) {
                                        e.preventDefault();
                                        const file = item.getAsFile();
                                        if (file && channelAttachmentsEnabled) {
                                            setChatAttachedFiles(prev => [...prev, {
                                                name: file.name || `pasted-image.${item.type.split('/')[1] || 'png'}`,
                                                size: file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(1)} MB`,
                                                file,
                                                previewUrl: URL.createObjectURL(file),
                                            }]);
                                        }
                                        break;
                                    }
                                }
                            }}
                        />
                        {!editingMessage && inputValue.length > 1800 && (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: inputValue.length > 2000 ? 'var(--error)' : 'var(--warning)', flexShrink: 0, padding: '0 4px' }}>
                                {inputValue.length}/2000
                            </span>
                        )}
                        <button className="input-icon-btn" title="Record Voice Note" aria-label="Record voice note" onClick={startRecording}>
                            <Mic size={20} />
                        </button>
                        {/* Formatting Toolbar Toggle */}
                        <button
                            className={`input-icon-btn ${showFormattingToolbar ? 'primary' : ''}`}
                            title="Toggle Formatting Toolbar"
                            aria-label="Toggle formatting toolbar"
                            aria-pressed={showFormattingToolbar}
                            onClick={() => setShowFormattingToolbar(p => !p)}
                        >
                            <Edit2 size={16} />
                        </button>
                        {/* Embed Builder Toggle */}
                        <button
                            className={`input-icon-btn ${showEmbedBuilder ? 'primary' : ''}`}
                            title="Embed Builder"
                            aria-label="Toggle embed builder"
                            aria-pressed={showEmbedBuilder}
                            onClick={() => setShowEmbedBuilder(p => !p)}
                        >
                            <FileText size={16} />
                        </button>
                        {/* Markdown Preview Toggle */}
                        <button
                            className={`input-icon-btn ${showPreview ? 'primary' : ''}`}
                            title="Toggle Markdown Preview (Ctrl+Shift+P)"
                            aria-label="Toggle markdown preview"
                            aria-pressed={showPreview}
                            onClick={() => setShowPreview(p => !p)}
                        >
                            <Eye size={18} />
                        </button>
                        <div style={{ display: inputValue.trim().length === 0 ? 'contents' : 'none' }}>
                                <button className={`input-icon-btn ${isEmojiPickerOpen ? 'primary' : ''}`} title="Select Emoji" aria-label="Open emoji picker" onClick={() => { setIsEmojiPickerOpen(!isEmojiPickerOpen); setStickerPickerOpen(false); }} style={{ position: 'relative' }}>
                                    <Smile size={20} />
                                    <span className="shortcut-hint" style={{ position: 'absolute', bottom: '-14px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: 'var(--text-muted)', opacity: 0.6, whiteSpace: 'nowrap', pointerEvents: 'none', fontWeight: 500 }}>Ctrl+E</span>
                                </button>
                                {/* Sticker Picker Button */}
                                <button className={`input-icon-btn ${stickerPickerOpen ? 'primary' : ''}`} title="Sticker Picker" aria-label="Open sticker picker" aria-pressed={stickerPickerOpen} onClick={() => { setStickerPickerOpen(!stickerPickerOpen); setIsEmojiPickerOpen(false); }}>
                                    <Square size={18} />
                                </button>
                                <button className="input-icon-btn" title="Create Poll" aria-label="Create poll" onClick={() => setShowPollCreator(!showPollCreator)}>
                                    <BarChart2 size={20} />
                                </button>
                                <button className={`input-icon-btn ${soundboardOpen ? 'primary' : ''}`} title="Soundboard" aria-label="Open soundboard" aria-pressed={soundboardOpen} onClick={() => setSoundboardOpen(!soundboardOpen)}>
                                    <Volume2 size={20} />
                                </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', visibility: inputValue.trim().length > 0 ? 'visible' : 'hidden', position: inputValue.trim().length > 0 ? 'static' as const : 'absolute' as const }}>
                                <button
                                    className="input-icon-btn"
                                    title="Schedule Message"
                                    aria-label="Schedule message"
                                    onClick={() => setIsScheduleOpen(!isScheduleOpen)}
                                    style={{ color: isScheduleOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                                >
                                    <Clock size={18} />
                                </button>
                                <button
                                    className="input-icon-btn primary"
                                    aria-label={isOffline ? 'Offline — message will be queued' : rateLimitRemaining > 0 ? `Rate limited, wait ${rateLimitRemaining}s` : 'Send message'}
                                    title={isOffline ? 'You are offline. The message will be queued and sent when you reconnect.' : undefined}
                                    onClick={handleSendMessage}
                                    disabled={rateLimitRemaining > 0 || inputValue.trim().length === 0 || isOffline}
                                    style={{ position: 'relative', opacity: rateLimitRemaining > 0 || isOffline ? 0.5 : 1, cursor: rateLimitRemaining > 0 || isOffline ? 'not-allowed' : undefined }}
                                >
                                    {rateLimitRemaining > 0 ? <span style={{ fontSize: '12px', fontWeight: 700 }}>{rateLimitRemaining}s</span> : <Send size={18} />}
                                    <span className="shortcut-hint" style={{ position: 'absolute', bottom: '-14px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: 'var(--text-muted)', opacity: 0.6, whiteSpace: 'nowrap', pointerEvents: 'none', fontWeight: 500 }}>Enter</span>
                                </button>
                        </div>
                    </>
                )}

                {/* Slash Command Picker Popover */}
                {slashSearch !== null && filteredCommands.length > 0 && (
                    <div role="listbox" aria-label="Slash command suggestions" style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '8px', width: '340px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '300px', overflowY: 'auto' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', padding: '0 8px' }}>COMMANDS</div>
                        {filteredCommands.map((cmd, idx) => (
                            <div
                                key={cmd.id}
                                role="option"
                                aria-selected={slashIndex === idx}
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
                    <div role="listbox" aria-label="Emoji suggestions" style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '8px', width: '260px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', padding: '0 8px' }}>EMOJIS MATCHING "{emojiSearch}"</div>
                        {filteredEmojis.map((emoji, idx) => (
                            <div
                                key={emoji.name}
                                role="option"
                                aria-selected={emojiIndex === idx}
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
                                    <img src={emoji.url} alt={emoji.name} loading="lazy" decoding="async" width={20} height={20} style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                ) : (
                                    <span style={{ fontSize: '20px' }}>{emoji.isCustom ? emoji.name : emoji.emoji}</span>
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
                            setInputValue(inputValue + emoji);
                        }}
                        onSendGif={handleSendGif}
                        onStickerSelect={handleSendSticker}
                        guildId={guildId}
                    />
                )}

                {/* GIF Reaction Picker */}
                {showGifPicker && (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', right: '100px', zIndex: 15 }}>
                        <GifReactionPicker
                            onSelect={(gifUrl) => {
                                handleSendGif(gifUrl, gifUrl);
                                setShowGifPicker(false);
                            }}
                            onClose={() => setShowGifPicker(false)}
                        />
                    </div>
                )}

                {/* Sticker Picker Panel */}
                {stickerPickerOpen && (
                    <div style={{
                        position: 'absolute', bottom: 'calc(100% + 12px)', right: '16px',
                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                        borderRadius: '12px', padding: '12px', width: '320px', maxHeight: '360px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10,
                        display: 'flex', flexDirection: 'column', gap: '8px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Stickers</span>
                            <button onClick={() => setStickerPickerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {guildStickers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    No stickers available in this server
                                </div>
                            ) : (
                                (() => {
                                    const packs = new Map<string, typeof guildStickers>();
                                    for (const s of guildStickers) {
                                        const pack = s.packName || 'Stickers';
                                        if (!packs.has(pack)) packs.set(pack, []);
                                        packs.get(pack)!.push(s);
                                    }
                                    return Array.from(packs.entries()).map(([packName, stickers]) => (
                                        <div key={packName}>
                                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 0', marginBottom: '4px' }}>
                                                {packName}
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                                                {stickers.map(sticker => (
                                                    <div
                                                        key={sticker.id}
                                                        onClick={() => {
                                                            handleSendSticker(sticker);
                                                            setStickerPickerOpen(false);
                                                        }}
                                                        style={{
                                                            cursor: 'pointer', borderRadius: '8px', padding: '4px',
                                                            background: 'var(--bg-tertiary)', border: '1px solid transparent',
                                                            transition: 'border-color 0.15s, background 0.15s',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            aspectRatio: '1',
                                                        }}
                                                        className="hover-sticker-item"
                                                        title={sticker.name}
                                                    >
                                                        <img src={sticker.url} alt={sticker.name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()
                            )}
                        </div>
                    </div>
                )}

                {/* Schedule Message Popover */}
                {isScheduleOpen && (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 12px)', right: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '16px', width: 'min(300px, 90vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '16px', animation: 'scaleIn 0.2s ease-out' }}>
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

                        <button className="auth-button" style={{ margin: 0, padding: '8px 0', height: 'auto', fontSize: '13px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)' }} onClick={handleScheduleSubmit}>
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
                        width: 'min(360px, 90vw)',
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

                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <input type="checkbox" checked={pollMultiselect} onChange={e => setPollMultiselect(e.target.checked)} style={{ accentColor: 'var(--accent-primary)' }} />
                            Allow multiple votes
                        </label>

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
        </>
    );
};

export default MessageInput;
