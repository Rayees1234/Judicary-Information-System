import { getDb } from './index';
import { hashPassword } from '../auth';

export function seedDatabase() {
  const db = getDb();

  // Check if users already seeded
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('Seeding Judiciary Information System (JIS) with initial development data...');

  // 1. Seed Users (Admin, Judges, Clerks, Lawyers, Litigants)
  const defaultPassword = 'password123';
  const adminPassword = hashPassword('admin123');
  const judgePassword = hashPassword('judge123');
  const clerkPassword = hashPassword('clerk123');
  const lawyerPassword = hashPassword('lawyer123');
  const litigantPassword = hashPassword('litigant123');

  const insertUser = db.prepare(`
    INSERT INTO users (
      username, email, full_name, role, phone, court_name,
      designation, courtroom, bar_registration_no, id_number, address, password_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'admin', 'admin@jis.gov.in', 'System Administrator', 'ADMIN',
    '+91-9876543210', 'High Court of Judicature', 'Chief IT Administrator',
    'Admin Block Room 10', '', 'GOV-ADM-001', 'High Court Complex, New Delhi', adminPassword
  );

  insertUser.run(
    'judge.verma', 'justice.verma@jis.gov.in', 'Hon\'ble Justice R. K. Verma', 'JUDGE',
    '+91-9876543211', 'High Court of Judicature', 'Senior Puisne Judge',
    'Courtroom 1', '', 'JUD-HC-042', 'High Court Complex, New Delhi', judgePassword
  );

  insertUser.run(
    'judge.sharma', 'justice.sharma@jis.gov.in', 'Hon\'ble Justice Ananya Sharma', 'JUDGE',
    '+91-9876543212', 'High Court of Judicature', 'High Court Judge',
    'Courtroom 2', '', 'JUD-HC-058', 'High Court Complex, New Delhi', judgePassword
  );

  insertUser.run(
    'clerk.kumar', 'clerk.kumar@jis.gov.in', 'Rajesh Kumar', 'CLERK',
    '+91-9876543213', 'High Court of Judicature', 'Senior Bench Registrar & Filing Clerk',
    'Filing Counter 4', '', 'EMP-CLK-108', 'Registry Office, High Court Complex', clerkPassword
  );

  insertUser.run(
    'advocate.singh', 'vikram.singh@barcouncil.in', 'Advocate Vikram Singh', 'LAWYER',
    '+91-9811122233', 'High Court of Judicature', 'Senior Advocate',
    '', 'D/1420/2012', 'BCI-DL-9821', 'Chamber 402, High Court Lawyers Chambers', lawyerPassword
  );

  insertUser.run(
    'advocate.mehta', 'priya.mehta@barcouncil.in', 'Advocate Priya Mehta', 'LAWYER',
    '+91-9822233344', 'High Court of Judicature', 'Advocate on Record',
    '', 'D/1890/2015', 'BCI-DL-1104', 'Chamber 115, High Court Lawyers Chambers', lawyerPassword
  );

  insertUser.run(
    'litigant.sharma', 'ramesh.sharma@gmail.com', 'Ramesh Sharma', 'LITIGANT',
    '+91-9833344455', 'High Court of Judicature', 'Citizen / Petitioner',
    '', '', 'AADHAR-7890-1234-5678', '45, Civil Lines, North Delhi', litigantPassword
  );

  insertUser.run(
    'litigant.patel', 'sunita.patel@gmail.com', 'Sunita Patel', 'LITIGANT',
    '+91-9844455566', 'High Court of Judicature', 'Citizen / Petitioner',
    '', '', 'AADHAR-4567-8901-2345', 'B-12, Green Park Extension, New Delhi', litigantPassword
  );

  // Retrieve user IDs
  const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get() as any;
  const judge1 = db.prepare("SELECT id FROM users WHERE username = 'judge.verma'").get() as any;
  const judge2 = db.prepare("SELECT id FROM users WHERE username = 'judge.sharma'").get() as any;
  const clerk = db.prepare("SELECT id FROM users WHERE username = 'clerk.kumar'").get() as any;
  const lawyer1 = db.prepare("SELECT id FROM users WHERE username = 'advocate.singh'").get() as any;
  const lawyer2 = db.prepare("SELECT id FROM users WHERE username = 'advocate.mehta'").get() as any;
  const litigant1 = db.prepare("SELECT id FROM users WHERE username = 'litigant.sharma'").get() as any;
  const litigant2 = db.prepare("SELECT id FROM users WHERE username = 'litigant.patel'").get() as any;

  // 2. Seed Cases
  const insertCase = db.prepare(`
    INSERT INTO cases (
      cin, case_type, filing_date, status, court_name, category,
      title, description, petitioner_name, petitioner_contact, petitioner_address,
      respondent_name, respondent_contact, respondent_address,
      petitioner_lawyer_id, respondent_lawyer_id, litigant_id,
      assigned_judge_id, registered_by_id, adjournment_count,
      closure_reason, closed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Case 1: Land acquisition appeal (Hearing Scheduled)
  insertCase.run(
    'DL-HC-CIV-2026-0001', 'CIVIL', '2026-01-15', 'HEARING_SCHEDULED', 'High Court of Judicature', 'Land Acquisition Appeal',
    'Ramesh Sharma vs State of NCT of Delhi & Anr',
    'Appeal against inadequate compensation awarded by Land Acquisition Collector for Sector 22 expansion project under Right to Fair Compensation Act.',
    'Ramesh Sharma', '+91-9833344455', '45, Civil Lines, North Delhi',
    'State of NCT of Delhi through Secretary (Revenue)', '+91-11-23381234', 'Delhi Secretariat, I.P. Estate, New Delhi',
    lawyer1.id, lawyer2.id, litigant1.id, judge1.id, clerk.id, 0, null, null
  );

  // Case 2: Commercial bail petition (Adjourned twice)
  insertCase.run(
    'DL-HC-CRM-2026-0002', 'CRIMINAL', '2026-02-10', 'ADJOURNED', 'High Court of Judicature', 'Bail Application',
    'State (NCT of Delhi) vs Rakesh Gupta',
    'Application for Regular Bail under Section 439 CrPC in FIR No. 112/2025 PS Economic Offences Wing for alleged misappropriation of export subsidies.',
    'State of NCT of Delhi', '+91-11-23385555', 'Police Headquarters, New Delhi',
    'Rakesh Gupta', '+91-9899988877', 'C-4, Greater Kailash-I, New Delhi',
    lawyer2.id, lawyer1.id, null, judge2.id, clerk.id, 2, null, null
  );

  // Case 3: Public Interest Litigation (Older case, Adjourned 3 times - flagged)
  insertCase.run(
    'DL-HC-WPT-2025-0014', 'WRIT_PETITION', '2025-05-20', 'ADJOURNED', 'High Court of Judicature', 'Public Interest Litigation (PIL)',
    'Citizens Environmental Forum vs Delhi Pollution Control Committee & Ors',
    'Writ Petition under Article 226 seeking directions for strict effluent standards and continuous real-time monitoring of industrial drains entering Yamuna river.',
    'Citizens Environmental Forum', '+91-9810101010', '7, Lodhi Road, New Delhi',
    'Delhi Pollution Control Committee & Municipal Corporation', '+91-11-23812345', 'ISBT Building, Kashmere Gate, New Delhi',
    lawyer1.id, lawyer2.id, null, judge1.id, clerk.id, 3, null, null
  );

  // Case 4: Commercial Contract Arbitration (Reserved for Judgment)
  insertCase.run(
    'DL-HC-COM-2025-0045', 'COMMERCIAL', '2025-08-14', 'RESERVED_FOR_JUDGMENT', 'High Court of Judicature', 'Commercial Arbitration',
    'Apex Infotech Solutions Ltd vs Bharat Telecom Networks',
    'Petition under Section 34 of the Arbitration and Conciliation Act challenging arbitral award dated 12.04.2025 regarding cloud infrastructure procurement agreement.',
    'Apex Infotech Solutions Ltd', '+91-11-45678900', 'Plot 12, Okhla Phase III, New Delhi',
    'Bharat Telecom Networks Corp', '+91-11-41234567', 'Barakhamba Road, Connaught Place, New Delhi',
    lawyer2.id, lawyer1.id, null, judge2.id, clerk.id, 1, null, null
  );

  // Case 5: Disposed case with Final Judgment
  insertCase.run(
    'DL-HC-CIV-2024-0089', 'CIVIL', '2024-03-12', 'DISPOSED', 'High Court of Judicature', 'Specific Performance of Contract',
    'Sunita Patel vs Heritage Developers & Builders Pvt Ltd',
    'Suit for specific performance of builder-buyer agreement dated 15.01.2021 and possession of residential apartment with damages for delayed handover.',
    'Sunita Patel', '+91-9844455566', 'B-12, Green Park Extension, New Delhi',
    'Heritage Developers & Builders Pvt Ltd', '+91-11-26789012', 'Nehru Place Commercial Center, New Delhi',
    lawyer1.id, lawyer2.id, litigant2.id, judge1.id, clerk.id, 1,
    'Decree of specific performance granted with direction to deliver physical possession and statutory compensation of Rs. 4,50,000.',
    '2025-11-18 16:30:00'
  );

  // Case 6: Family Matter (Fresh Filing)
  insertCase.run(
    'DL-HC-FAM-2026-0003', 'FAMILY', '2026-03-01', 'REGISTERED', 'High Court of Judicature', 'Guardianship & Custody',
    'Neha Kapoor vs Siddharth Kapoor',
    'Appeal under Section 19 of Family Courts Act against interim custody order passed by Principal Judge, Family Court, Saket.',
    'Neha Kapoor', '+91-9877766655', '302, Vasant Vihar, New Delhi',
    'Siddharth Kapoor', '+91-9866655544', '15, Defence Colony, New Delhi',
    lawyer2.id, lawyer1.id, null, judge2.id, clerk.id, 0, null, null
  );

  const c1 = db.prepare("SELECT id FROM cases WHERE cin = 'DL-HC-CIV-2026-0001'").get() as any;
  const c2 = db.prepare("SELECT id FROM cases WHERE cin = 'DL-HC-CRM-2026-0002'").get() as any;
  const c3 = db.prepare("SELECT id FROM cases WHERE cin = 'DL-HC-WPT-2025-0014'").get() as any;
  const c4 = db.prepare("SELECT id FROM cases WHERE cin = 'DL-HC-COM-2025-0045'").get() as any;
  const c5 = db.prepare("SELECT id FROM cases WHERE cin = 'DL-HC-CIV-2024-0089'").get() as any;
  const c6 = db.prepare("SELECT id FROM cases WHERE cin = 'DL-HC-FAM-2026-0003'").get() as any;

  // 3. Seed Hearings
  const insertHearing = db.prepare(`
    INSERT INTO hearings (case_id, hearing_date, courtroom, judge_id, purpose, status, proceedings_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Hearing for Case 1 (Today's date format for cause list)
  const todayStr = new Date().toISOString().split('T')[0];
  insertHearing.run(c1.id, `${todayStr} 10:30`, 'Courtroom 1', judge1.id, 'Hearing on interim prayer and stay on acquisition', 'SCHEDULED', null);
  insertHearing.run(c4.id, `${todayStr} 14:00`, 'Courtroom 2', judge2.id, 'Pronouncement of reserved judgment', 'SCHEDULED', null);

  // Upcoming hearings
  insertHearing.run(c2.id, '2026-10-15 11:30', 'Courtroom 2', judge2.id, 'Adjourned hearing: Verification of bail sureties', 'SCHEDULED', null);
  insertHearing.run(c3.id, '2026-10-20 12:00', 'Courtroom 1', judge1.id, 'Adjourned hearing: Consideration of status report by DPCC', 'SCHEDULED', null);
  insertHearing.run(c6.id, '2026-10-25 10:30', 'Courtroom 2', judge2.id, 'Preliminary admission hearing and notice issuance', 'SCHEDULED', null);

  // Past completed hearing for Case 5
  insertHearing.run(c5.id, '2025-11-18 14:30', 'Courtroom 1', judge1.id, 'Final arguments and judgment pronouncement', 'COMPLETED', 'Arguments concluded on both sides. Final judgment delivered in open court.');

  const h2Past = insertHearing.run(c2.id, '2026-03-05 11:00', 'Courtroom 2', judge2.id, 'Bail Application consideration', 'ADJOURNED', 'Adjourned on request of prosecution counsel.').lastInsertRowid;
  const h3Past = insertHearing.run(c3.id, '2026-01-20 12:00', 'Courtroom 1', judge1.id, 'Monitoring compliance of sewage treatment plants', 'ADJOURNED', 'Status report incomplete. Cost of Rs 10,000 imposed.').lastInsertRowid;

  // 4. Seed Adjournments
  const insertAdj = db.prepare(`
    INSERT INTO adjournments (hearing_id, case_id, reason, new_hearing_date, adjournment_number, granted_by_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAdj.run(Number(h2Past), c2.id, 'Absence of Investigating Officer with case diary', '2026-10-15 11:30', 1, judge2.id);
  insertAdj.run(Number(h2Past), c2.id, 'Prosecution sought additional time to file status report', '2026-10-15 11:30', 2, judge2.id);
  insertAdj.run(Number(h3Past), c3.id, 'Municipal authorities requested 4 weeks to submit drain audit', '2025-09-12 12:00', 1, judge1.id);
  insertAdj.run(Number(h3Past), c3.id, 'Senior counsel for petitioner indisposed due to medical grounds', '2025-12-05 12:00', 2, judge1.id);
  insertAdj.run(Number(h3Past), c3.id, 'Joint request by parties to review Central Pollution Board report', '2026-10-20 12:00', 3, judge1.id);

  // 5. Seed Orders & Final Judgments
  const insertOrder = db.prepare(`
    INSERT INTO orders_judgments (
      case_id, order_type, title, order_date, passed_by_id, summary, full_text,
      document_filename, document_url, is_final
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Final Judgment for Case 5
  insertOrder.run(
    c5.id, 'FINAL_JUDGMENT', 'Final Judgment & Decree in Sunita Patel vs Heritage Developers', '2025-11-18', judge1.id,
    'The Court held that builder failed to deliver possession within stipulated period without justified cause. Decree of specific performance granted along with interest and costs.',
    'IN THE HIGH COURT OF JUDICATURE AT NEW DELHI\n\nSUIT NO. DL-HC-CIV-2024-0089\n\nSUNITA PATEL ... PETITIONER\nVERSUS\nHERITAGE DEVELOPERS & BUILDERS PVT LTD ... RESPONDENT\n\nCORAM: HON\'BLE MR. JUSTICE R.K. VERMA\n\nJUDGMENT:\n1. The present suit has been instituted by the petitioner seeking specific performance of agreement to sell dated 15.01.2021 in respect of Flat No. 704, Tower B, Heritage Heights.\n2. Having considered the evidence on record and admissions made in the written statement, the breach on the part of the respondent builder is established beyond ambiguity.\n3. The suit is accordingly decreed with costs. The respondent is directed to execute the conveyance deed within 60 days.',
    'DL-HC-CIV-2024-0089_FINAL_JUDGMENT.pdf', '/documents/DL-HC-CIV-2024-0089_FINAL_JUDGMENT.pdf', 1
  );

  // Interim Order for Case 1
  insertOrder.run(
    c1.id, 'INTERIM_ORDER', 'Interim Order on Notice & Record Production', '2026-01-22', judge1.id,
    'Notice issued to Land Acquisition Collector to produce original award records within three weeks.',
    'Issue notice to respondents. Original record of award no. 14/2024 be placed on record before the next date of hearing. Status quo regarding possession be maintained in the interregnum.',
    'DL-HC-CIV-2026-0001_INTERIM_ORDER.pdf', '/documents/DL-HC-CIV-2026-0001_INTERIM_ORDER.pdf', 0
  );

  // 6. Seed Case Documents
  const insertDoc = db.prepare(`
    INSERT INTO case_documents (case_id, title, document_type, file_path, file_size, uploaded_by_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertDoc.run(c1.id, 'Original Memo of Appeal', 'PETITION', '/documents/c1_petition.pdf', 245000, lawyer1.id);
  insertDoc.run(c1.id, 'Certified Copy of Land Award 14/2024', 'ANNEXURE', '/documents/c1_annexure_award.pdf', 520000, lawyer1.id);
  insertDoc.run(c2.id, 'Bail Application u/s 439 CrPC', 'PETITION', '/documents/c2_bail_app.pdf', 180000, lawyer1.id);
  insertDoc.run(c3.id, 'PIL Petition on Yamuna River Pollution', 'PETITION', '/documents/c3_pil_petition.pdf', 680000, lawyer1.id);
  insertDoc.run(c5.id, 'Original Builder Buyer Agreement', 'EVIDENCE', '/documents/c5_agreement.pdf', 1200000, litigant2.id);
  insertDoc.run(c5.id, 'Signed Decree & Final Judgment Copy', 'ORDER_COPY', '/documents/DL-HC-CIV-2024-0089_FINAL_JUDGMENT.pdf', 410000, judge1.id);

  // 7. Seed Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (case_id, user_id, action, details, ip_address)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertAudit.run(c1.id, clerk.id, 'CASE_REGISTERED', 'Case DL-HC-CIV-2026-0001 registered by Registrar Rajesh Kumar', '10.0.0.4');
  insertAudit.run(c1.id, judge1.id, 'HEARING_SCHEDULED', 'Initial hearing fixed for Courtroom 1', '10.0.0.12');
  insertAudit.run(c2.id, clerk.id, 'CASE_REGISTERED', 'Criminal bail petition DL-HC-CRM-2026-0002 registered', '10.0.0.4');
  insertAudit.run(c2.id, judge2.id, 'HEARING_ADJOURNED', 'Adjournment #2 logged by Justice Ananya Sharma', '10.0.0.15');
  insertAudit.run(c5.id, judge1.id, 'ORDER_RECORDED', 'Final Judgment delivered. Status transitioned to DISPOSED.', '10.0.0.12');
  insertAudit.run(c5.id, judge1.id, 'CASE_CLOSED', 'Case permanently closed on final judgment decree.', '10.0.0.12');

  // 8. Seed Notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, case_id, notification_type, channel, message, is_read)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run(litigant1.id, c1.id, 'HEARING_SCHEDULED', 'SMS', `Hearing scheduled for case DL-HC-CIV-2026-0001 today at 10:30 in Courtroom 1.`, 0);
  insertNotif.run(lawyer1.id, c1.id, 'HEARING_SCHEDULED', 'EMAIL', `Notice of Hearing: Case DL-HC-CIV-2026-0001 listed before Hon'ble Justice R. K. Verma.`, 0);
  insertNotif.run(lawyer2.id, c2.id, 'HEARING_ADJOURNED', 'EMAIL', `Case DL-HC-CRM-2026-0002 adjourned to 2026-10-15. Adjournment count: 2.`, 1);
  insertNotif.run(litigant2.id, c5.id, 'ORDER_PASSED', 'SMS', `Final Judgment pronounced in your favor in Case DL-HC-CIV-2024-0089. Decree uploaded.`, 1);

  console.log('Seeding completed successfully!');
}
