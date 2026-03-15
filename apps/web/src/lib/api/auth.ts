/**
 * Auth domain: login, register, logout, MFA, devices, sessions.
 */
import { apiFetch, refreshAccessToken } from './_core';
import type { AuthResponse, RegisterRequest, LoginRequest } from './_core';

export const authApi = {
  register: (data: RegisterRequest) =>
    apiFetch<{ email: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: LoginRequest) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  refresh: () => refreshAccessToken(),

  logout: () =>
    apiFetch<void>('/auth/logout', { method: 'POST' }),

  checkUsername: (username: string) =>
    apiFetch<{ available: boolean }>(
      `/auth/username-available?username=${encodeURIComponent(username)}`,
    ),

  requestEmailVerification: (email: string) =>
    apiFetch<{ ok: true; message: string }>('/auth/verify-email/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  confirmEmailVerification: (token: string) =>
    apiFetch<{ ok: true; message: string; accessToken: string }>('/auth/verify-email/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    apiFetch<{ ok: true; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  getMfaStatus: () =>
    apiFetch<{ enabled: boolean; pendingSetup: boolean; backupCodeCount: number }>('/auth/mfa/status'),

  startMfaSetup: (deviceLabel?: string) =>
    apiFetch<{
      secret: string;
      otpauthUrl: string;
      qrCodeDataUrl: string;
      expiresInSeconds: number;
    }>('/auth/mfa/setup/start', {
      method: 'POST',
      body: JSON.stringify(deviceLabel ? { deviceLabel } : {}),
    }),

  enableMfa: (code: string) =>
    apiFetch<{ ok: true; backupCodes: string[] }>('/auth/mfa/setup/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  disableMfa: (code: string) =>
    apiFetch<{ ok: true }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  regenerateMfaBackupCodes: (code: string) =>
    apiFetch<{ ok: true; backupCodes: string[] }>('/auth/mfa/backup-codes/regenerate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  getKnownDevices: () =>
    apiFetch<Array<{ id: string; ip: string; device: string; firstSeenAt: string; lastSeenAt: string }>>('/auth/devices'),
  removeKnownDevice: (deviceId: string) =>
    apiFetch<void>(`/auth/devices/${deviceId}`, { method: 'DELETE' }),
  clearAllKnownDevices: () =>
    apiFetch<void>('/auth/devices', { method: 'DELETE' }),
};
