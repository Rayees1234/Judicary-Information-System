import type { APIRoute } from 'astro';
import { SESSION_COOKIE, getCurrentUser } from '../../../lib/auth';
import { logAudit } from '../../../lib/services/auditService';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const user = getCurrentUser(request);
  if (user) {
    logAudit(null, user.id, 'USER_LOGOUT', `User ${user.username} logged out`, clientAddress || '127.0.0.1');
  }

  cookies.delete(SESSION_COOKIE, { path: '/' });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ redirect, cookies }) => {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/login');
};
