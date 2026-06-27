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
export type DebugLogSink = (entry: DebugLogEntry, args: readonly unknown[]) => void;
export declare function normalizeConsoleLogLevel(value: unknown, fallback?: ConsoleLogLevel): ConsoleLogLevel;
export interface ScopedDebugLogger {
    debug(message: unknown, ...data: unknown[]): void;
    info(message: unknown, ...data: unknown[]): void;
    log(message: unknown, ...data: unknown[]): void;
    warn(message: unknown, ...data: unknown[]): void;
    error(message: unknown, ...data: unknown[]): void;
}
export declare class DebugLogger {
    private readonly name;
    private readonly bufferSize;
    private readonly sink;
    private readonly scopes;
    private readonly state;
    constructor(name: string, options?: DebugLoggerOptions);
    configure(consoleLevel: ConsoleLogLevel): void;
    scope(scopeName: string): ScopedDebugLogger;
    debug(message: unknown, ...data: unknown[]): void;
    info(message: unknown, ...data: unknown[]): void;
    log(message: unknown, ...data: unknown[]): void;
    warn(message: unknown, ...data: unknown[]): void;
    error(message: unknown, ...data: unknown[]): void;
    record(level: DebugLogLevel, message: unknown, ...data: unknown[]): void;
    private writeRecord;
    getEntries(): DebugLogEntry[];
    formatForExport(): string;
    dump(): string;
    clear(): void;
    copyToClipboard(clipboard?: Pick<Clipboard, 'writeText'>): Promise<number>;
    private write;
    private shouldWriteToSink;
    private formatData;
    private formatValue;
    private formatError;
}
export declare function createDebugLogger(name: string, options?: DebugLoggerOptions): DebugLogger;
