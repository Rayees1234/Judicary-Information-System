import { getDb } from '../db/index';

export interface DisposalRateStats {
  totalRegistered: number;
  totalDisposed: number;
  clearanceRatePct: number;
  byType: Array<{ case_type: string; registered: number; disposed: number; rate: number }>;
}

export interface PendencyStats {
  totalPending: number;
  under3Months: number;
  between3And6Months: number;
  between6And12Months: number;
  over1Year: number;
  criticalCases: Array<{ id: number; cin: string; title: string; filing_date: string; days_pending: number; case_type: string; judge_name: string }>;
}

export interface AdjournmentStats {
  totalAdjournments: number;
  avgAdjournmentsPerCase: number;
  topReasons: Array<{ reason: string; count: number }>;
  flaggedCases: Array<{ id: number; cin: string; title: string; adjournment_count: number; case_type: string; judge_name: string }>;
}

export interface JudgeWorkloadStats {
  judgeId: number;
  judgeName: string;
  courtroom: string;
  activeCases: number;
  hearingsScheduled: number;
  casesDisposed: number;
}

export function getDisposalRateReport(): DisposalRateStats {
  const db = getDb();

  const regRow = db.prepare('SELECT COUNT(*) as count FROM cases').get() as { count: number };
  const dispRow = db.prepare("SELECT COUNT(*) as count FROM cases WHERE status IN ('DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED')").get() as { count: number };

  const totalRegistered = regRow.count;
  const totalDisposed = dispRow.count;
  const clearanceRatePct = totalRegistered > 0 ? Math.round((totalDisposed / totalRegistered) * 1000) / 10 : 0;

  const typeRows = db.prepare(`
    SELECT 
      case_type,
      COUNT(*) as registered,
      SUM(CASE WHEN status IN ('DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED') THEN 1 ELSE 0 END) as disposed
    FROM cases
    GROUP BY case_type
  `).all() as Array<{ case_type: string; registered: number; disposed: number }>;

  const byType = typeRows.map(r => ({
    case_type: r.case_type,
    registered: r.registered,
    disposed: r.disposed,
    rate: r.registered > 0 ? Math.round((r.disposed / r.registered) * 1000) / 10 : 0,
  }));

  return { totalRegistered, totalDisposed, clearanceRatePct, byType };
}

export function getPendencyReport(): PendencyStats {
  const db = getDb();

  // Active cases calculation using SQLite julian day
  const rows = db.prepare(`
    SELECT 
      c.id, c.cin, c.title, c.filing_date, c.case_type,
      ROUND(julianday('now') - julianday(c.filing_date)) as days_pending,
      COALESCE(u.full_name, 'Unassigned') as judge_name
    FROM cases c
    LEFT JOIN users u ON c.assigned_judge_id = u.id
    WHERE c.status NOT IN ('DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED')
    ORDER BY days_pending DESC
  `).all() as Array<{ id: number; cin: string; title: string; filing_date: string; days_pending: number; case_type: string; judge_name: string }>;

  const totalPending = rows.length;
  let under3Months = 0;
  let between3And6Months = 0;
  let between6And12Months = 0;
  let over1Year = 0;

  for (const row of rows) {
    if (row.days_pending <= 90) under3Months++;
    else if (row.days_pending <= 180) between3And6Months++;
    else if (row.days_pending <= 365) between6And12Months++;
    else over1Year++;
  }

  // Critical cases are those pending > 180 days (or top 10 oldest)
  const criticalCases = rows.filter(r => r.days_pending > 180).slice(0, 10);

  return {
    totalPending,
    under3Months,
    between3And6Months,
    between6And12Months,
    over1Year,
    criticalCases,
  };
}

export function getAdjournmentReport(): AdjournmentStats {
  const db = getDb();

  const totalRow = db.prepare('SELECT COUNT(*) as count FROM adjournments').get() as { count: number };
  const casesCountRow = db.prepare('SELECT COUNT(*) as count FROM cases').get() as { count: number };

  const totalAdjournments = totalRow.count;
  const avgAdjournmentsPerCase = casesCountRow.count > 0 ? Math.round((totalAdjournments / casesCountRow.count) * 10) / 10 : 0;

  const topReasons = db.prepare(`
    SELECT reason, COUNT(*) as count
    FROM adjournments
    GROUP BY reason
    ORDER BY count DESC
    LIMIT 6
  `).all() as Array<{ reason: string; count: number }>;

  const flaggedCases = db.prepare(`
    SELECT 
      c.id, c.cin, c.title, c.adjournment_count, c.case_type,
      COALESCE(u.full_name, 'Unassigned') as judge_name
    FROM cases c
    LEFT JOIN users u ON c.assigned_judge_id = u.id
    WHERE c.adjournment_count >= 2
    ORDER BY c.adjournment_count DESC
    LIMIT 10
  `).all() as Array<{ id: number; cin: string; title: string; adjournment_count: number; case_type: string; judge_name: string }>;

  return { totalAdjournments, avgAdjournmentsPerCase, topReasons, flaggedCases };
}

export function getJudgeWorkloadReport(): JudgeWorkloadStats[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT 
      u.id as judgeId,
      u.full_name as judgeName,
      COALESCE(u.courtroom, 'Unassigned') as courtroom,
      COUNT(DISTINCT CASE WHEN c.status NOT IN ('DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED') THEN c.id END) as activeCases,
      COUNT(DISTINCT CASE WHEN c.status IN ('DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED') THEN c.id END) as casesDisposed,
      COUNT(DISTINCT h.id) as hearingsScheduled
    FROM users u
    LEFT JOIN cases c ON c.assigned_judge_id = u.id
    LEFT JOIN hearings h ON h.judge_id = u.id
    WHERE u.role = 'JUDGE'
    GROUP BY u.id
    ORDER BY activeCases DESC
  `).all() as unknown as JudgeWorkloadStats[];

  return rows;
}
