/**
 * User-level notification quiet hours — suppress toasts/socket fan-out and email digests
 * during a daily time window (distinct from presence DND / dnd_schedules).
 */

export type NotificationQuietHoursJson = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone?: string;
  days: number[];
};

const DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function mergeNotificationQuietHoursJson(
  existing: unknown,
  incoming: NotificationQuietHoursJson | null,
): NotificationQuietHoursJson | null {
  if (incoming === null) return null;
  const base = normalizeQuietHours(existing);
  return {
    ...base,
    ...incoming,
    days: Array.isArray(incoming.days) && incoming.days.length ? [...new Set(incoming.days)].sort() : base.days,
  };
}

export function normalizeQuietHours(raw: unknown): NotificationQuietHoursJson {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const days = Array.isArray(o.days) ? (o.days as unknown[]).filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6) : [];
  return {
    enabled: o.enabled === true,
    startTime: typeof o.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.startTime) ? o.startTime : '22:00',
    endTime: typeof o.endTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(o.endTime) ? o.endTime : '07:00',
    timezone: typeof o.timezone === 'string' && o.timezone.length > 0 ? o.timezone.slice(0, 64) : 'UTC',
    days: days.length ? days : [...DEFAULT_DAYS],
  };
}

/** Same window logic as DND schedule job — string compare works for HH:mm zero-padded. */
export function isWithinNotificationQuietHours(raw: unknown, now: Date = new Date()): boolean {
  const q = normalizeQuietHours(raw);
  if (!q.enabled) return false;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: q.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const currentTime = `${hour}:${minute}`;

  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: q.timezone, weekday: 'long' });
  const dayName = dayFormatter.format(now);
  const dayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const currentDay = dayMap[dayName] ?? 0;
  if (!q.days.includes(currentDay)) return false;

  const { startTime, endTime } = q;
  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime < endTime;
  }
  return currentTime >= startTime || currentTime < endTime;
}
