/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_TUNNEL_STATUS: string;
  readonly VITE_UI_V2_TOKENS?: string;
  readonly VITE_DOWNLOAD_MAC: string;
  readonly VITE_DOWNLOAD_WIN: string;
  readonly VITE_DOWNLOAD_LINUX: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*?raw' {
  const content: string;
  export default content;
}

interface Window {
  __gratoniteHarness?: {
    setCallState: (partial: Record<string, unknown>) => void;
    resetCallState: () => void;
    getCallState: () => Record<string, unknown>;
    markUnread: (channelId: string, amount?: number) => void;
    markMention: (channelId: string, amount?: number) => void;
    clearUnread: () => void;
    getUnreadState: () => {
      unreadByChannel: string[];
      unreadCountByChannel: Array<[string, number]>;
      mentionCountByChannel: Array<[string, number]>;
    };
  };
}
