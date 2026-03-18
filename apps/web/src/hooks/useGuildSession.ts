import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiRequestError } from '../lib/api';
import { isAuthRuntimeExpired } from '../lib/authRuntime';

export type GuildSessionErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'NETWORK' | null;

export type GuildSessionInfo = {
  id: string;
  name: string;
  ownerId: string;
  iconHash: string | null;
  bannerHash: string | null;
  description: string | null;
  memberCount: number;
  createdAt: string;
  rulesText?: string | null;
  requireRulesAgreement?: boolean;
  agreedRulesAt?: string | null;
};

export type GuildSessionChannel = {
  id: string;
  name: string;
  type: string;
  parentId: string | null;
  position: number;
  topic: string | null;
  userLimit?: number;
};

type UseGuildSessionArgs = {
  guildId: string | null;
  enabled?: boolean;
  onNetworkError?: (guildId: string) => void;
};

type InFlight = {
  guildId: string;
  promise: Promise<void>;
};

const MAX_RETRIES = 2;
const NETWORK_TOAST_COOLDOWN_MS = 30_000;

function toStatusClass(code: GuildSessionErrorCode): 'success' | 'forbidden' | 'not_found' | 'network' | 'unauthorized' {
  switch (code) {
    case 'FORBIDDEN':
      return 'forbidden';
    case 'NOT_FOUND':
      return 'not_found';
    case 'UNAUTHORIZED':
      return 'unauthorized';
    case 'NETWORK':
    default:
      return 'network';
  }
}

function toErrorCode(err: unknown): GuildSessionErrorCode {
  if (err instanceof ApiRequestError) {
    if (err.status === 401 || err.code === 'UNAUTHORIZED') return 'UNAUTHORIZED';
    if (err.status === 403 || err.code === 'FORBIDDEN') return 'FORBIDDEN';
    if (err.status === 404 || err.code === 'NOT_FOUND') return 'NOT_FOUND';
    return 'NETWORK';
  }
  return 'NETWORK';
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof ApiRequestError)) return true;
  return err.status >= 500 || err.code === 'PARSE_ERROR';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useGuildSession(args: UseGuildSessionArgs) {
  const { guildId, enabled = true, onNetworkError } = args;
  const [guildInfo, setGuildInfo] = useState<GuildSessionInfo | null>(null);
  const [channels, setChannels] = useState<GuildSessionChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<GuildSessionErrorCode>(null);
  const [lastFailureAt, setLastFailureAt] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef<InFlight | null>(null);
  const activeGuildRef = useRef<string | null>(guildId);
  const requestVersionRef = useRef(0);
  const lastNetworkToastAtByGuildRef = useRef<Record<string, number>>({});

  const notifyNetworkFailure = useCallback((currentGuildId: string) => {
    const now = Date.now();
    const last = lastNetworkToastAtByGuildRef.current[currentGuildId] ?? 0;
    if (now - last >= NETWORK_TOAST_COOLDOWN_MS) {
      lastNetworkToastAtByGuildRef.current[currentGuildId] = now;
      onNetworkError?.(currentGuildId);
      return;
    }
    void api.telemetry.captureClientEvent({
      event: 'guild_toast_suppressed',
      guildId: currentGuildId,
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      reason: 'cooldown',
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  }, [onNetworkError]);

  const runFetch = useCallback(async (currentGuildId: string, startedAt: number, requestVersion: number, attempt = 0): Promise<void> => {
    const signal = abortRef.current?.signal;
    const isStale = () =>
      requestVersionRef.current !== requestVersion
      || activeGuildRef.current !== currentGuildId;
    try {
      const [guild, guildChannels] = await Promise.all([
        api.guilds.get(currentGuildId, { signal }),
        api.channels.getGuildChannels(currentGuildId, { signal }),
      ]);
      if (isStale()) return;
      setGuildInfo({
        id: guild.id,
        name: guild.name,
        ownerId: guild.ownerId ?? '',
        iconHash: guild.iconHash ?? null,
        bannerHash: (guild as { bannerHash?: string | null }).bannerHash ?? null,
        description: guild.description ?? null,
        memberCount: typeof guild.memberCount === 'number' ? guild.memberCount : 0,
        createdAt: (guild as { createdAt?: string }).createdAt ?? new Date().toISOString(),
        rulesText: (guild as any).rulesText ?? null,
        requireRulesAgreement: !!(guild as any).requireRulesAgreement,
        agreedRulesAt: (guild as any).agreedRulesAt ?? null,
      });
      setChannels((guildChannels as GuildSessionChannel[]) ?? []);
      setErrorCode(null);
      void api.telemetry.captureClientEvent({
        event: 'guild_open_result',
        guildId: currentGuildId,
        route: typeof window !== 'undefined' ? window.location.pathname : null,
        statusClass: 'success',
        latencyMs: Math.max(0, Date.now() - startedAt),
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return;
      if (isStale()) return;

      const mappedError = toErrorCode(err);
      if (mappedError === 'NETWORK' && attempt < MAX_RETRIES && isRetryableNetworkError(err)) {
        const backoffMs = Math.min(300 * (2 ** attempt), 2_000) + Math.floor(Math.random() * 120);
        await wait(backoffMs);
        return runFetch(currentGuildId, startedAt, requestVersion, attempt + 1);
      }

      setErrorCode(mappedError);
      const failureAt = Date.now();
      setLastFailureAt(failureAt);
      void api.telemetry.captureClientEvent({
        event: 'guild_open_result',
        guildId: currentGuildId,
        route: typeof window !== 'undefined' ? window.location.pathname : null,
        statusClass: toStatusClass(mappedError),
        latencyMs: Math.max(0, failureAt - startedAt),
        requestId: err instanceof ApiRequestError ? err.requestId : null,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
      if (mappedError === 'NETWORK') notifyNetworkFailure(currentGuildId);
    } finally {
      if (!isStale()) {
        setLoading(false);
      }
    }
  }, [notifyNetworkFailure]);

  const loadGuildSession = useCallback(async (force = false): Promise<void> => {
    if (!enabled) return;
    if (isAuthRuntimeExpired()) {
      activeGuildRef.current = null;
      setGuildInfo(null);
      setChannels((prev) => (prev.length === 0 ? prev : []));
      setErrorCode('UNAUTHORIZED');
      setLoading(false);
      return;
    }
    if (!guildId) {
      activeGuildRef.current = null;
      abortRef.current?.abort();
      inFlightRef.current = null;
      setGuildInfo(null);
      setChannels((prev) => (prev.length === 0 ? prev : []));
      setErrorCode(null);
      setLoading(false);
      return;
    }

    if (!force && inFlightRef.current?.guildId === guildId) {
      return inFlightRef.current.promise;
    }

    if (activeGuildRef.current !== guildId) {
      setGuildInfo(null);
      setChannels((prev) => (prev.length === 0 ? prev : []));
      setErrorCode(null);
    }
    activeGuildRef.current = guildId;
    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    const startedAt = Date.now();
    void api.telemetry.captureClientEvent({
      event: 'guild_open_attempt',
      guildId,
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      timestamp: new Date(startedAt).toISOString(),
    }).catch(() => {});

    const promise = runFetch(guildId, startedAt, requestVersion).finally(() => {
      if (inFlightRef.current?.guildId === guildId) {
        inFlightRef.current = null;
      }
    });
    inFlightRef.current = { guildId, promise };
    return promise;
  }, [enabled, guildId, runFetch]);

  useEffect(() => {
    void loadGuildSession(false);
    return () => {
      abortRef.current?.abort();
    };
  }, [loadGuildSession]);

  const refresh = useCallback(() => loadGuildSession(true), [loadGuildSession]);

  return useMemo(() => ({
    guildInfo,
    channels,
    setChannels,
    loading,
    errorCode,
    lastFailureAt,
    refresh,
    enabled,
  }), [guildInfo, channels, loading, errorCode, lastFailureAt, refresh, enabled]);
}
