import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  memberPanelOpen: boolean;
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  pinnedPanelOpen: boolean;
  dmInfoPanelOpen: boolean;
  searchPanelOpen: boolean;
  threadPanelOpen: boolean;
  activeThreadId: string | null;

  toggleSidebar: () => void;
  toggleMemberPanel: () => void;
  openModal: (id: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  togglePinnedPanel: () => void;
  toggleDmInfoPanel: () => void;
  toggleSearchPanel: () => void;
  openThread: (threadId: string) => void;
  showThreadList: () => void;
  closeThreadPanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  memberPanelOpen: false,
  activeModal: null,
  modalData: null,
  pinnedPanelOpen: false,
  dmInfoPanelOpen: false,
  searchPanelOpen: false,
  threadPanelOpen: false,
  activeThreadId: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  toggleMemberPanel: () =>
    set((state) => ({ memberPanelOpen: !state.memberPanelOpen })),

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
}));
