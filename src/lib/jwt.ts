import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '@/core/config';

// Minimal HS256-compatible JWT — no external dependency.
// Payload is not encrypted, only signed. Do not put secrets in payload.

interface JwtPayload {
  sub:  string;
  iat:  number;
  exp:  number;
  role?: string;
}

function b64url(s: string): string {
  return Buffer.from(s).toString('base64url');
}

function sign(header: string, payload: string): string {
  return createHmac('sha256', config.security.jwtSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
}

export function issueToken(sub: string, role?: string, ttlSeconds = 3600): string {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now     = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub, iat: now, exp: now + ttlSeconds, role }));
  const sig     = sign(header, payload);
  return `${header}.${payload}.${sig}`;
}

export function verifyToken(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  const [header, payload, sig] = parts;
  const expected = sign(header, payload);

  // Constant-time comparison
  const sigBuf = Buffer.from(sig,      'base64url');
  const expBuf = Buffer.from(expected, 'base64url');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid JWT signature');
  }

  const decoded: JwtPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (decoded.exp < now) throw new Error('JWT expired');

  return decoded;
}

export function extractBearerToken(authHeader: string | null): string {
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Missing or invalid Authorization header');
  return authHeader.slice(7);
}
