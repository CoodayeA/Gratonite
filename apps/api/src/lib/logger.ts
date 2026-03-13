type LogLevel = 'info' | 'error' | 'warn' | 'debug';

const log = (level: LogLevel, obj: unknown, ...rest: unknown[]) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  const fn = level === 'error' ? console.error : console.log;
  if (typeof obj === 'string') {
    fn(`${prefix} ${obj}`, ...rest);
  } else {
    fn(prefix, obj, ...rest);
  }
};

export const logger = {
  info: (obj: unknown, ...rest: unknown[]) => log('info', obj, ...rest),
  error: (obj: unknown, ...rest: unknown[]) => log('error', obj, ...rest),
  warn: (obj: unknown, ...rest: unknown[]) => log('warn', obj, ...rest),
  debug: (obj: unknown, ...rest: unknown[]) => log('debug', obj, ...rest),
  child: (_bindings: Record<string, unknown>) => logger,
};
