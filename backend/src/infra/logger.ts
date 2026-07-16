import pino from 'pino';
import { getRequestContext } from './request-context.middleware.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_REDACT_PATHS = [
  'password',
  'secret',
  'token',
  'authorization',
  'apiKey',
  'api_key',
  'access_token',
  'refresh_token',
  'otp',
  'DATABASE_URL',
  'JWT_SECRET',
  'RESEND_API_KEY',
  'DEEPSEEK_API_KEY',
  'OPENAI_API_KEY',
  'R2_SECRET_ACCESS_KEY',
  'PAYMENT_WEBHOOK_SECRET',
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.secret',
  '*.token',
  '*.otp',
];

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: LOG_REDACT_PATHS,
    censor: '[REDACTED]',
  },
});

class Logger {
  private pinoLogger: pino.Logger;
  private module: string;
  private requestId?: string;

  constructor(module: string, requestId?: string, parentLogger?: pino.Logger) {
    this.module = module;
    this.requestId = requestId;
    this.pinoLogger = (parentLogger || baseLogger).child({ module });
  }

  withRequestId(requestId: string): Logger {
    return new Logger(this.module, requestId, this.pinoLogger);
  }

  withModule(module: string): Logger {
    return new Logger(module, this.requestId, this.pinoLogger);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.emit('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.emit('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.emit('error', message, meta);
  }

  private emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const effectiveRequestId = this.requestId || getRequestContext()?.requestId;
    
    const obj = {
      ...meta,
      ...(effectiveRequestId && { requestId: effectiveRequestId }),
    };
    
    this.pinoLogger[level](obj, message);
  }
}

export function createLogger(module: string): Logger {
  return new Logger(module);
}

export { Logger };
