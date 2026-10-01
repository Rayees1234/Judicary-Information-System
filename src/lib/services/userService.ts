import { getDb } from '../db/index';
import { hashPassword, type User, type UserRole } from '../auth';
import { logAudit } from './auditService';

export interface CreateUserInput {
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  password?: string;
  phone?: string;
  courtName?: string;
  designation?: string;
  courtroom?: string;
  barRegistrationNo?: string;
  idNumber?: string;
  address?: string;
}

export function getAllUsers(): User[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, username, email, full_name, role, phone, court_name,
      designation, courtroom, bar_registration_no, id_number, address, created_at
    FROM users
    ORDER BY role, full_name
  `).all() as unknown as User[];
}

export function getJudges(): User[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, username, email, full_name, role, designation, courtroom
    FROM users
    WHERE role = 'JUDGE'
    ORDER BY full_name
  `).all() as unknown as User[];
}

export function getLawyers(): User[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, username, email, full_name, role, bar_registration_no, phone
    FROM users
    WHERE role = 'LAWYER'
    ORDER BY full_name
  `).all() as unknown as User[];
}

export function createUser(input: CreateUserInput, actorUser: User, clientIp: string = '127.0.0.1'): User {
  if (actorUser.role !== 'ADMIN') {
    throw new Error('Only Administrators can create new user accounts');
  }

  if (!input.username || !input.email || !input.fullName || !input.role) {
    throw new Error('Username, email, full name, and role are mandatory');
  }

  const db = getDb();
  const rawPassword = input.password || 'Welcome@123';
  const passHash = hashPassword(rawPassword);

  const stmt = db.prepare(`
    INSERT INTO users (
      username, email, full_name, role, phone, court_name,
      designation, courtroom, bar_registration_no, id_number, address, password_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.username.toLowerCase().trim(),
    input.email.toLowerCase().trim(),
    input.fullName.trim(),
    input.role,
    input.phone || '',
    input.courtName || 'High Court of Judicature',
    input.designation || '',
    input.courtroom || '',
    input.barRegistrationNo || '',
    input.idNumber || '',
    input.address || '',
    passHash
  );

  const newId = Number(result.lastInsertRowid);

  logAudit(
    null,
    actorUser.id,
    'USER_CREATED',
    `User ${input.username} (${input.role}) created by ${actorUser.username}`,
    clientIp
  );

  return db.prepare('SELECT id, username, email, full_name, role, phone, court_name, designation, courtroom, bar_registration_no, id_number, address, created_at FROM users WHERE id = ?').get(newId) as unknown as User;
}
