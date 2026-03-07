type LogLevel = 'info' | 'error' | 'warn' | 'debug';

const log = (level: LogLevel, obj: unknown, msg?: string) => {
  const timestamp = new Date().toISOString();
  if (typeof obj === 'string') {
    console[level === 'error' ? 'error' : 'log'](`[${timestamp}] [${level.toUpperCase()}] ${obj}`);
  } else {
    console[level === 'error' ? 'error' : 'log'](`[${timestamp}] [${level.toUpperCase()}] ${msg || ''}`, obj);
  }
};

export const logger = {
  info: (obj: unknown, msg?: string) => log('info', obj, msg),
  error: (obj: unknown, msg?: string) => log('error', obj, msg),
  warn: (obj: unknown, msg?: string) => log('warn', obj, msg),
  debug: (obj: unknown, msg?: string) => log('debug', obj, msg),
  child: (_bindings: Record<string, unknown>) => logger,
};
