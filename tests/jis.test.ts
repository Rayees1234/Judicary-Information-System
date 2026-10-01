import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/lib/db/index';
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken, type User } from '../src/lib/auth';
import { registerCase, generateCIN, updateCase, closeCase, searchCases, getCaseByCin } from '../src/lib/services/caseService';
import { scheduleHearing, recordAdjournment, checkHearingConflict } from '../src/lib/services/hearingService';
import { recordOrder } from '../src/lib/services/orderService';
import { getDisposalRateReport, getPendencyReport, getAdjournmentReport, getJudgeWorkloadReport } from '../src/lib/services/reportService';
import { getAllAuditLogs, getCaseAuditTrail } from '../src/lib/services/auditService';

// Ensure DB is initialized
const db = getDb();

// Mock User Objects for Tests
const adminUser: User = { id: 1, username: 'admin', email: 'admin@jis.gov.in', full_name: 'System Admin', role: 'ADMIN' };
const judgeUser: User = { id: 2, username: 'judge.verma', email: 'justice.verma@jis.gov.in', full_name: 'Justice Verma', role: 'JUDGE', courtroom: 'Courtroom 1' };
const clerkUser: User = { id: 4, username: 'clerk.kumar', email: 'clerk.kumar@jis.gov.in', full_name: 'Rajesh Kumar', role: 'CLERK' };
const lawyerUser: User = { id: 5, username: 'advocate.singh', email: 'vikram.singh@bar.in', full_name: 'Advocate Vikram Singh', role: 'LAWYER' };
const litigantUser: User = { id: 7, username: 'litigant.sharma', email: 'ramesh.sharma@gmail.com', full_name: 'Ramesh Sharma', role: 'LITIGANT', phone: '+91-9833344455' };

describe('Judiciary Information System (JIS) — Verification Suite', () => {

  // 1. Authentication & Security
  describe('REQ-AUTH-01 & REQ-AUTH-02: Authentication & RBAC', () => {
    it('TEST-AUTH-001: should securely hash and verify passwords using PBKDF2', () => {
      const raw = 'SecretCourtPassword2026';
      const hash = hashPassword(raw);
      assert.notEqual(raw, hash);
      assert.ok(hash.includes(':'), 'Hash must contain salt separator');
      assert.equal(verifyPassword(raw, hash), true, 'Password must verify');
      assert.equal(verifyPassword('WrongPassword', hash), false, 'Wrong password must be rejected');
    });

    it('TEST-AUTH-002: should generate and cryptographically verify session tokens', () => {
      const token = createSessionToken(judgeUser.id, judgeUser.role);
      const decoded = verifySessionToken(token);
      assert.ok(decoded);
      assert.equal(decoded.userId, judgeUser.id);
      assert.equal(decoded.role, 'JUDGE');

      // Tampered token test
      const tampered = token.slice(0, -5) + 'xxxxx';
      assert.equal(verifySessionToken(tampered), null, 'Tampered token must fail verification');
    });

    it('TEST-AUTH-003: should enforce role permissions on sensitive operations', () => {
      // Litigant attempting to register case must fail
      assert.throws(() => {
        registerCase({
          caseType: 'CIVIL',
          filingDate: '2026-03-10',
          courtName: 'High Court',
          category: 'Contract',
          title: 'Unauthorized Case Filing',
          petitionerName: 'John',
          respondentName: 'Doe',
        }, litigantUser);
      }, /Only Court Clerks\/Registrars and Administrators can register cases/);

      // Clerk attempting to pass judicial order must fail
      assert.throws(() => {
        recordOrder({
          caseId: 1,
          orderType: 'FINAL_JUDGMENT',
          title: 'Clerk Judgment',
          orderDate: '2026-03-10',
          summary: 'Summary',
          fullText: 'Full text',
        }, clerkUser);
      }, /Only Judges can record orders and judgments/);
    });
  });

  // 2. Case Registration & CIN Generation
  describe('REQ-CASE-01 & REQ-CASE-02: Case Registration & CIN Format', () => {
    it('TEST-CIN-001: should generate CIN matching STATE-COURT-TYPE-YEAR-SEQUENCE format', () => {
      const cin = generateCIN('DL', 'HC', 'CIVIL', 2026);
      assert.match(cin, /^DL-HC-CIV-2026-\d{4}$/, 'CIN format must match standard');
    });

    it('TEST-CASE-001: should validate mandatory fields upon case registration', () => {
      assert.throws(() => {
        registerCase({
          caseType: 'CIVIL',
          filingDate: '',
          courtName: 'High Court',
          category: '',
          title: '',
          petitionerName: '',
          respondentName: '',
        }, clerkUser);
      }, /Mandatory fields missing/);
    });

    it('TEST-CASE-002: should successfully register case, assign CIN, and record audit event', () => {
      const newCase = registerCase({
        caseType: 'CIVIL',
        filingDate: '2026-04-01',
        courtName: 'High Court of Judicature',
        category: 'Commercial Arbitration',
        title: 'Alpha Logistics vs Beta Freight Corp',
        petitionerName: 'Alpha Logistics',
        respondentName: 'Beta Freight Corp',
        petitionerLawyerId: lawyerUser.id,
      }, clerkUser);

      assert.ok(newCase.id);
      assert.ok(newCase.cin);
      assert.equal(newCase.status, 'REGISTERED');
      assert.equal(newCase.adjournment_count, 0);

      // Verify audit log entry
      const trail = getCaseAuditTrail(newCase.id);
      assert.ok(trail.length > 0);
      assert.equal(trail[0].action, 'CASE_REGISTERED');
    });
  });

  // 3. Hearing Scheduling & Conflict Prevention
  describe('REQ-HRG-01: Hearing Scheduling & Double-Booking Prevention', () => {
    it('TEST-HRG-001: should successfully schedule hearing when courtroom and judge are free', () => {
      const uniqueTime = `2027-01-10 09:${Math.floor(10 + Math.random() * 40)}`;
      const scheduled = scheduleHearing({
        caseId: 1,
        hearingDate: uniqueTime,
        courtroom: 'Courtroom 3',
        judgeId: judgeUser.id,
        purpose: 'Framing of Preliminary Issues',
      }, clerkUser);

      assert.ok(scheduled.id);
      assert.equal(scheduled.status, 'SCHEDULED');
      assert.equal(scheduled.courtroom, 'Courtroom 3');

      // TEST-HRG-002: Immediately test that scheduling in the same courtroom/time throws conflict
      assert.throws(() => {
        scheduleHearing({
          caseId: 2,
          hearingDate: uniqueTime,
          courtroom: 'Courtroom 3', // Conflicting courtroom
          judgeId: 3, // Different judge, same courtroom
          purpose: 'Bail Hearing',
        }, clerkUser);
      }, /Scheduling Conflict/);
    });
  });

  // 4. Adjournments & Running Tally
  describe('REQ-HRG-02: Adjournment Logging & Automatic Counter', () => {
    it('TEST-ADJ-001: should log mandatory reason, update running tally, and reschedule hearing', () => {
      // Create a fresh test hearing for Case 1 to adjourn
      const testHearingDate = `2027-02-15 10:${Math.floor(10 + Math.random() * 40)}`;
      const freshHearing = scheduleHearing({
        caseId: 1,
        hearingDate: testHearingDate,
        courtroom: 'Courtroom 1',
        judgeId: judgeUser.id,
        purpose: 'Test Hearing to be Adjourned',
      }, clerkUser);

      const caseBefore = getCaseByCin('DL-HC-CIV-2026-0001')!;
      const tallyBefore = caseBefore.adjournment_count;

      const newHearingDate = `2027-03-25 11:${Math.floor(10 + Math.random() * 40)}`;
      const result = recordAdjournment(
        freshHearing.id,
        'Counsel for petitioner indisposed due to illness',
        newHearingDate,
        'Courtroom 1',
        judgeUser
      );

      assert.ok(result.adjournment);
      assert.equal(result.adjournment.reason, 'Counsel for petitioner indisposed due to illness');
      assert.equal(result.adjournment.adjournment_number, tallyBefore + 1);

      // Verify case counter incremented
      const caseAfter = getCaseByCin('DL-HC-CIV-2026-0001')!;
      assert.equal(caseAfter.adjournment_count, tallyBefore + 1);
      assert.equal(caseAfter.status, 'ADJOURNED');
    });
  });

  // 5. Orders, Judgments & Case Closure Immutability
  describe('REQ-ORD-01 & REQ-ORD-02: Orders, Judgments & Immutability Rules', () => {
    it('TEST-ORD-001: should record interim orders against case dossier', () => {
      const order = recordOrder({
        caseId: 1,
        orderType: 'INTERIM_ORDER',
        title: 'Order on Document Production',
        orderDate: '2026-03-15',
        summary: 'Directing production of revenue records within 14 days.',
        fullText: 'Perused the application. Notice be issued to respondent to produce land records.',
        isFinal: false,
      }, judgeUser);

      assert.ok(order.id);
      assert.equal(order.order_type, 'INTERIM_ORDER');
      assert.equal(order.is_final, 0);
    });

    it('TEST-CLOSE-001: final judgment should automatically trigger case disposal workflow', () => {
      // Register a dedicated case for testing final judgment
      const freshCase = registerCase({
        caseType: 'COMMERCIAL',
        filingDate: '2026-04-10',
        courtName: 'High Court of Judicature',
        category: 'Contract Enforcement',
        title: 'Sigma Tech vs Delta Corp',
        petitionerName: 'Sigma Tech',
        respondentName: 'Delta Corp',
      }, clerkUser);

      const order = recordOrder({
        caseId: freshCase.id,
        orderType: 'FINAL_JUDGMENT',
        title: 'Final Decree and Contract Enforcement',
        orderDate: '2026-04-15',
        summary: 'Award of damages and decree of specific performance.',
        fullText: 'The claim is allowed in terms of operative directions.',
        isFinal: true,
      }, judgeUser);

      assert.equal(order.is_final, 1);

      const closedCase = db.prepare('SELECT status, closure_reason, closed_at FROM cases WHERE id = ?').get(freshCase.id) as any;
      assert.equal(closedCase.status, 'DISPOSED');
      assert.ok(closedCase.closure_reason);
      assert.ok(closedCase.closed_at);
    });

    it('TEST-CLOSE-002: closed case must reject modifications by non-administrators (Immutability Rule)', () => {
      // Judge or Clerk attempting to edit closed Case 5 must fail
      assert.throws(() => {
        updateCase(5, { title: 'Unauthorized Modification of Closed Case' }, clerkUser);
      }, /Case is closed\. Only an Administrator can modify closed case records/);

      // Admin can modify, and an audited event is logged
      const updated = updateCase(5, { description: 'Administrative note verified.' }, adminUser);
      assert.ok(updated);

      const trail = getCaseAuditTrail(5);
      assert.equal(trail[0].action, 'ADMIN_CLOSED_CASE_MODIFIED');
    });
  });

  // 6. Role-Scoped Search & RBAC Visibility
  describe('REQ-SRCH-01: Role-Scoped Case Search', () => {
    it('TEST-SEARCH-001: Lawyer must only see cases where they represent petitioner or respondent', () => {
      const lawyerResults = searchCases({}, lawyerUser);
      assert.ok(lawyerResults.cases.length > 0);
      for (const c of lawyerResults.cases) {
        const isRepresenting = c.petitioner_lawyer_id === lawyerUser.id || c.respondent_lawyer_id === lawyerUser.id;
        assert.ok(isRepresenting, `Lawyer should only see assigned cases. Saw case: ${c.cin}`);
      }
    });

    it('TEST-SEARCH-002: Litigant must only see their personal case matters', () => {
      const litigantResults = searchCases({}, litigantUser);
      assert.ok(litigantResults.cases.length > 0);
      for (const c of litigantResults.cases) {
        const isParty = c.litigant_id === litigantUser.id || c.petitioner_contact === litigantUser.phone;
        assert.ok(isParty, `Litigant should only see own cases. Saw case: ${c.cin}`);
      }
    });
  });

  // 7. Reports & Analytics Calculations
  describe('REQ-REP-01: Court Reports & Analytics', () => {
    it('TEST-REP-001: should accurately compute disposal rates, pendency, and judge workloads', () => {
      const disposal = getDisposalRateReport();
      assert.ok(disposal.totalRegistered > 0);
      assert.ok(disposal.totalDisposed > 0);
      assert.ok(disposal.clearanceRatePct >= 0 && disposal.clearanceRatePct <= 100);

      const pendency = getPendencyReport();
      assert.equal(pendency.totalPending, pendency.under3Months + pendency.between3And6Months + pendency.between6And12Months + pendency.over1Year);

      const adjournments = getAdjournmentReport();
      assert.ok(adjournments.totalAdjournments >= 0);
      assert.ok(Array.isArray(adjournments.topReasons));

      const workloads = getJudgeWorkloadReport();
      assert.ok(workloads.length > 0);
      assert.ok(workloads[0].judgeName);
    });
  });
});
