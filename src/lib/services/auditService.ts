import { getDb } from '../db/index';

export interface AuditLogEntry {
  id: number;
  case_id: number | null;
  user_id: number | null;
  user_name?: string;
  user_role?: string;
  case_cin?: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export function logAudit(
  caseId: number | null,
  userId: number | null,
  action: string,
  details: string | Record<string, any>,
  ipAddress: string = '127.0.0.1'
) {
  const db = getDb();
  const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);

  const stmt = db.prepare(`
    INSERT INTO audit_logs (case_id, user_id, action, details, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(caseId, userId, action, detailsStr, ipAddress);
}

export function getCaseAuditTrail(caseId: number): AuditLogEntry[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT a.*, u.full_name as user_name, u.role as user_role
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.case_id = ?
    ORDER BY a.created_at DESC
  `);
  return stmt.all(caseId) as unknown as AuditLogEntry[];
}

export function getAllAuditLogs(limit: number = 50, offset: number = 0): AuditLogEntry[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT a.*, u.full_name as user_name, u.role as user_role, c.cin as case_cin
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN cases c ON a.case_id = c.id
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as unknown as AuditLogEntry[];
}
