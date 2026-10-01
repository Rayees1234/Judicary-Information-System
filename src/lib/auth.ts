import crypto from 'node:crypto';
import { getDb } from './db/index';

export type UserRole = 'ADMIN' | 'JUDGE' | 'CLERK' | 'LAWYER' | 'LITIGANT';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  court_name?: string;
  designation?: string;
  courtroom?: string;
  bar_registration_no?: string;
  id_number?: string;
  address?: string;
  created_at?: string;
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'jis-judiciary-system-secret-key-2026-secure-token';
const SESSION_COOKIE = 'jis_session';

// Secure PBKDF2 Password Hashing
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(originalHash));
  } catch {
    return false;
  }
}

// Session Token Generation & Verification
export function createSessionToken(userId: number, role: UserRole): string {
  const payload = {
    userId,
    role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): { userId: number; role: UserRole } | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) {
      return null; // Expired
    }

    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

// Request Auth Resolution
export function getCurrentUser(request: Request): User | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );

  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  const db = getDb();
  const row = db.prepare('SELECT id, username, email, full_name, role, phone, court_name, designation, courtroom, bar_registration_no, id_number, address, created_at FROM users WHERE id = ?').get(session.userId) as any;
  if (!row) return null;

  return row as User;
}

export function requireUser(request: Request): User {
  const user = getCurrentUser(request);
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export function requireRole(request: Request, allowedRoles: UserRole[]): User {
  const user = requireUser(request);
  if (!allowedRoles.includes(user.role)) {
    throw new Error('FORBIDDEN');
  }
  return user;
}

export { SESSION_COOKIE };
