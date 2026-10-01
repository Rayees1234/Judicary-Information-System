import type { APIRoute } from 'astro';
import { getDb } from '../../../lib/db/index';
import { verifyPassword, createSessionToken, SESSION_COOKIE, type User } from '../../../lib/auth';
import { logAudit } from '../../../lib/services/auditService';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();
    const row = db.prepare(`
      SELECT id, username, email, full_name, role, phone, court_name,
        designation, courtroom, bar_registration_no, id_number, address, password_hash
      FROM users
      WHERE username = ? OR email = ?
    `).get(username.toLowerCase().trim(), username.toLowerCase().trim()) as any;

    if (!row || !verifyPassword(password, row.password_hash)) {
      return new Response(JSON.stringify({ error: 'Invalid username or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = createSessionToken(row.id, row.role);
    cookies.set(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    logAudit(null, row.id, 'USER_LOGIN', `User ${row.username} logged in successfully`, clientAddress || '127.0.0.1');

    const user: User = {
      id: row.id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      phone: row.phone,
      court_name: row.court_name,
      designation: row.designation,
      courtroom: row.courtroom,
      bar_registration_no: row.bar_registration_no,
      id_number: row.id_number,
      address: row.address,
    };

    return new Response(JSON.stringify({ user, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Login failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
