# Judiciary Information System (JIS) — Requirements Traceability Matrix

**Project:** Judiciary Information System (JIS)  
**Standard:** IEEE Std 830-1998 / e-Courts Mission Mode / NJDG Standards  
**Source Documents:** SE Lab Experiments 1 (SRS), 2 (DFD), 3 (Use Cases), 4 (Class Diagram), 5 (Sequence Diagrams), 6 (Communication Diagram), 7 (Activity Diagram)

---

## 1. Document Cross-Reference & Traceability Matrix

| Req ID | Requirement Description | Source Doc | Architectural Module | Database Entity | Verification / Test ID | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-AUTH-01** | User authentication with secure password hashing and role identification | SRS §5, Exp 2 (P6), Exp 3, Exp 5, Exp 6 | Auth & RBAC Service | `users`, `user_accounts` | `TEST-AUTH-001`, `TEST-AUTH-002` | Implemented |
| **REQ-AUTH-02** | Role-Based Access Control (Admin, Judge, Clerk, Lawyer, Litigant) | SRS §3 & §5, Exp 2 (3.1), Exp 3, Exp 4 | Middleware & RBAC Service | `users` (role enum) | `TEST-AUTH-003`, `TEST-RBAC-001` | Implemented |
| **REQ-CASE-01** | Case registration with mandatory field validation (parties, filing date, type, details) | SRS §5, Exp 2 (P1), Exp 3, Exp 4, Exp 7 | Case Management Module | `cases` | `TEST-CASE-001`, `TEST-CASE-002` | Implemented |
| **REQ-CASE-02** | Automatic CIN generation (`STATE-COURT-TYPE-YEAR-SEQUENCE`) | SRS §3 & §5, Exp 2 (P1), Exp 3, Exp 4, Exp 7 | CIN Generator Engine | `cases` (`cin` column) | `TEST-CIN-001`, `TEST-CIN-002` | Implemented |
| **REQ-CASE-03** | Document attachment and verification at filing | SRS §5, Exp 2 (P1), Exp 4, Exp 6, Exp 7 | Document Repository | `case_documents` | `TEST-DOC-001` | Implemented |
| **REQ-HRG-01** | Hearing scheduling with judge and courtroom availability conflict prevention | SRS §5, Exp 2 (P2), Exp 3, Exp 4, Exp 7 | Hearing Scheduler Module | `hearings` | `TEST-HRG-001`, `TEST-HRG-002` | Implemented |
| **REQ-HRG-02** | Adjournment logging with mandatory reason, new hearing date, and automatic counter tally | SRS §3 & §5, Exp 2 (P2), Exp 3, Exp 4, Exp 7 | Adjournment Engine | `adjournments`, `cases` (`adjournment_count`) | `TEST-ADJ-001`, `TEST-ADJ-002` | Implemented |
| **REQ-HRG-03** | Cause list generation (daily/weekly schedule by courtroom and judge) with export/print | SRS §3 & §5, Exp 2 (P2), Exp 3, Exp 4 | Cause List Module | `hearings`, `cases` | `TEST-CAUSE-001` | Implemented |
| **REQ-NOTIF-01** | Notification dispatch (email/SMS simulation) upon registration, hearing, and adjournment | SRS §5, Exp 2 (P2), Exp 3, Exp 6, Exp 7 | Notification Dispatcher | `notifications` | `TEST-NOTIF-001` | Implemented |
| **REQ-ORD-01** | Recording interim orders and final judgments with attached signed documents | SRS §5, Exp 2 (P3), Exp 3, Exp 4, Exp 7 | Orders & Judgment Module | `orders_judgments` | `TEST-ORD-001` | Implemented |
| **REQ-ORD-02** | Case closure on disposal/settlement/withdrawal with stated reason & immutability | SRS §5, Exp 2 (P3), Exp 3, Exp 4, Exp 7 | Case Lifecycle Engine | `cases` (`status`, `closure_reason`) | `TEST-CLOSE-001`, `TEST-CLOSE-002` | Implemented |
| **REQ-AUD-01** | Immutable audit log trail for all case mutations, administrative actions, and logins | SRS §5, Exp 2 (D3/P6), Exp 4 | Audit Service | `audit_logs` | `TEST-AUDIT-001` | Implemented |
| **REQ-SRCH-01** | Role-filtered search by CIN, party name, advocate, date, case type, and status | SRS §5, Exp 2 (P4), Exp 3, Exp 5 | Case Search Engine | `cases` (FTS / indexed queries) | `TEST-SEARCH-001`, `TEST-SEARCH-002` | Implemented |
| **REQ-REP-01** | Administrative reporting: Case disposal rate, pendency analysis, adjournment rate, judge workload | SRS §5, Exp 2 (P5), Exp 3, Exp 4 | Reporting & Analytics Engine | Aggregate queries | `TEST-REP-001` | Implemented |
| **REQ-ADM-01** | User management: create/edit users, assign roles, view system audit trail | SRS §5, Exp 2 (P6), Exp 3, Exp 4 | Admin Control Panel | `users` | `TEST-ADMIN-001` | Implemented |

---

## 2. Role-Permission Matrix

| Functional Capability | Administrator | Judge | Clerk / Registrar | Lawyer / Advocate | Litigant / Citizen |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Login & Profile View** | YES | YES | YES | YES | YES |
| **Register New Case & Generate CIN** | YES | NO | YES | Application Draft | Application Draft |
| **View All Court Cases** | YES | YES (Assigned / All) | YES | NO (Assigned only) | NO (Own cases only) |
| **Upload Case Pleadings / Documents** | YES | YES | YES | YES (Assigned) | YES (Own cases) |
| **Schedule Hearing & Check Availability**| YES | YES | YES | NO | NO |
| **Record Adjournment & New Date** | YES | YES | YES | NO | NO |
| **Record Hearing Proceedings** | NO | YES | YES | NO | NO |
| **Record Orders & Final Judgments** | NO | YES | NO | NO | NO |
| **Close Case (Disposed/Settled/Withdrawn)**| NO | YES | NO | NO | NO |
| **Re-open Closed Case (Emergency Audit)** | YES (Audited) | NO | NO | NO | NO |
| **View Cause List** | YES | YES | YES | YES | YES (Public) |
| **Receive Hearing / Order Notifications**| YES | YES | YES | YES | YES |
| **Download Signed Orders & Judgments** | YES | YES | YES | YES (Assigned) | YES (Permitted) |
| **Generate Statistical Reports (Disposal/Pendency)** | YES | Review | Review | NO | NO |
| **Manage Users & Role Assignment** | YES | NO | NO | NO | NO |
| **Inspect System-wide Audit Trail** | YES | NO | NO | NO | NO |

---

## 3. Assumptions and Resolutions

1. **CIN Format:** SRS specifies `STATE-COURT-TYPE-YEAR-SEQUENCE` (e.g. `DL-HC-CIV-2026-0001` or `JK-HC-CIV-2026-0001`). Default configuration uses Indian Judiciary nomenclature:
   - State: `DL` (Delhi), `JK` (Jammu & Kashmir), `MH` (Maharashtra), `KA` (Karnataka), `UP` (Uttar Pradesh)
   - Court: `HC` (High Court), `DC` (District Court), `SC` (Sessions Court)
   - Type: `CIV` (Civil), `CRM` (Criminal), `WPT` (Writ Petition), `APP` (Appeal), `FAM` (Family)
2. **Notification Delivery:** In compliance with SRS §5, notifications dispatch to internal database logs with simulated SMS/Email integration hooks, ensuring offline resilience and testability without requiring commercial SMS gateway API credentials.
3. **Database Architecture:** Relational SQLite via `node:sqlite` in WAL mode with enforced foreign keys, ensuring zero-dependency, crash-safe, local execution with strict relational constraints and transaction rollback guarantees.
