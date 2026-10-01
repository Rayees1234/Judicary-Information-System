import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const user = getCurrentUser(request);
  if (!user) {
    return new Response(JSON.stringify({ user: null }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
