export type DebugLogLevel = 'debug' | 'info' | 'warn' | 'error';
export type ConsoleLogLevel = 'none' | DebugLogLevel;

export interface DebugLogEntry {
  timestamp: number;
  level: DebugLogLevel;
  scope: string;
  message: string;
  data: string;
  values: readonly unknown[];
}

export interface DebugLoggerOptions {
  defaultConsoleLevel?: ConsoleLogLevel;
  bufferSize?: number;
  sink?: DebugLogSink;
}

interface DebugLoggerState {
  entries: DebugLogEntry[];
  consoleLevel: ConsoleLogLevel;
}

export type DebugLogSink = (entry: DebugLogEntry, args: readonly unknown[]) => void;

const DEFAULT_BUFFER_SIZE = 500;

const consoleThresholds: Record<ConsoleLogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function isConsoleLogLevel(value: unknown): value is ConsoleLogLevel {
  return typeof value === 'string' && value in consoleThresholds;
}

export function normalizeConsoleLogLevel(value: unknown, fallback: ConsoleLogLevel = 'warn'): ConsoleLogLevel {
  return isConsoleLogLevel(value) ? value : fallback;
}

export interface ScopedDebugLogger {
  debug(message: unknown, ...data: unknown[]): void;
  info(message: unknown, ...data: unknown[]): void;
  log(message: unknown, ...data: unknown[]): void;
  warn(message: unknown, ...data: unknown[]): void;
  error(message: unknown, ...data: unknown[]): void;
}

export class DebugLogger {
  private readonly name: string;
  private readonly bufferSize: number;
  private readonly sink: DebugLogSink | undefined;
  private readonly scopes = new Map<string, ScopedDebugLogger>();
  private readonly state: DebugLoggerState;

  public constructor(name: string, options: DebugLoggerOptions = {}) {
    this.name = name;
    const defaultConsoleLevel = options.defaultConsoleLevel ?? 'warn';
    this.bufferSize = options.bufferSize ?? DEFAULT_BUFFER_SIZE;
    this.sink = options.sink;

    if (!Number.isSafeInteger(this.bufferSize) || this.bufferSize <= 0) {
      throw new Error(`Debug logger "${this.name}" bufferSize must be a positive safe integer.`);
    }
    if (!isConsoleLogLevel(defaultConsoleLevel)) {
      throw new Error(`Debug logger "${this.name}" defaultConsoleLevel must be one of: none, error, warn, info, debug.`);
    }

    this.state = {
      entries: [],
      consoleLevel: defaultConsoleLevel,
    };
  }

  public configure(consoleLevel: ConsoleLogLevel): void {
    this.state.consoleLevel = normalizeConsoleLogLevel(consoleLevel);
  }

  public scope(scopeName: string): ScopedDebugLogger {
    const existing = this.scopes.get(scopeName);
    if (existing) {
      return existing;
    }

    const scopedLogger: ScopedDebugLogger = {
      debug: (message: unknown, ...data: unknown[]) => this.writeRecord('debug', scopeName, message, data),
      info: (message: unknown, ...data: unknown[]) => this.writeRecord('info', scopeName, message, data),
      log: (message: unknown, ...data: unknown[]) => this.writeRecord('info', scopeName, message, data),
      warn: (message: unknown, ...data: unknown[]) => this.writeRecord('warn', scopeName, message, data),
      error: (message: unknown, ...data: unknown[]) => this.writeRecord('error', scopeName, message, data),
    };
    this.scopes.set(scopeName, scopedLogger);
    return scopedLogger;
  }

  public debug(message: unknown, ...data: unknown[]): void {
    this.record('debug', message, ...data);
  }

  public info(message: unknown, ...data: unknown[]): void {
    this.record('info', message, ...data);
  }

  public log(message: unknown, ...data: unknown[]): void {
    this.info(message, ...data);
  }

  public warn(message: unknown, ...data: unknown[]): void {
    this.record('warn', message, ...data);
  }

  public error(message: unknown, ...data: unknown[]): void {
    this.record('error', message, ...data);
  }

  public record(level: DebugLogLevel, message: unknown, ...data: unknown[]): void {
    this.writeRecord(level, '', message, data);
  }

  private writeRecord(level: DebugLogLevel, scope: string, message: unknown, data: unknown[]): void {
    const entry = {
      timestamp: Date.now(),
      level,
      scope,
      message: this.formatValue(message),
      data: this.formatData(data),
      values: data.slice(),
    };
    this.write(entry);

    if (!this.sink || !this.shouldWriteToSink(level)) {
      return;
    }

    const sinkArgs = scope
      ? [`[${this.name}]`, `[${scope}]`, message, ...data]
      : [`[${this.name}]`, message, ...data];

    this.sink(entry, sinkArgs);
  }

  public getEntries(): DebugLogEntry[] {
    return this.state.entries.map(entry => ({
      ...entry,
      values: entry.values.slice(),
    }));
  }

  public formatForExport(): string {
    const entries = this.getEntries();
    const now = new Date().toISOString();
    const lines = [
      `${this.name} Debug Log - ${now}`,
      `Entries ${entries.length}/${this.bufferSize}`,
      '============================================================',
    ];

    for (const entry of entries) {
      const timestamp = new Date(entry.timestamp).toISOString();
      const level = entry.level.toUpperCase().padEnd(5);
      const data = entry.data ? ` ${entry.data}` : '';
      const scope = entry.scope ? ` [${entry.scope}]` : '';
      lines.push(`${timestamp} [${level}]${scope} ${entry.message}${data}`);
    }

    return lines.join('\n');
  }

  public dump(): string {
    return this.formatForExport();
  }

  public clear(): void {
    this.state.entries.length = 0;
  }

  public async copyToClipboard(clipboard: Pick<Clipboard, 'writeText'> = navigator.clipboard): Promise<number> {
    await clipboard.writeText(this.formatForExport());
    return this.state.entries.length;
  }

  private write(entry: DebugLogEntry): void {
    this.state.entries.push(entry);
    if (this.state.entries.length > this.bufferSize) {
      this.state.entries.splice(0, this.state.entries.length - this.bufferSize);
    }
  }

  private shouldWriteToSink(level: DebugLogLevel): boolean {
    return consoleThresholds[level] <= consoleThresholds[this.state.consoleLevel];
  }

  private formatData(data: unknown[]): string {
    if (data.length === 0) return '';
    return data.map(value => this.formatValue(value)).join(' ');
  }

  private formatValue(value: unknown): string {
    if (value instanceof Error) return this.formatError(value);
    if (typeof value === 'string') return value;

    try {
      const json = JSON.stringify(value);
      return json ?? String(value);
    }
    catch {
      return String(value);
    }
  }

  private formatError(error: Error): string {
    return error.stack ?? `${error.name}: ${error.message}`;
  }
}

export function createDebugLogger(name: string, options?: DebugLoggerOptions): DebugLogger {
  return new DebugLogger(name, options);
}
