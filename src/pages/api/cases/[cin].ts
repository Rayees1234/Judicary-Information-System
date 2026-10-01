import type { APIRoute } from 'astro';
import { getCurrentUser, requireRole } from '../../../lib/auth';
import { getCaseByCin, updateCase, closeCase } from '../../../lib/services/caseService';
import { getCaseHearings, getCaseAdjournments } from '../../../lib/services/hearingService';
import { getCaseOrders, getCaseDocuments } from '../../../lib/services/orderService';
import { getCaseAuditTrail } from '../../../lib/services/auditService';
import { caseCloseSchema } from '../../../lib/schema';

export const GET: APIRoute = async ({ request, params }) => {
  try {
    const cin = params.cin;
    if (!cin) {
      return new Response(JSON.stringify({ error: 'CIN required' }), { status: 400 });
    }

    const courtCase = getCaseByCin(cin);
    if (!courtCase) {
      return new Response(JSON.stringify({ error: 'Case not found' }), { status: 404 });
    }

    const user = getCurrentUser(request);
    // Role access check for lawyers & litigants
    if (user) {
      if (user.role === 'LAWYER' && courtCase.petitioner_lawyer_id !== user.id && courtCase.respondent_lawyer_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Access restricted to authorized counsel for this case' }), { status: 403 });
      }
      if (user.role === 'LITIGANT' && courtCase.litigant_id !== user.id && courtCase.petitioner_contact !== user.phone && courtCase.respondent_contact !== user.phone) {
        // Litigants can view public case status, but sensitive audit logs or documents are restricted
      }
    }

    const hearings = getCaseHearings(courtCase.id);
    const adjournments = getCaseAdjournments(courtCase.id);
    const orders = getCaseOrders(courtCase.id);
    const documents = getCaseDocuments(courtCase.id);
    const auditTrail = (user && ['ADMIN', 'JUDGE', 'CLERK'].includes(user.role))
      ? getCaseAuditTrail(courtCase.id)
      : [];

    return new Response(JSON.stringify({
      case: courtCase,
      hearings,
      adjournments,
      orders,
      documents,
      auditTrail,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, params, clientAddress }) => {
  try {
    const user = getCurrentUser(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const cin = params.cin;
    const courtCase = getCaseByCin(cin!);
    if (!courtCase) return new Response(JSON.stringify({ error: 'Case not found' }), { status: 404 });

    const body = await request.json();
    const updated = updateCase(courtCase.id, body, user, clientAddress || '127.0.0.1');

    return new Response(JSON.stringify({ case: updated, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};

// Closure Endpoint
export const POST: APIRoute = async ({ request, params, clientAddress }) => {
  try {
    const user = requireRole(request, ['JUDGE', 'ADMIN']);
    const cin = params.cin;
    const courtCase = getCaseByCin(cin!);
    if (!courtCase) return new Response(JSON.stringify({ error: 'Case not found' }), { status: 404 });

    const body = await request.json();
    const parsed = caseCloseSchema.parse(body);

    const closed = closeCase(
      courtCase.id,
      parsed.status,
      parsed.closureReason,
      user,
      clientAddress || '127.0.0.1'
    );

    return new Response(JSON.stringify({ case: closed, success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return new Response(
        JSON.stringify({ error: error.errors[0]?.message || 'Validation error', details: error.errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};
