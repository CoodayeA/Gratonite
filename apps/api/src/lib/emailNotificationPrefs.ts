/**
 * Canonical defaults for JSON `user_settings.email_notifications`.
 * Transactional mail (signup verification, password reset) does not use this object.
 */
export const DEFAULT_EMAIL_NOTIFICATIONS = {
  mentions: false,
  dms: false,
  frequency: 'never' as const,
  securityAlerts: false,
};

export type EmailNotificationPrefs = typeof DEFAULT_EMAIL_NOTIFICATIONS;

export function mergeEmailNotificationsJson(raw: unknown): EmailNotificationPrefs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_EMAIL_NOTIFICATIONS };
  }
  return { ...DEFAULT_EMAIL_NOTIFICATIONS, ...(raw as Record<string, unknown>) } as EmailNotificationPrefs;
}
