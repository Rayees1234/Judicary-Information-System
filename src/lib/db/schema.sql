-- Judiciary Information System (JIS) — Database Schema
-- Standard: e-Courts Mission Mode / NJDG Case Data Standard
-- Relational SQLite Engine with strict constraints & Foreign Key cascades

PRAGMA foreign_keys = ON;

-- 1. Users Table (RBAC: ADMIN, JUDGE, CLERK, LAWYER, LITIGANT)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'JUDGE', 'CLERK', 'LAWYER', 'LITIGANT')),
  phone TEXT,
  court_name TEXT DEFAULT 'High Court of Judicature',
  designation TEXT,
  courtroom TEXT,
  bar_registration_no TEXT,
  id_number TEXT,
  address TEXT,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cases Table (Central Entity)
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cin TEXT UNIQUE NOT NULL, -- Format: STATE-COURT-TYPE-YEAR-SEQUENCE
  case_type TEXT NOT NULL CHECK(case_type IN ('CIVIL', 'CRIMINAL', 'WRIT_PETITION', 'APPEAL', 'FAMILY', 'COMMERCIAL')),
  filing_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'FILED' CHECK(status IN ('FILED', 'REGISTERED', 'HEARING_SCHEDULED', 'ADJOURNED', 'RESERVED_FOR_JUDGMENT', 'DISPOSED', 'SETTLED', 'WITHDRAWN', 'CLOSED')),
  court_name TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  petitioner_name TEXT NOT NULL,
  petitioner_contact TEXT,
  petitioner_address TEXT,
  respondent_name TEXT NOT NULL,
  respondent_contact TEXT,
  respondent_address TEXT,
  petitioner_lawyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  respondent_lawyer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  litigant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_judge_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  registered_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  adjournment_count INTEGER DEFAULT 0,
  closure_reason TEXT,
  closed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Hearings Table (Hearing Calendar & Scheduling)
CREATE TABLE IF NOT EXISTS hearings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  hearing_date TEXT NOT NULL, -- YYYY-MM-DD HH:MM
  courtroom TEXT NOT NULL,
  judge_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ADJOURNED', 'CANCELLED')),
  proceedings_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Adjournments Table (Reason, New Date, Running Tally)
CREATE TABLE IF NOT EXISTS adjournments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hearing_id INTEGER NOT NULL REFERENCES hearings(id) ON DELETE CASCADE,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  new_hearing_date TEXT NOT NULL,
  adjournment_number INTEGER NOT NULL,
  granted_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Orders & Judgments Table (Orders Archive)
CREATE TABLE IF NOT EXISTS orders_judgments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK(order_type IN ('INTERIM_ORDER', 'BAIL_ORDER', 'FINAL_JUDGMENT', 'DISMISSAL_ORDER', 'DECREE')),
  title TEXT NOT NULL,
  order_date DATE NOT NULL,
  passed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  full_text TEXT NOT NULL,
  document_filename TEXT,
  document_url TEXT,
  is_final INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Case Documents (Pleadings, Evidence, Affidavits)
CREATE TABLE IF NOT EXISTS case_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK(document_type IN ('PETITION', 'EVIDENCE', 'AFFIDAVIT', 'WRITTEN_STATEMENT', 'ANNEXURE', 'REJOINDER', 'ORDER_COPY')),
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Notifications (SMS / Email / System Alerts)
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'SYSTEM' CHECK(channel IN ('SMS', 'EMAIL', 'SYSTEM')),
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Audit Log Table (Immutable audit trail for all events)
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  ip_address TEXT DEFAULT '127.0.0.1',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance & Integrity Indexes
CREATE INDEX IF NOT EXISTS idx_cases_cin ON cases(cin);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_type ON cases(case_type);
CREATE INDEX IF NOT EXISTS idx_cases_judge ON cases(assigned_judge_id);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_pet ON cases(petitioner_lawyer_id);
CREATE INDEX IF NOT EXISTS idx_cases_lawyer_resp ON cases(respondent_lawyer_id);
CREATE INDEX IF NOT EXISTS idx_cases_litigant ON cases(litigant_id);
CREATE INDEX IF NOT EXISTS idx_hearings_date_court ON hearings(hearing_date, courtroom);
CREATE INDEX IF NOT EXISTS idx_hearings_judge_date ON hearings(judge_id, hearing_date);
CREATE INDEX IF NOT EXISTS idx_adjournments_case ON adjournments(case_id);
CREATE INDEX IF NOT EXISTS idx_orders_case ON orders_judgments(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_case ON audit_logs(case_id);
