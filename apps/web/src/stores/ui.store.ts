import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  memberPanelOpen: boolean;
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
  pinnedPanelOpen: boolean;
  dmInfoPanelOpen: boolean;

  toggleSidebar: () => void;
  toggleMemberPanel: () => void;
  openModal: (id: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;
  togglePinnedPanel: () => void;
  toggleDmInfoPanel: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  memberPanelOpen: false,
  activeModal: null,
  modalData: null,
  pinnedPanelOpen: false,
  dmInfoPanelOpen: false,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  toggleMemberPanel: () =>
    set((state) => ({ memberPanelOpen: !state.memberPanelOpen })),

  openModal: (id, data) =>
    set({ activeModal: id, modalData: data ?? null }),

  closeModal: () =>
    set({ activeModal: null, modalData: null }),

  togglePinnedPanel: () =>
    set((state) => ({ pinnedPanelOpen: !state.pinnedPanelOpen })),

  toggleDmInfoPanel: () =>
    set((state) => ({ dmInfoPanelOpen: !state.dmInfoPanelOpen })),
}));
