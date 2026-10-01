import { z } from 'zod';

// Utility to sanitize HTML and trim whitespace
export function sanitizeString(val: string): string {
  return val
    .trim()
    .replace(/[<>]/g, ''); // Strip basic HTML tags
}

export const loginSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters').trim(),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

export const caseRegistrationSchema = z.object({
  stateCode: z.string().min(2).max(4).default('DL'),
  courtCode: z.string().min(2).max(4).default('HC'),
  caseType: z.enum(['CIVIL', 'CRIMINAL', 'WRIT_PETITION', 'APPEAL', 'FAMILY', 'COMMERCIAL']),
  filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Filing date must be in YYYY-MM-DD format'),
  courtName: z.string().min(3).max(200).transform(sanitizeString),
  category: z.string().min(2).max(100).transform(sanitizeString),
  title: z.string().min(5).max(300).transform(sanitizeString),
  description: z.string().max(3000).optional().transform(v => (v ? sanitizeString(v) : '')),
  petitionerName: z.string().min(2).max(150).transform(sanitizeString),
  petitionerContact: z.string().max(50).optional().transform(v => (v ? sanitizeString(v) : '')),
  petitionerAddress: z.string().max(300).optional().transform(v => (v ? sanitizeString(v) : '')),
  respondentName: z.string().min(2).max(150).transform(sanitizeString),
  respondentContact: z.string().max(50).optional().transform(v => (v ? sanitizeString(v) : '')),
  respondentAddress: z.string().max(300).optional().transform(v => (v ? sanitizeString(v) : '')),
  petitionerLawyerId: z.coerce.number().nullable().optional(),
  respondentLawyerId: z.coerce.number().nullable().optional(),
  litigantId: z.coerce.number().nullable().optional(),
  assignedJudgeId: z.coerce.number().nullable().optional(),
});

export const hearingScheduleSchema = z.object({
  caseId: z.coerce.number().int().positive('Valid case ID required'),
  hearingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/, 'Hearing date must be format YYYY-MM-DD HH:MM'),
  courtroom: z.string().min(2).max(100).transform(sanitizeString),
  judgeId: z.coerce.number().int().positive().nullable().optional(),
  purpose: z.string().min(3).max(300).transform(sanitizeString),
});

export const adjournmentSchema = z.object({
  hearingId: z.coerce.number().int().positive('Valid hearing ID required'),
  reason: z.string().min(5, 'Adjournment reason must be at least 5 characters').max(500).transform(sanitizeString),
  newHearingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/, 'New hearing date must be format YYYY-MM-DD HH:MM'),
  courtroom: z.string().min(2).max(100).transform(sanitizeString),
});

export const orderRecordSchema = z.object({
  caseId: z.coerce.number().int().positive('Valid case ID required'),
  orderType: z.enum(['INTERIM_ORDER', 'BAIL_ORDER', 'FINAL_JUDGMENT', 'DISMISSAL_ORDER', 'DECREE']),
  title: z.string().min(3).max(250).transform(sanitizeString),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Order date must be YYYY-MM-DD'),
  summary: z.string().min(5).max(2000).transform(sanitizeString),
  fullText: z.string().min(10).max(50000).transform(sanitizeString),
  documentFilename: z.string().max(255).optional(),
  documentUrl: z.string().max(255).optional(),
  isFinal: z.boolean().optional().default(false),
});

export const caseCloseSchema = z.object({
  status: z.enum(['DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED']),
  closureReason: z.string().min(5, 'Closure reason must be at least 5 characters').max(2000).transform(sanitizeString),
});

export const userCreateSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, and hyphens').trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  fullName: z.string().min(2).max(150).transform(sanitizeString),
  role: z.enum(['ADMIN', 'JUDGE', 'CLERK', 'LAWYER', 'LITIGANT']),
  password: z.string().min(6).optional(),
  phone: z.string().max(30).optional().transform(v => (v ? sanitizeString(v) : '')),
  courtName: z.string().max(200).optional().transform(v => (v ? sanitizeString(v) : '')),
  designation: z.string().max(100).optional().transform(v => (v ? sanitizeString(v) : '')),
  courtroom: z.string().max(100).optional().transform(v => (v ? sanitizeString(v) : '')),
  barRegistrationNo: z.string().max(50).optional().transform(v => (v ? sanitizeString(v) : '')),
  idNumber: z.string().max(50).optional().transform(v => (v ? sanitizeString(v) : '')),
  address: z.string().max(300).optional().transform(v => (v ? sanitizeString(v) : '')),
});
