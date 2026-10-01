import type { APIRoute } from 'astro';
import { requireRole } from '../../../../lib/auth';
import { recordProceedings } from '../../../../lib/services/hearingService';

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const user = requireRole(request, ['JUDGE', 'CLERK', 'ADMIN']);
    const hearingId = Number(params.id);
    if (!hearingId) return new Response(JSON.stringify({ error: 'Valid hearing ID required' }), { status: 400 });

    const body = await request.json();
    const { notes, markCompleted } = body;

    const hearing = recordProceedings(hearingId, notes || '', user, Boolean(markCompleted));

    return new Response(JSON.stringify({ hearing, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};
