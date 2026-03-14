/**
 * Structured logger for the API server.
 *
 * Outputs JSON lines in production for easy ingestion by log aggregators
 * (Datadog, ELK, Loki, etc.) and human-readable formatted output in
 * development.
 *
 * Phase 9, Item 157: Structured logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? 'info'] ?? LOG_LEVELS.info;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface LogEntry {
  level: LogLevel;
  ts: string;
  msg: string;
  [key: string]: unknown;
}

interface Logger {
  debug: (obj: unknown, ...rest: unknown[]) => void;
  info: (obj: unknown, ...rest: unknown[]) => void;
  warn: (obj: unknown, ...rest: unknown[]) => void;
  error: (obj: unknown, ...rest: unknown[]) => void;
  child: (bindings: Record<string, unknown>) => Logger;
}

function createLogger(bindings: Record<string, unknown> = {}): Logger {
  const emit = (level: LogLevel, obj: unknown, ...rest: unknown[]) => {
    if (LOG_LEVELS[level] < MIN_LEVEL) return;

    const timestamp = new Date().toISOString();

    if (IS_PRODUCTION) {
      // Structured JSON output for production
      const entry: LogEntry = {
        level,
        ts: timestamp,
        msg: '',
        ...bindings,
      };

      if (typeof obj === 'string') {
        entry.msg = obj;
        // If additional args are objects, merge them; otherwise concatenate
        if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null) {
          Object.assign(entry, rest[0]);
        } else if (rest.length > 0) {
          entry.msg += ' ' + rest.map(r =>
            typeof r === 'object' ? JSON.stringify(r) : String(r)
          ).join(' ');
        }
      } else if (obj instanceof Error) {
        entry.msg = obj.message;
        entry.stack = obj.stack;
        entry.errorName = obj.name;
      } else if (typeof obj === 'object' && obj !== null) {
        Object.assign(entry, obj);
        if (rest.length > 0 && typeof rest[0] === 'string') {
          entry.msg = rest[0] as string;
        }
      }

      const fn = level === 'error' ? process.stderr : process.stdout;
      fn.write(JSON.stringify(entry) + '\n');
    } else {
      // Human-readable output for development
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      const bindingStr = Object.keys(bindings).length > 0
        ? ` ${JSON.stringify(bindings)}`
        : '';
      const fn = level === 'error' ? console.error : console.log;

      if (typeof obj === 'string') {
        fn(`${prefix}${bindingStr} ${obj}`, ...rest);
      } else {
        fn(`${prefix}${bindingStr}`, obj, ...rest);
      }
    }
  };

  return {
    debug: (obj: unknown, ...rest: unknown[]) => emit('debug', obj, ...rest),
    info: (obj: unknown, ...rest: unknown[]) => emit('info', obj, ...rest),
    warn: (obj: unknown, ...rest: unknown[]) => emit('warn', obj, ...rest),
    error: (obj: unknown, ...rest: unknown[]) => emit('error', obj, ...rest),
    child: (childBindings: Record<string, unknown>) =>
      createLogger({ ...bindings, ...childBindings }),
  };
}

export const logger = createLogger();
