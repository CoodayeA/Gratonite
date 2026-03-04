import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start with insecure defaults.');
}
if (!process.env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is not set. Refusing to start with insecure defaults.');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export function signAccessToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

export function verifyAccessToken(token: string): { userId: string } {
  const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
  return { userId: payload.userId };
}

export function verifyRefreshToken(token: string): { userId: string } {
  const payload = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
  return { userId: payload.userId };
}
