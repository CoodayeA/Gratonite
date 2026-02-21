import { create } from 'zustand';
import { api } from '@/lib/api';

export interface SearchMessageResult {
  id: string;
  channelId: string;
  guildId: string | null;
  authorId: string;
  content: string;
  type: number;
  createdAt: string;
  highlight: string;
  rank: number;
}

interface SearchParams {
  query: string;
  guildId?: string;
  channelId?: string;
  authorId?: string;
  before?: string;
  after?: string;
  limit?: number;
}

interface SearchState {
  query: string;
  results: SearchMessageResult[];
  isSearching: boolean;
  totalCount: number;
  offset: number;
  params: SearchParams | null;
  search: (params: SearchParams) => Promise<void>;
  clearSearch: () => void;
  loadMore: () => Promise<void>;
}

const DEFAULT_LIMIT = 25;

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  isSearching: false,
  totalCount: 0,
  offset: 0,
  params: null,

  search: async (params) => {
    const trimmed = params.query.trim();
    if (!trimmed) {
      set({ query: '', results: [], isSearching: false, totalCount: 0, offset: 0, params: null });
      return;
    }

    const limit = params.limit ?? DEFAULT_LIMIT;
    set({
      isSearching: true,
      query: trimmed,
      params: { ...params, query: trimmed, limit },
      offset: 0,
    });

    try {
      const response = await api.search.messages({ ...params, query: trimmed, limit, offset: 0 });
      set({
        results: response.results,
        totalCount: response.total,
        offset: response.offset + response.results.length,
        isSearching: false,
      });
    } catch (err) {
      console.error('[Search] Failed to search:', err);
      set({ isSearching: false });
    }
  },

  clearSearch: () => set({ query: '', results: [], isSearching: false, totalCount: 0, offset: 0, params: null }),

  loadMore: async () => {
    const { params, results, totalCount, offset, isSearching } = get();
    if (!params || isSearching) return;
    if (results.length >= totalCount) return;

    set({ isSearching: true });
    try {
      const limit = params.limit ?? DEFAULT_LIMIT;
      const response = await api.search.messages({ ...params, offset, limit });
      set({
        results: [...results, ...response.results],
        totalCount: response.total,
        offset: response.offset + response.results.length,
        isSearching: false,
      });
    } catch (err) {
      console.error('[Search] Failed to load more:', err);
      set({ isSearching: false });
    }
  },
}));
