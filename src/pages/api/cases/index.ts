import type { APIRoute } from 'astro';
import { getCurrentUser, requireRole } from '../../../lib/auth';
import { searchCases, registerCase, type CaseType } from '../../../lib/services/caseService';
import { caseRegistrationSchema } from '../../../lib/schema';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const user = getCurrentUser(request);
    const query = url.searchParams.get('q') || undefined;
    const caseType = url.searchParams.get('type') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const judgeId = url.searchParams.get('judgeId') ? Number(url.searchParams.get('judgeId')) : undefined;
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50;
    const offset = url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : 0;

    const result = searchCases({ query, caseType, status, judgeId, limit, offset }, user);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const user = requireRole(request, ['CLERK', 'ADMIN']);
    const rawBody = await request.json();

    // Validate with Zod
    const validated = caseRegistrationSchema.parse(rawBody);

    const newCase = registerCase(
      {
        caseType: validated.caseType as CaseType,
        filingDate: validated.filingDate,
        courtName: validated.courtName,
        category: validated.category,
        title: validated.title,
        description: validated.description,
        petitionerName: validated.petitionerName,
        petitionerContact: validated.petitionerContact,
        petitionerAddress: validated.petitionerAddress,
        respondentName: validated.respondentName,
        respondentContact: validated.respondentContact,
        respondentAddress: validated.respondentAddress,
        petitionerLawyerId: validated.petitionerLawyerId,
        respondentLawyerId: validated.respondentLawyerId,
        litigantId: validated.litigantId,
        assignedJudgeId: validated.assignedJudgeId,
        stateCode: validated.stateCode,
        courtCode: validated.courtCode,
      },
      user,
      clientAddress || '127.0.0.1'
    );

    return new Response(JSON.stringify({ case: newCase, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const isZod = error.issues !== undefined;
    const message = isZod ? error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ') : error.message;
    const status = error.message === 'UNAUTHORIZED' ? 401 : error.message === 'FORBIDDEN' ? 403 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
