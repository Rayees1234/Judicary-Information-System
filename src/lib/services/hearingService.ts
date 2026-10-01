import { getDb } from '../db/index';
import { logAudit } from './auditService';
import { dispatchNotification } from './notificationService';
import { getCaseById } from './caseService';
import type { User } from '../auth';

export interface HearingRecord {
  id: number;
  case_id: number;
  hearing_date: string;
  courtroom: string;
  judge_id: number | null;
  purpose: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'ADJOURNED' | 'CANCELLED';
  proceedings_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  case_cin?: string;
  case_title?: string;
  case_type?: string;
  petitioner_name?: string;
  respondent_name?: string;
  judge_name?: string;
  petitioner_lawyer_name?: string;
  respondent_lawyer_name?: string;
}

export interface AdjournmentRecord {
  id: number;
  hearing_id: number;
  case_id: number;
  reason: string;
  new_hearing_date: string;
  adjournment_number: number;
  granted_by_id: number | null;
  created_at: string;
  granted_by_name?: string;
}

// Conflict checking: checks if judge or courtroom has an overlapping hearing
export function checkHearingConflict(
  hearingDate: string,
  courtroom: string,
  judgeId: number | null,
  excludeHearingId?: number
): { conflict: boolean; message?: string } {
  const db = getDb();
  const normalizedDate = hearingDate.trim();

  // Courtroom conflict check (exact time slot conflict)
  let courtSql = `
    SELECT h.id, h.hearing_date, h.courtroom, c.cin, c.title
    FROM hearings h
    JOIN cases c ON h.case_id = c.id
    WHERE h.courtroom = ? AND h.hearing_date = ? AND h.status = 'SCHEDULED'
  `;
  const courtBindings: any[] = [courtroom.trim(), normalizedDate];
  if (excludeHearingId) {
    courtSql += ' AND h.id != ?';
    courtBindings.push(excludeHearingId);
  }

  const courtConflict = db.prepare(courtSql).get(...courtBindings) as any;
  if (courtConflict) {
    return {
      conflict: true,
      message: `Courtroom ${courtroom} is already booked at ${normalizedDate} for Case ${courtConflict.cin} (${courtConflict.title}).`,
    };
  }

  // Judge conflict check
  if (judgeId) {
    let judgeSql = `
      SELECT h.id, h.hearing_date, u.full_name, c.cin, c.title
      FROM hearings h
      JOIN users u ON h.judge_id = u.id
      JOIN cases c ON h.case_id = c.id
      WHERE h.judge_id = ? AND h.hearing_date = ? AND h.status = 'SCHEDULED'
    `;
    const judgeBindings: any[] = [judgeId, normalizedDate];
    if (excludeHearingId) {
      judgeSql += ' AND h.id != ?';
      judgeBindings.push(excludeHearingId);
    }

    const judgeConflict = db.prepare(judgeSql).get(...judgeBindings) as any;
    if (judgeConflict) {
      return {
        conflict: true,
        message: `Judge ${judgeConflict.full_name} is already presiding over Case ${judgeConflict.cin} at ${normalizedDate}.`,
      };
    }
  }

  return { conflict: false };
}

export interface ScheduleHearingInput {
  caseId: number;
  hearingDate: string; // YYYY-MM-DD HH:MM
  courtroom: string;
  judgeId?: number | null;
  purpose: string;
}

export function scheduleHearing(
  input: ScheduleHearingInput,
  user: User,
  clientIp: string = '127.0.0.1'
): HearingRecord {
  // Only Judge, Clerk, or Admin can schedule
  if (!['JUDGE', 'CLERK', 'ADMIN'].includes(user.role)) {
    throw new Error('Only Judges, Clerks, or Administrators can schedule hearings');
  }

  const courtCase = getCaseById(input.caseId);
  if (!courtCase) throw new Error('Case not found');

  if (['DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED'].includes(courtCase.status)) {
    throw new Error('Cannot schedule a hearing for a closed/disposed case');
  }

  const judgeId = input.judgeId || courtCase.assigned_judge_id;
  const normalizedDate = input.hearingDate.trim();

  // Conflict Check
  const conflictCheck = checkHearingConflict(normalizedDate, input.courtroom, judgeId);
  if (conflictCheck.conflict) {
    throw new Error(`Scheduling Conflict: ${conflictCheck.message}`);
  }

  const db = getDb();
  db.exec('BEGIN');
  try {
    const result = db.prepare(`
      INSERT INTO hearings (case_id, hearing_date, courtroom, judge_id, purpose, status)
      VALUES (?, ?, ?, ?, ?, 'SCHEDULED')
    `).run(input.caseId, normalizedDate, input.courtroom.trim(), judgeId, input.purpose.trim());

    const hearingId = Number(result.lastInsertRowid);

    // Update case status to HEARING_SCHEDULED if currently REGISTERED or ADJOURNED
    db.prepare(`
      UPDATE cases 
      SET status = 'HEARING_SCHEDULED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status IN ('REGISTERED', 'ADJOURNED')
    `).run(input.caseId);

    // Audit Log
    logAudit(
      input.caseId,
      user.id,
      'HEARING_SCHEDULED',
      `Hearing scheduled for ${normalizedDate} in Courtroom ${input.courtroom}. Purpose: ${input.purpose}`,
      clientIp
    );

    // Notifications
    const notifMsg = `Hearing scheduled for case ${courtCase.cin} on ${normalizedDate} in Courtroom ${input.courtroom}.`;
    if (courtCase.petitioner_lawyer_id) {
      dispatchNotification(courtCase.petitioner_lawyer_id, input.caseId, 'HEARING_SCHEDULED', notifMsg, 'EMAIL');
    }
    if (courtCase.respondent_lawyer_id) {
      dispatchNotification(courtCase.respondent_lawyer_id, input.caseId, 'HEARING_SCHEDULED', notifMsg, 'EMAIL');
    }
    if (courtCase.litigant_id) {
      dispatchNotification(courtCase.litigant_id, input.caseId, 'HEARING_SCHEDULED', notifMsg, 'SMS');
    }

    db.exec('COMMIT');
    return getHearingById(hearingId)!;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function recordAdjournment(
  hearingId: number,
  reason: string,
  newHearingDate: string,
  courtroom: string,
  user: User,
  clientIp: string = '127.0.0.1'
): { hearing: HearingRecord; adjournment: AdjournmentRecord } {
  if (!['JUDGE', 'CLERK', 'ADMIN'].includes(user.role)) {
    throw new Error('Only Judges, Clerks, or Administrators can record adjournments');
  }

  if (!reason || reason.trim().length < 5) {
    throw new Error('Adjournment reason is mandatory');
  }

  const currentHearing = getHearingById(hearingId);
  if (!currentHearing) throw new Error('Hearing record not found');

  const courtCase = getCaseById(currentHearing.case_id);
  if (!courtCase) throw new Error('Case not found');

  if (['DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED'].includes(courtCase.status)) {
    throw new Error('Cannot adjourn hearing for an already closed/disposed case');
  }

  const normalizedNewDate = newHearingDate.trim();

  // Check conflicts for the new hearing date
  const conflictCheck = checkHearingConflict(normalizedNewDate, courtroom, currentHearing.judge_id);
  if (conflictCheck.conflict) {
    throw new Error(`Conflict for adjourned date: ${conflictCheck.message}`);
  }

  const db = getDb();

  // Next adjournment tally
  const newTally = (courtCase.adjournment_count || 0) + 1;

  db.exec('BEGIN');
  try {
    // 1. Mark current hearing as ADJOURNED
    db.prepare(`UPDATE hearings SET status = 'ADJOURNED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(hearingId);

    // 2. Insert into adjournments table
    const adjResult = db.prepare(`
      INSERT INTO adjournments (hearing_id, case_id, reason, new_hearing_date, adjournment_number, granted_by_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(hearingId, courtCase.id, reason.trim(), normalizedNewDate, newTally, user.id);

    // 3. Update case status to ADJOURNED and increment running tally
    db.prepare(`
      UPDATE cases 
      SET status = 'ADJOURNED', adjournment_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(newTally, courtCase.id);

    // 4. Create new hearing record for the rescheduled date
    const newHrgResult = db.prepare(`
      INSERT INTO hearings (case_id, hearing_date, courtroom, judge_id, purpose, status)
      VALUES (?, ?, ?, ?, ?, 'SCHEDULED')
    `).run(
      courtCase.id,
      normalizedNewDate,
      courtroom.trim(),
      currentHearing.judge_id,
      `Adjourned hearing (Adjournment #${newTally}): ${currentHearing.purpose}`
    );

    const newHearingId = Number(newHrgResult.lastInsertRowid);
    const adjournmentId = Number(adjResult.lastInsertRowid);

    // Audit Log
    logAudit(
      courtCase.id,
      user.id,
      'HEARING_ADJOURNED',
      `Adjournment #${newTally} logged. Reason: ${reason}. Rescheduled to: ${normalizedNewDate}`,
      clientIp
    );

    // Notifications
    const notifMsg = `Notice: Hearing for Case ${courtCase.cin} has been adjourned to ${normalizedNewDate}. Reason: ${reason} (Adjournment #${newTally})`;
    if (courtCase.petitioner_lawyer_id) {
      dispatchNotification(courtCase.petitioner_lawyer_id, courtCase.id, 'HEARING_ADJOURNED', notifMsg, 'EMAIL');
    }
    if (courtCase.respondent_lawyer_id) {
      dispatchNotification(courtCase.respondent_lawyer_id, courtCase.id, 'HEARING_ADJOURNED', notifMsg, 'EMAIL');
    }
    if (courtCase.litigant_id) {
      dispatchNotification(courtCase.litigant_id, courtCase.id, 'HEARING_ADJOURNED', notifMsg, 'SMS');
    }

    db.exec('COMMIT');

    const adj = db.prepare('SELECT * FROM adjournments WHERE id = ?').get(adjournmentId) as unknown as AdjournmentRecord;
    return {
      hearing: getHearingById(newHearingId)!,
      adjournment: adj,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function recordProceedings(
  hearingId: number,
  notes: string,
  user: User,
  markCompleted: boolean = false
): HearingRecord {
  if (!['JUDGE', 'CLERK', 'ADMIN'].includes(user.role)) {
    throw new Error('Only Judges or Clerks can record proceedings');
  }

  const db = getDb();
  const statusUpdate = markCompleted ? ", status = 'COMPLETED'" : '';
  db.prepare(`
    UPDATE hearings 
    SET proceedings_notes = ?, updated_at = CURRENT_TIMESTAMP ${statusUpdate}
    WHERE id = ?
  `).run(notes, hearingId);

  const hearing = getHearingById(hearingId)!;
  logAudit(hearing.case_id, user.id, 'PROCEEDINGS_RECORDED', `Notes recorded for hearing on ${hearing.hearing_date}`);

  return hearing;
}

export function getHearingById(id: number): HearingRecord | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT h.*, 
      c.cin as case_cin, c.title as case_title, c.case_type,
      c.petitioner_name, c.respondent_name,
      j.full_name as judge_name,
      lp.full_name as petitioner_lawyer_name,
      lr.full_name as respondent_lawyer_name
    FROM hearings h
    JOIN cases c ON h.case_id = c.id
    LEFT JOIN users j ON h.judge_id = j.id
    LEFT JOIN users lp ON c.petitioner_lawyer_id = lp.id
    LEFT JOIN users lr ON c.respondent_lawyer_id = lr.id
    WHERE h.id = ?
  `).get(id) as unknown as HearingRecord | undefined;
  return row || null;
}

export function getCaseHearings(caseId: number): HearingRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT h.*, 
      j.full_name as judge_name
    FROM hearings h
    LEFT JOIN users j ON h.judge_id = j.id
    WHERE h.case_id = ?
    ORDER BY h.hearing_date DESC
  `).all(caseId) as unknown as HearingRecord[];
}

export function getCaseAdjournments(caseId: number): AdjournmentRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, u.full_name as granted_by_name
    FROM adjournments a
    LEFT JOIN users u ON a.granted_by_id = u.id
    WHERE a.case_id = ?
    ORDER BY a.created_at DESC
  `).all(caseId) as unknown as AdjournmentRecord[];
}

// Cause List query
export function getCauseList(date: string, courtroom?: string, judgeId?: number): HearingRecord[] {
  const db = getDb();
  let sql = `
    SELECT h.*, 
      c.cin as case_cin, c.title as case_title, c.case_type,
      c.petitioner_name, c.respondent_name,
      j.full_name as judge_name,
      lp.full_name as petitioner_lawyer_name,
      lr.full_name as respondent_lawyer_name
    FROM hearings h
    JOIN cases c ON h.case_id = c.id
    LEFT JOIN users j ON h.judge_id = j.id
    LEFT JOIN users lp ON c.petitioner_lawyer_id = lp.id
    LEFT JOIN users lr ON c.respondent_lawyer_id = lr.id
    WHERE h.hearing_date LIKE ? AND h.status = 'SCHEDULED'
  `;
  const bindings: any[] = [`${date}%`];

  if (courtroom) {
    sql += ' AND h.courtroom = ?';
    bindings.push(courtroom);
  }
  if (judgeId) {
    sql += ' AND h.judge_id = ?';
    bindings.push(judgeId);
  }

  sql += ' ORDER BY h.hearing_date ASC';
  return db.prepare(sql).all(...bindings) as unknown as HearingRecord[];
}
