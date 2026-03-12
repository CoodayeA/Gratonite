/**
 * Tests for the API module — token management and fetch wrapper.
 */

// Mock expo-secure-store
const mockStore: Record<string, string> = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockStore[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    delete mockStore[key];
    return Promise.resolve();
  }),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { setTokens, getAccessToken, loadTokens } from '../src/lib/api';

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
});

describe('Token Management', () => {
  it('stores and retrieves access token', async () => {
    await setTokens('test-access-token', 'test-refresh-token');
    expect(getAccessToken()).toBe('test-access-token');
  });

  it('returns null when no token is set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('loads tokens from secure store', async () => {
    mockStore['gratonite_access_token'] = 'stored-token';
    mockStore['gratonite_refresh_token'] = 'stored-refresh';
    await loadTokens();
    expect(getAccessToken()).toBe('stored-token');
  });

  it('clears tokens when set to null', async () => {
    await setTokens('token', 'refresh');
    expect(getAccessToken()).toBe('token');
    await setTokens(null, null);
    expect(getAccessToken()).toBeNull();
  });
});
