export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface SDKOptions {
  timeoutMs?: number;
  logger?: ILogger;
}
