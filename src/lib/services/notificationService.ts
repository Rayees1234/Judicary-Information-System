import { getDb } from '../db/index';

export interface NotificationRecord {
  id: number;
  user_id: number;
  case_id?: number | null;
  notification_type: string;
  channel: 'SMS' | 'EMAIL' | 'SYSTEM';
  message: string;
  is_read: number;
  created_at: string;
}

export function dispatchNotification(
  userId: number,
  caseId: number | null,
  notificationType: string,
  message: string,
  channel: 'SMS' | 'EMAIL' | 'SYSTEM' = 'SYSTEM'
) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO notifications (user_id, case_id, notification_type, channel, message)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(userId, caseId, notificationType, channel, message);
}

export function getUserNotifications(userId: number, limit: number = 20): NotificationRecord[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(userId, limit) as unknown as NotificationRecord[];
}

export function markNotificationAsRead(id: number, userId: number) {
  const db = getDb();
  const stmt = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?');
  stmt.run(id, userId);
}
