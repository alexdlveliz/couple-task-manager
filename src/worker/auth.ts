import { decodeJwt, decodeProtectedHeader, importX509, jwtVerify, type JWTPayload } from 'jose';
import { validateEnvironment, type Env } from './env';

export class InvalidTokenError extends Error {}
export class KeyServiceError extends Error {}
const certificatesUrl = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificates: Record<string, string> = {};
let expiresAt = 0;

async function signingCertificate(kid: string): Promise<string> {
  if (Date.now() >= expiresAt) {
    let response: Response;
    try { response = await fetch(certificatesUrl); } catch { throw new KeyServiceError(); }
    if (!response.ok) throw new KeyServiceError();
    try {
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
      certificates = body as Record<string, string>;
      const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('cache-control') ?? '');
      expiresAt = Date.now() + (maxAge ? Number(maxAge[1]) * 1000 : 0);
    } catch { throw new KeyServiceError(); }
  }
  if (typeof certificates[kid] !== 'string') throw new InvalidTokenError();
  return certificates[kid];
}
function validateClaims(payload: JWTPayload, project: string): string {
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== project || payload.iss !== `https://securetoken.google.com/${project}` ||
      typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128 ||
      typeof payload.exp !== 'number' || payload.exp <= now ||
      typeof payload.iat !== 'number' || payload.iat > now ||
      typeof payload.auth_time !== 'number' || payload.auth_time > now) throw new InvalidTokenError();
  return payload.sub;
}
export async function verifyFirebaseToken(token: string, env: Env, local = false): Promise<string> {
  validateEnvironment(env, local);
  try {
    const header = decodeProtectedHeader(token);
    let payload: JWTPayload;
    if (env.AUTH_MODE === 'emulator') {
      if (header.alg !== 'none' || token.split('.').length !== 3 || token.split('.')[2] !== '') throw new InvalidTokenError();
      payload = decodeJwt(token);
    } else {
      if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) throw new InvalidTokenError();
      const certificate = await signingCertificate(header.kid);
      let key: Awaited<ReturnType<typeof importX509>>;
      try { key = await importX509(certificate, 'RS256'); } catch { throw new KeyServiceError(); }
      ({ payload } = await jwtVerify(token, key, { algorithms: ['RS256'], audience: env.FIREBASE_PROJECT_ID, issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` }));
    }
    return validateClaims(payload, env.FIREBASE_PROJECT_ID);
  } catch (error) {
    if (error instanceof KeyServiceError) throw error;
    throw new InvalidTokenError();
  }
}
