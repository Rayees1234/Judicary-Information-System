import { getDb } from '../db/index';
import { logAudit } from './auditService';
import { dispatchNotification } from './notificationService';
import { getCaseById, closeCase } from './caseService';
import type { User } from '../auth';

export type OrderType = 'INTERIM_ORDER' | 'BAIL_ORDER' | 'FINAL_JUDGMENT' | 'DISMISSAL_ORDER' | 'DECREE';

export interface OrderRecord {
  id: number;
  case_id: number;
  order_type: OrderType;
  title: string;
  order_date: string;
  passed_by_id: number | null;
  summary: string;
  full_text: string;
  document_filename: string | null;
  document_url: string | null;
  is_final: number;
  created_at: string;
  passed_by_name?: string;
  case_cin?: string;
  case_title?: string;
}

export interface CaseDocumentRecord {
  id: number;
  case_id: number;
  title: string;
  document_type: 'PETITION' | 'EVIDENCE' | 'AFFIDAVIT' | 'WRITTEN_STATEMENT' | 'ANNEXURE' | 'REJOINDER' | 'ORDER_COPY';
  file_path: string;
  file_size: number;
  uploaded_by_id: number | null;
  uploaded_at: string;
  uploaded_by_name?: string;
}

export interface RecordOrderInput {
  caseId: number;
  orderType: OrderType;
  title: string;
  orderDate: string;
  summary: string;
  fullText: string;
  documentFilename?: string;
  documentUrl?: string;
  isFinal?: boolean;
}

export function recordOrder(
  input: RecordOrderInput,
  user: User,
  clientIp: string = '127.0.0.1'
): OrderRecord {
  // Only Judges and Admins can issue and sign orders/judgments
  if (user.role !== 'JUDGE' && user.role !== 'ADMIN') {
    throw new Error('Only Judges can record orders and judgments');
  }

  if (!input.title || !input.summary || !input.fullText || !input.orderDate) {
    throw new Error('Title, summary, full text, and order date are mandatory');
  }

  const courtCase = getCaseById(input.caseId);
  if (!courtCase) throw new Error('Case not found');

  const isClosed = ['DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED'].includes(courtCase.status);
  if (isClosed && user.role !== 'ADMIN') {
    throw new Error(`Cannot record new orders on closed/disposed case ${courtCase.cin}.`);
  }

  const isFinal = Boolean(input.isFinal || input.orderType === 'FINAL_JUDGMENT' || input.orderType === 'DISMISSAL_ORDER' || input.orderType === 'DECREE');

  const db = getDb();
  const docName = input.documentFilename || `${courtCase.cin}_ORDER_${Date.now()}.pdf`;
  const docUrl = input.documentUrl || `/documents/${docName}`;

  db.exec('BEGIN');
  try {
    const stmt = db.prepare(`
      INSERT INTO orders_judgments (
        case_id, order_type, title, order_date, passed_by_id, summary, full_text,
        document_filename, document_url, is_final
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      input.caseId,
      input.orderType,
      input.title.trim(),
      input.orderDate.trim(),
      user.id,
      input.summary.trim(),
      input.fullText.trim(),
      docName,
      docUrl,
      isFinal ? 1 : 0
    );

    const orderId = Number(result.lastInsertRowid);

    // Also record in case_documents table as an ORDER_COPY
    db.prepare(`
      INSERT INTO case_documents (case_id, title, document_type, file_path, file_size, uploaded_by_id)
      VALUES (?, ?, 'ORDER_COPY', ?, 1024, ?)
    `).run(input.caseId, `Signed Order: ${input.title}`, docUrl, user.id);

    // If final judgment, trigger case closure workflow
    if (isFinal) {
      const now = new Date().toISOString();
      const closureReason = `Disposed via Final Judgment: ${input.title} passed by ${user.full_name}`;
      db.prepare(`
        UPDATE cases 
        SET status = 'DISPOSED', closure_reason = ?, closed_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(closureReason, now, input.caseId);

      logAudit(
        input.caseId,
        user.id,
        'CASE_CLOSED',
        `Case ${courtCase.cin} closed with status DISPOSED on final judgment`,
        clientIp
      );
    }

    // Audit Log
    logAudit(
      input.caseId,
      user.id,
      'ORDER_RECORDED',
      `Order issued: [${input.orderType}] ${input.title}. Final: ${isFinal ? 'YES (Case Disposed)' : 'NO'}`,
      clientIp
    );

    // Notifications
    const notifMsg = `New order passed in case ${courtCase.cin}: ${input.title}. Certified copy ready.`;
    if (courtCase.petitioner_lawyer_id) {
      dispatchNotification(courtCase.petitioner_lawyer_id, input.caseId, 'ORDER_PASSED', notifMsg, 'EMAIL');
    }
    if (courtCase.respondent_lawyer_id) {
      dispatchNotification(courtCase.respondent_lawyer_id, input.caseId, 'ORDER_PASSED', notifMsg, 'EMAIL');
    }
    if (courtCase.litigant_id) {
      dispatchNotification(courtCase.litigant_id, input.caseId, 'ORDER_PASSED', notifMsg, 'SMS');
    }

    db.exec('COMMIT');
    return getOrderById(orderId)!;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getOrderById(id: number): OrderRecord | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT o.*, u.full_name as passed_by_name, c.cin as case_cin, c.title as case_title
    FROM orders_judgments o
    LEFT JOIN users u ON o.passed_by_id = u.id
    LEFT JOIN cases c ON o.case_id = c.id
    WHERE o.id = ?
  `).get(id) as unknown as OrderRecord | undefined;
  return row || null;
}

export function getCaseOrders(caseId: number): OrderRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT o.*, u.full_name as passed_by_name
    FROM orders_judgments o
    LEFT JOIN users u ON o.passed_by_id = u.id
    WHERE o.case_id = ?
    ORDER BY o.order_date DESC, o.id DESC
  `).all(caseId) as unknown as OrderRecord[];
}

export function addCaseDocument(
  caseId: number,
  title: string,
  docType: 'PETITION' | 'EVIDENCE' | 'AFFIDAVIT' | 'WRITTEN_STATEMENT' | 'ANNEXURE' | 'REJOINDER',
  filePath: string,
  fileSize: number,
  user: User
): CaseDocumentRecord {
  const courtCase = getCaseById(caseId);
  if (!courtCase) throw new Error('Case not found');

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO case_documents (case_id, title, document_type, file_path, file_size, uploaded_by_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(caseId, title.trim(), docType, filePath, fileSize, user.id);

  logAudit(caseId, user.id, 'DOCUMENT_UPLOADED', `Document uploaded: [${docType}] ${title}`);

  const docId = Number(result.lastInsertRowid);
  return db.prepare('SELECT * FROM case_documents WHERE id = ?').get(docId) as unknown as CaseDocumentRecord;
}

export function getCaseDocuments(caseId: number): CaseDocumentRecord[] {
  const db = getDb();
  return db.prepare(`
    SELECT d.*, u.full_name as uploaded_by_name
    FROM case_documents d
    LEFT JOIN users u ON d.uploaded_by_id = u.id
    WHERE d.case_id = ?
    ORDER BY d.uploaded_at DESC
  `).all(caseId) as unknown as CaseDocumentRecord[];
}
