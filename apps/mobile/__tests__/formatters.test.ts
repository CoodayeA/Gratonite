/**
 * Tests for the formatters utility module.
 */

import {
  formatTime,
  formatRelativeTime,
  formatMemberCount,
  truncate,
  formatFileSize,
  formatDuration,
} from '../src/lib/formatters';

describe('formatTime', () => {
  it('returns empty string for invalid date', () => {
    expect(formatTime('not-a-date')).toBe('');
  });

  it('returns time-only for today', () => {
    const now = new Date().toISOString();
    const result = formatTime(now);
    // Should look like "HH:MM AM/PM" or "HH:MM" depending on locale
    expect(result).toMatch(/\d{1,2}:\d{2}/);
    // Should NOT include a date like "Jan" for today
    expect(result.split(' ').length).toBeLessThanOrEqual(2);
  });

  it('returns date + time for past dates', () => {
    const past = new Date('2020-06-15T14:30:00Z').toISOString();
    const result = formatTime(past);
    expect(result).toContain('Jun');
    expect(result).toContain('15');
  });
});

describe('formatRelativeTime', () => {
  it('returns empty string for invalid date', () => {
    expect(formatRelativeTime('invalid')).toBe('');
  });

  it('returns "just now" for very recent timestamps', () => {
    const recent = new Date(Date.now() - 10 * 1000).toISOString();
    expect(formatRelativeTime(recent)).toBe('just now');
  });

  it('returns minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('returns hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
  });

  it('returns "yesterday" for 25-47 hours ago', () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(yesterday)).toBe('yesterday');
  });

  it('returns days ago for 2-6 days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });

  it('returns weeks ago for 7-34 days', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(twoWeeksAgo)).toBe('2w ago');
  });

  it('returns locale date for very old timestamps', () => {
    const longAgo = new Date('2020-01-01T00:00:00Z').toISOString();
    const result = formatRelativeTime(longAgo);
    // Should be a locale-formatted date, not "Xw ago"
    expect(result).not.toMatch(/w ago/);
  });
});

describe('formatMemberCount', () => {
  it('returns raw count for < 1000', () => {
    expect(formatMemberCount(999)).toBe('999');
  });

  it('returns K suffix for thousands', () => {
    expect(formatMemberCount(1500)).toBe('1.5K');
  });

  it('returns M suffix for millions', () => {
    expect(formatMemberCount(2000000)).toBe('2.0M');
  });
});

describe('truncate', () => {
  it('does not truncate strings within max length', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates and adds ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello w\u2026');
  });

  it('handles exact max length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.0 GB');
  });

  it('formats zero bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30');
  });

  it('pads seconds with leading zero', () => {
    expect(formatDuration(65)).toBe('1:05');
  });

  it('formats hours', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('formats zero duration', () => {
    expect(formatDuration(0)).toBe('0:00');
  });
});
