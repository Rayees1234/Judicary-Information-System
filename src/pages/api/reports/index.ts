import type { APIRoute } from 'astro';
import { getCurrentUser } from '../../../lib/auth';
import {
  getDisposalRateReport,
  getPendencyReport,
  getAdjournmentReport,
  getJudgeWorkloadReport,
} from '../../../lib/services/reportService';

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = getCurrentUser(request);
    // Court administration, judges, clerks can access reports
    if (!user || !['ADMIN', 'JUDGE', 'CLERK'].includes(user.role)) {
      return new Response(JSON.stringify({ error: 'Unauthorized to access administrative reports' }), { status: 403 });
    }

    const disposal = getDisposalRateReport();
    const pendency = getPendencyReport();
    const adjournments = getAdjournmentReport();
    const judgeWorkloads = getJudgeWorkloadReport();

    return new Response(JSON.stringify({
      disposal,
      pendency,
      adjournments,
      judgeWorkloads,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
