import { create } from 'zustand';

interface UiState {
  sidebarCollapsed: boolean;
  memberPanelOpen: boolean;
  activeModal: string | null;

  toggleSidebar: () => void;
  toggleMemberPanel: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  memberPanelOpen: false,
  activeModal: null,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  toggleMemberPanel: () =>
    set((state) => ({ memberPanelOpen: !state.memberPanelOpen })),

  openModal: (id) =>
    set({ activeModal: id }),

  closeModal: () =>
    set({ activeModal: null }),
}));
