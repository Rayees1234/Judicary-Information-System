import type { APIRoute } from 'astro';
import { requireRole } from '../../../lib/auth';
import { recordOrder, type OrderType } from '../../../lib/services/orderService';
import { orderRecordSchema } from '../../../lib/schema';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const user = requireRole(request, ['JUDGE', 'ADMIN']);
    const body = await request.json();
    const parsed = orderRecordSchema.parse(body);

    const order = recordOrder(
      {
        caseId: parsed.caseId,
        orderType: parsed.orderType as OrderType,
        title: parsed.title,
        orderDate: parsed.orderDate,
        summary: parsed.summary,
        fullText: parsed.fullText,
        documentFilename: parsed.documentFilename,
        documentUrl: parsed.documentUrl,
        isFinal: parsed.isFinal,
      },
      user,
      clientAddress || '127.0.0.1'
    );

    return new Response(JSON.stringify({ order, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return new Response(
        JSON.stringify({ error: error.errors[0]?.message || 'Validation error', details: error.errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
