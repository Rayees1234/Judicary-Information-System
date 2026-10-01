import type { APIRoute } from 'astro';
import { requireRole } from '../../../lib/auth';
import { scheduleHearing, getCauseList } from '../../../lib/services/hearingService';
import { hearingScheduleSchema } from '../../../lib/schema';

export const GET: APIRoute = async ({ url }) => {
  try {
    const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const courtroom = url.searchParams.get('courtroom') || undefined;
    const judgeId = url.searchParams.get('judgeId') ? Number(url.searchParams.get('judgeId')) : undefined;

    const causeList = getCauseList(date, courtroom, judgeId);

    return new Response(JSON.stringify({ date, causeList }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const user = requireRole(request, ['JUDGE', 'CLERK', 'ADMIN']);
    const rawBody = await request.json();

    const validated = hearingScheduleSchema.parse(rawBody);

    const hearing = scheduleHearing(
      {
        caseId: validated.caseId,
        hearingDate: validated.hearingDate,
        courtroom: validated.courtroom,
        judgeId: validated.judgeId,
        purpose: validated.purpose,
      },
      user,
      clientAddress || '127.0.0.1'
    );

    return new Response(JSON.stringify({ hearing, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const isZod = error.issues !== undefined;
    const message = isZod ? error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ') : error.message;
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
