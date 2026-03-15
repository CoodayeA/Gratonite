import React from 'react';

export type MediaType = 'image' | 'video';

export type Attachment = {
    id: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    type?: string;
};

/** Extended channel properties returned from GET /channels/:id */
export interface ChannelDetail {
    id: string;
    name: string;
    type: string;
    topic?: string | null;
    rateLimitPerUser?: number;
    isEncrypted?: boolean;
    attachmentsEnabled?: boolean;
    backgroundUrl?: string;
    backgroundType?: string;
    [key: string]: unknown;
}

export type Message = {
    id: number;
    apiId?: string; // original UUID from backend for updates/deletes
    authorId?: string;
    author: string;
    system: boolean;
    avatar: React.ReactNode | string;
    time: string;
    content: string;
    edited?: boolean;
    reactions?: Array<{ emoji: string; emojiUrl?: string; isCustom?: boolean; count: number; me: boolean }>;
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
    embeds?: Array<{ url: string; title?: string; description?: string; image?: string; siteName?: string; type?: string; color?: string; fields?: any[]; thumbnail?: string; footer?: string }>;
    components?: any[];
    isBot?: boolean;
    isEncrypted?: boolean;
    encryptedContent?: string | null;
    expiresAt?: string | null;
    createdAt?: string | null;
    widgetData?: { type: 'countdown' | 'progress' | 'server-stats' | 'weather'; data: any };
    sendStatus?: 'sending' | 'failed';
    _retryPayload?: { channelId: string; payload: any };
    _isAnnouncementChannel?: boolean;
};

export type OutletContextType = {
    bgMedia: { url: string, type: MediaType } | null;
    hasCustomBg: boolean;
    setBgMedia: (media: { url: string, type: MediaType } | null) => void;
    setActiveModal: (modal: 'settings' | 'userProfile' | 'createGuild' | null) => void;
    toggleGuildRail: () => void;
    toggleSidebar: () => void;
    toggleMemberDrawer?: () => void;
    userProfile?: {
        id?: string;
        avatarFrame?: 'none' | 'neon' | 'gold' | 'glass' | 'rainbow' | 'pulse';
        nameplateStyle?: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch';
    };
};
