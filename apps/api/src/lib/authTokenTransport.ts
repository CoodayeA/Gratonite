import { readRefreshCookie } from './authCookies';

type HeaderSource = Record<string, string | string[] | undefined>;
type RequestLike = {
  body?: unknown;
  headers?: HeaderSource;
  cookies?: Partial<Record<string, string | undefined>>;
};

const NATIVE_AUTH_CLIENTS = new Set(['mobile', 'ios', 'android', 'react-native']);

function readHeader(headers: HeaderSource | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0];
  return typeof direct === 'string' ? direct : undefined;
}

function readBodyRefreshToken(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const value = (body as { refreshToken?: unknown }).refreshToken;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function isNativeAuthClient(req: Pick<RequestLike, 'headers'>): boolean {
  const client = readHeader(req.headers, 'x-gratonite-client')?.trim().toLowerCase();
  return client ? NATIVE_AUTH_CLIENTS.has(client) : false;
}

export function readRefreshTokenFromRequest(req: RequestLike): string | undefined {
  return readBodyRefreshToken(req.body)
    ?? readHeader(req.headers, 'x-refresh-token')
    ?? readRefreshCookie(req.cookies);
}
