import { getDb } from '../db/index';
import { logAudit } from './auditService';
import { dispatchNotification } from './notificationService';
import type { User } from '../auth';

export type CaseType = 'CIVIL' | 'CRIMINAL' | 'WRIT_PETITION' | 'APPEAL' | 'FAMILY' | 'COMMERCIAL';
export type CaseStatus = 'FILED' | 'REGISTERED' | 'HEARING_SCHEDULED' | 'ADJOURNED' | 'RESERVED_FOR_JUDGMENT' | 'DISPOSED' | 'SETTLED' | 'WITHDRAWN' | 'CLOSED';

export interface CaseRecord {
  id: number;
  cin: string;
  case_type: CaseType;
  filing_date: string;
  status: CaseStatus;
  court_name: string;
  category: string;
  title: string;
  description: string;
  petitioner_name: string;
  petitioner_contact: string;
  petitioner_address: string;
  respondent_name: string;
  respondent_contact: string;
  respondent_address: string;
  petitioner_lawyer_id: number | null;
  respondent_lawyer_id: number | null;
  litigant_id: number | null;
  assigned_judge_id: number | null;
  registered_by_id: number | null;
  adjournment_count: number;
  closure_reason: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  judge_name?: string;
  judge_courtroom?: string;
  petitioner_lawyer_name?: string;
  respondent_lawyer_name?: string;
}

// Generate unique CIN in format: STATE-COURT-TYPE-YEAR-SEQUENCE
// e.g. DL-HC-CIV-2026-0001
export function generateCIN(stateCode: string = 'DL', courtCode: string = 'HC', caseType: CaseType, year: number = new Date().getFullYear()): string {
  const db = getDb();
  const typeMap: Record<CaseType, string> = {
    CIVIL: 'CIV',
    CRIMINAL: 'CRM',
    WRIT_PETITION: 'WPT',
    APPEAL: 'APP',
    FAMILY: 'FAM',
    COMMERCIAL: 'COM',
  };

  const code = typeMap[caseType] || 'GEN';
  const prefix = `${stateCode}-${courtCode}-${code}-${year}`;

  // Find max sequence for this prefix
  const row = db.prepare(`
    SELECT cin FROM cases 
    WHERE cin LIKE ? 
    ORDER BY cin DESC LIMIT 1
  `).get(`${prefix}-%`) as { cin: string } | undefined;

  let nextSeq = 1;
  if (row && row.cin) {
    const parts = row.cin.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  const seqStr = nextSeq.toString().padStart(4, '0');
  return `${prefix}-${seqStr}`;
}

export interface RegisterCaseInput {
  caseType: CaseType;
  filingDate: string;
  courtName: string;
  category: string;
  title: string;
  description?: string;
  petitionerName: string;
  petitionerContact?: string;
  petitionerAddress?: string;
  respondentName: string;
  respondentContact?: string;
  respondentAddress?: string;
  petitionerLawyerId?: number | null;
  respondentLawyerId?: number | null;
  litigantId?: number | null;
  assignedJudgeId?: number | null;
  stateCode?: string;
  courtCode?: string;
}

export function registerCase(input: RegisterCaseInput, user: User, clientIp: string = '127.0.0.1'): CaseRecord {
  // Mandatory fields check
  if (!input.caseType || !input.filingDate || !input.courtName || !input.category || !input.title || !input.petitionerName || !input.respondentName) {
    throw new Error('Mandatory fields missing for case registration');
  }

  // Only Clerks/Registrars and Admins can officially register cases
  if (!['CLERK', 'ADMIN'].includes(user.role)) {
    throw new Error('Only Court Clerks/Registrars and Administrators can register cases');
  }

  const db = getDb();
  const year = new Date(input.filingDate).getFullYear() || new Date().getFullYear();
  const cin = generateCIN(input.stateCode || 'DL', input.courtCode || 'HC', input.caseType, year);

  const initialStatus: CaseStatus = 'REGISTERED';
  const assignedLitigantId = input.litigantId || null;
  const assignedLawyerId = input.petitionerLawyerId || null;

  db.exec('BEGIN');
  try {
    const stmt = db.prepare(`
      INSERT INTO cases (
        cin, case_type, filing_date, status, court_name, category,
        title, description, petitioner_name, petitioner_contact, petitioner_address,
        respondent_name, respondent_contact, respondent_address,
        petitioner_lawyer_id, respondent_lawyer_id, litigant_id,
        assigned_judge_id, registered_by_id, adjournment_count
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, 0
      )
    `);

    const result = stmt.run(
      cin,
      input.caseType,
      input.filingDate,
      initialStatus,
      input.courtName,
      input.category,
      input.title,
      input.description || '',
      input.petitionerName,
      input.petitionerContact || (user.role === 'LITIGANT' ? user.phone || '' : ''),
      input.petitionerAddress || '',
      input.respondentName,
      input.respondentContact || '',
      input.respondentAddress || '',
      assignedLawyerId,
      input.respondentLawyerId || null,
      assignedLitigantId,
      input.assignedJudgeId || null,
      user.id
    );

    const caseId = Number(result.lastInsertRowid);

    // Initial petition document record
    db.prepare(`
      INSERT INTO case_documents (case_id, title, document_type, file_path, file_size, uploaded_by_id)
      VALUES (?, ?, 'PETITION', ?, 128000, ?)
    `).run(caseId, `Original Petition: ${input.title}`, `/documents/${cin}_PETITION.pdf`, user.id);

    // Log Audit Event
    logAudit(
      caseId,
      user.id,
      'CASE_REGISTERED',
      `Case registered with CIN: ${cin}. Status: ${initialStatus}. Title: ${input.title}`,
      clientIp
    );

    // Notifications
    if (assignedLawyerId) {
      dispatchNotification(
        assignedLawyerId,
        caseId,
        'CASE_REGISTERED',
        `Designated counsel for petitioner in case ${cin}: ${input.title}`,
        'EMAIL'
      );
    }
    if (input.respondentLawyerId) {
      dispatchNotification(
        input.respondentLawyerId,
        caseId,
        'CASE_REGISTERED',
        `Notice of appearance: Designated counsel for respondent in case ${cin}`,
        'EMAIL'
      );
    }
    if (input.assignedJudgeId) {
      dispatchNotification(
        input.assignedJudgeId,
        caseId,
        'CASE_ASSIGNED',
        `New case ${cin} assigned to your bench: ${input.title}`,
        'SYSTEM'
      );
    }

    db.exec('COMMIT');
    return getCaseByCin(cin)!;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function verifyAndRegisterFiledCase(caseId: number, clerkUser: User, clientIp: string = '127.0.0.1'): CaseRecord {
  if (!['CLERK', 'ADMIN'].includes(clerkUser.role)) {
    throw new Error('Only Court Clerks or Administrators can verify and register cases');
  }

  const courtCase = getCaseById(caseId);
  if (!courtCase) throw new Error('Case not found');
  if (courtCase.status !== 'FILED') {
    throw new Error(`Cannot register case with status ${courtCase.status}; only FILED cases can be verified`);
  }

  const db = getDb();
  db.prepare(`
    UPDATE cases 
    SET status = 'REGISTERED', registered_by_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(clerkUser.id, caseId);

  logAudit(
    caseId,
    clerkUser.id,
    'CASE_VERIFIED_REGISTERED',
    `Case ${courtCase.cin} verified and formally registered by ${clerkUser.full_name}`,
    clientIp
  );

  return getCaseById(caseId)!;
}

export function getCaseByCin(cin: string): CaseRecord | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT c.*, 
      j.full_name as judge_name, j.courtroom as judge_courtroom,
      lp.full_name as petitioner_lawyer_name,
      lr.full_name as respondent_lawyer_name
    FROM cases c
    LEFT JOIN users j ON c.assigned_judge_id = j.id
    LEFT JOIN users lp ON c.petitioner_lawyer_id = lp.id
    LEFT JOIN users lr ON c.respondent_lawyer_id = lr.id
    WHERE c.cin = ?
  `);
  const row = stmt.get(cin) as unknown as CaseRecord | undefined;
  return row || null;
}

export function getCaseById(id: number): CaseRecord | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT c.*, 
      j.full_name as judge_name, j.courtroom as judge_courtroom,
      lp.full_name as petitioner_lawyer_name,
      lr.full_name as respondent_lawyer_name
    FROM cases c
    LEFT JOIN users j ON c.assigned_judge_id = j.id
    LEFT JOIN users lp ON c.petitioner_lawyer_id = lp.id
    LEFT JOIN users lr ON c.respondent_lawyer_id = lr.id
    WHERE c.id = ?
  `);
  const row = stmt.get(id) as unknown as CaseRecord | undefined;
  return row || null;
}

export interface SearchCasesParams {
  query?: string;
  caseType?: string;
  status?: string;
  judgeId?: number;
  courtName?: string;
  limit?: number;
  offset?: number;
}

export function searchCases(params: SearchCasesParams, user: User | null): { cases: CaseRecord[]; total: number } {
  const db = getDb();
  let whereClauses: string[] = ['1=1'];
  let bindings: any[] = [];

  // Role-based scoping
  if (user) {
    if (user.role === 'LAWYER') {
      whereClauses.push('(c.petitioner_lawyer_id = ? OR c.respondent_lawyer_id = ?)');
      bindings.push(user.id, user.id);
    } else if (user.role === 'LITIGANT') {
      whereClauses.push('(c.litigant_id = ? OR c.petitioner_contact = ? OR c.respondent_contact = ?)');
      bindings.push(user.id, user.phone || 'NA', user.phone || 'NA');
    }
  }

  // Filter params
  if (params.query) {
    const q = `%${params.query.trim()}%`;
    whereClauses.push('(c.cin LIKE ? OR c.title LIKE ? OR c.petitioner_name LIKE ? OR c.respondent_name LIKE ?)');
    bindings.push(q, q, q, q);
  }

  if (params.caseType) {
    whereClauses.push('c.case_type = ?');
    bindings.push(params.caseType);
  }

  if (params.status) {
    whereClauses.push('c.status = ?');
    bindings.push(params.status);
  }

  if (params.judgeId) {
    whereClauses.push('c.assigned_judge_id = ?');
    bindings.push(params.judgeId);
  }

  if (params.courtName) {
    whereClauses.push('c.court_name = ?');
    bindings.push(params.courtName);
  }

  const whereSQL = whereClauses.join(' AND ');

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM cases c WHERE ${whereSQL}`).get(...bindings) as { total: number };
  const total = countRow ? countRow.total : 0;

  const limit = params.limit || 50;
  const offset = params.offset || 0;

  const listBindings = [...bindings, limit, offset];
  const rows = db.prepare(`
    SELECT c.*, 
      j.full_name as judge_name, j.courtroom as judge_courtroom,
      lp.full_name as petitioner_lawyer_name,
      lr.full_name as respondent_lawyer_name
    FROM cases c
    LEFT JOIN users j ON c.assigned_judge_id = j.id
    LEFT JOIN users lp ON c.petitioner_lawyer_id = lp.id
    LEFT JOIN users lr ON c.respondent_lawyer_id = lr.id
    WHERE ${whereSQL}
    ORDER BY c.filing_date DESC, c.id DESC
    LIMIT ? OFFSET ?
  `).all(...listBindings) as unknown as CaseRecord[];

  return { cases: rows, total };
}

// Close case with stated reason (SRS §5 & Exp 2 P3)
export function closeCase(
  caseId: number,
  status: 'DISPOSED' | 'SETTLED' | 'WITHDRAWN' | 'CLOSED',
  closureReason: string,
  user: User,
  clientIp: string = '127.0.0.1'
): CaseRecord {
  // Only Judge or Admin can close a case
  if (!['JUDGE', 'ADMIN'].includes(user.role)) {
    throw new Error('Only Judges or Administrators can record case closure');
  }

  if (!closureReason || closureReason.trim().length < 5) {
    throw new Error('A detailed closure reason is mandatory');
  }

  const existing = getCaseById(caseId);
  if (!existing) {
    throw new Error('Case not found');
  }

  if (['DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED'].includes(existing.status)) {
    throw new Error(`Case ${existing.cin} is already closed with status ${existing.status}`);
  }

  const db = getDb();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE cases 
      SET status = ?, closure_reason = ?, closed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, closureReason, now, caseId);

    logAudit(
      caseId,
      user.id,
      'CASE_CLOSED',
      `Case ${existing.cin} closed with status ${status}. Reason: ${closureReason}`,
      clientIp
    );

    db.exec('COMMIT');
    return getCaseById(caseId)!;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Update case details with immutability protection for closed cases
export function updateCase(
  caseId: number,
  updates: Partial<CaseRecord>,
  user: User,
  clientIp: string = '127.0.0.1'
): CaseRecord {
  const existing = getCaseById(caseId);
  if (!existing) throw new Error('Case not found');

  const isClosed = ['DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED'].includes(existing.status);

  // SRS Rule: "A closed case can still be looked at, but it can no longer be edited except by an administrator, and even that leaves a trace in the audit log."
  if (isClosed && user.role !== 'ADMIN') {
    throw new Error('Case is closed. Only an Administrator can modify closed case records.');
  }

  const db = getDb();
  const allowedFields = [
    'title', 'description', 'court_name', 'category',
    'petitioner_name', 'petitioner_contact', 'petitioner_address',
    'respondent_name', 'respondent_contact', 'respondent_address',
    'petitioner_lawyer_id', 'respondent_lawyer_id', 'assigned_judge_id',
    'status'
  ];

  const setClauses: string[] = [];
  const bindings: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      setClauses.push(`${key} = ?`);
      bindings.push(value);
    }
  }

  if (setClauses.length === 0) return existing;

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  bindings.push(caseId);

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE cases SET ${setClauses.join(', ')} WHERE id = ?`).run(...bindings);

    logAudit(
      caseId,
      user.id,
      isClosed ? 'ADMIN_CLOSED_CASE_MODIFIED' : 'CASE_UPDATED',
      `Fields updated: ${Object.keys(updates).join(', ')}`,
      clientIp
    );

    db.exec('COMMIT');
    return getCaseById(caseId)!;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
