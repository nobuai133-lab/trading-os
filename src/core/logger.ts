type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  service?:       string;
  [key: string]:  unknown;
}

function log(level: Level, msg: string, ctx?: LogContext): void {
  const entry = {
    ts:    new Date().toISOString(),
    level,
    msg,
    ...(ctx ?? {}),
  };
  const out = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(out + '\n');
  else                   process.stdout.write(out + '\n');
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
  info:  (msg: string, ctx?: LogContext) => log('info',  msg, ctx),
  warn:  (msg: string, ctx?: LogContext) => log('warn',  msg, ctx),
  error: (msg: string, ctx?: LogContext) => log('error', msg, ctx),

  withContext(ctx: LogContext) {
    return {
      debug: (msg: string, extra?: LogContext) => log('debug', msg, { ...ctx, ...extra }),
      info:  (msg: string, extra?: LogContext) => log('info',  msg, { ...ctx, ...extra }),
      warn:  (msg: string, extra?: LogContext) => log('warn',  msg, { ...ctx, ...extra }),
      error: (msg: string, extra?: LogContext) => log('error', msg, { ...ctx, ...extra }),
    };
  },
};
