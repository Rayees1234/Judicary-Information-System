import type { APIRoute } from 'astro';
import { requireRole } from '../../../lib/auth';
import { getAllAuditLogs } from '../../../lib/services/auditService';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    requireRole(request, ['ADMIN']);
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 100;
    const offset = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : 0;

    const logs = getAllAuditLogs(limit, offset);

    return new Response(JSON.stringify({ logs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 403 });
  }
};
