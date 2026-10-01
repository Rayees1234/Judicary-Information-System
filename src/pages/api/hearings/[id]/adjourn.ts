import type { APIRoute } from 'astro';
import { requireRole } from '../../../../lib/auth';
import { recordAdjournment } from '../../../../lib/services/hearingService';
import { adjournmentSchema } from '../../../../lib/schema';

export const POST: APIRoute = async ({ request, params, clientAddress }) => {
  try {
    const user = requireRole(request, ['JUDGE', 'CLERK', 'ADMIN']);
    const hearingId = Number(params.id);
    if (!hearingId) {
      return new Response(JSON.stringify({ error: 'Valid hearing ID required' }), { status: 400 });
    }

    const rawBody = await request.json();
    const validated = adjournmentSchema.parse({ ...rawBody, hearingId });

    const result = recordAdjournment(
      validated.hearingId,
      validated.reason,
      validated.newHearingDate,
      validated.courtroom,
      user,
      clientAddress || '127.0.0.1'
    );

    return new Response(JSON.stringify({ ...result, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const isZod = error.issues !== undefined;
    const message = isZod ? error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ') : error.message;
    return new Response(JSON.stringify({ error: message }), { status: 400 });
  }
};
