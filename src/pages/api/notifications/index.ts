import type { APIRoute } from 'astro';
import { requireUser } from '../../../lib/auth';
import { getUserNotifications, markNotificationAsRead } from '../../../lib/services/notificationService';

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = requireUser(request);
    const notifications = getUserNotifications(user.id);

    return new Response(JSON.stringify({ notifications }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 401 });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const user = requireUser(request);
    const body = await request.json();
    const { id } = body;

    if (!id) return new Response(JSON.stringify({ error: 'Notification ID required' }), { status: 400 });

    markNotificationAsRead(Number(id), user.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};
