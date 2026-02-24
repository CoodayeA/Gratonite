import { create } from 'zustand';

export type ModalId =
  | 'settings'
  | 'create-guild'
  | 'create-channel'
  | 'invite'
  | 'leave-guild'
  | 'delete-guild'
  | 'delete-channel'
  | 'delete-message'
  | 'emoji-studio'
  | 'bug-report'
  | 'create-thread'
  | 'new-dm'
  | 'add-friend'
  | 'shortcuts-help'
  | 'full-profile';

export type SettingsModalData = {
  type: 'user' | 'server';
  guildId?: string;
  initialSection?: string;
};

interface UiState {
  sidebarCollapsed: boolean;
  memberPanelOpen: boolean;
  mobileGuildRailOpen: boolean;
  mobileChannelSidebarOpen: boolean;
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  pinnedPanelOpen: boolean;
  dmInfoPanelOpen: boolean;
  searchPanelOpen: boolean;
  threadPanelOpen: boolean;
  activeThreadId: string | null;
  dmRecipientId: string | null;
  dmChannelType: 'DM' | 'GROUP_DM' | null;
  dmChannelId: string | null;

  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  toggleMemberPanel: () => void;
  toggleMobileGuildRail: () => void;
  toggleMobileChannelSidebar: () => void;
  closeMobileDrawers: () => void;
  openModal: (id: ModalId, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  togglePinnedPanel: () => void;
  toggleDmInfoPanel: () => void;
  toggleSearchPanel: () => void;
  openThread: (threadId: string) => void;
  showThreadList: () => void;
  closeThreadPanel: () => void;
  setDmRecipientId: (id: string | null) => void;
  setDmChannelContext: (type: 'DM' | 'GROUP_DM' | null, channelId: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  memberPanelOpen: false,
  mobileGuildRailOpen: false,
  mobileChannelSidebarOpen: false,
  activeModal: null,
  modalData: null,
  pinnedPanelOpen: false,
  dmInfoPanelOpen: false,
  searchPanelOpen: false,
  threadPanelOpen: false,
  activeThreadId: null,
  dmRecipientId: null,
  dmChannelType: null,
  dmChannelId: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setSidebarCollapsed: (value: boolean) =>
    set({ sidebarCollapsed: value }),

  toggleMemberPanel: () =>
    set((state) => ({ memberPanelOpen: !state.memberPanelOpen })),

  toggleMobileGuildRail: () =>
    set((state) => ({
      mobileGuildRailOpen: !state.mobileGuildRailOpen,
      mobileChannelSidebarOpen: !state.mobileGuildRailOpen ? false : state.mobileChannelSidebarOpen,
    })),

  toggleMobileChannelSidebar: () =>
    set((state) => ({
      mobileChannelSidebarOpen: !state.mobileChannelSidebarOpen,
      mobileGuildRailOpen: !state.mobileChannelSidebarOpen ? false : state.mobileGuildRailOpen,
    })),

  closeMobileDrawers: () =>
    set({ mobileGuildRailOpen: false, mobileChannelSidebarOpen: false }),

  openModal: (id, data) =>
    set({ activeModal: id, modalData: data ?? null }),

  closeModal: () =>
    set({ activeModal: null, modalData: null }),

  togglePinnedPanel: () =>
    set((state) => {
      const next = !state.pinnedPanelOpen;
      return {
        pinnedPanelOpen: next,
        searchPanelOpen: next ? false : state.searchPanelOpen,
        threadPanelOpen: next ? false : state.threadPanelOpen,
      };
    }),

  toggleDmInfoPanel: () =>
    set((state) => ({ dmInfoPanelOpen: !state.dmInfoPanelOpen })),

  toggleSearchPanel: () =>
    set((state) => {
      const next = !state.searchPanelOpen;
      return {
        searchPanelOpen: next,
        pinnedPanelOpen: next ? false : state.pinnedPanelOpen,
        threadPanelOpen: next ? false : state.threadPanelOpen,
      };
    }),

  openThread: (threadId) =>
    set({ threadPanelOpen: true, activeThreadId: threadId, pinnedPanelOpen: false, searchPanelOpen: false }),

  showThreadList: () =>
    set({ threadPanelOpen: true, activeThreadId: null, pinnedPanelOpen: false, searchPanelOpen: false }),

  closeThreadPanel: () =>
    set({ threadPanelOpen: false, activeThreadId: null }),

  setDmRecipientId: (id) =>
    set({ dmRecipientId: id }),

  setDmChannelContext: (type, channelId) =>
    set({ dmChannelType: type, dmChannelId: channelId }),
}));
