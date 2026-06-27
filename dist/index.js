"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugLogger = void 0;
exports.normalizeConsoleLogLevel = normalizeConsoleLogLevel;
exports.createDebugLogger = createDebugLogger;
const DEFAULT_BUFFER_SIZE = 500;
const consoleThresholds = {
    none: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};
function isConsoleLogLevel(value) {
    return typeof value === 'string' && value in consoleThresholds;
}
function normalizeConsoleLogLevel(value, fallback = 'warn') {
    return isConsoleLogLevel(value) ? value : fallback;
}
class DebugLogger {
    constructor(name, options = {}) {
        this.scopes = new Map();
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
    configure(consoleLevel) {
        this.state.consoleLevel = normalizeConsoleLogLevel(consoleLevel);
    }
    scope(scopeName) {
        const existing = this.scopes.get(scopeName);
        if (existing) {
            return existing;
        }
        const scopedLogger = {
            debug: (message, ...data) => this.writeRecord('debug', scopeName, message, data),
            info: (message, ...data) => this.writeRecord('info', scopeName, message, data),
            log: (message, ...data) => this.writeRecord('info', scopeName, message, data),
            warn: (message, ...data) => this.writeRecord('warn', scopeName, message, data),
            error: (message, ...data) => this.writeRecord('error', scopeName, message, data),
        };
        this.scopes.set(scopeName, scopedLogger);
        return scopedLogger;
    }
    debug(message, ...data) {
        this.record('debug', message, ...data);
    }
    info(message, ...data) {
        this.record('info', message, ...data);
    }
    log(message, ...data) {
        this.info(message, ...data);
    }
    warn(message, ...data) {
        this.record('warn', message, ...data);
    }
    error(message, ...data) {
        this.record('error', message, ...data);
    }
    record(level, message, ...data) {
        this.writeRecord(level, '', message, data);
    }
    writeRecord(level, scope, message, data) {
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
    getEntries() {
        return this.state.entries.map(entry => ({
            ...entry,
            values: entry.values.slice(),
        }));
    }
    formatForExport() {
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
    dump() {
        return this.formatForExport();
    }
    clear() {
        this.state.entries.length = 0;
    }
    async copyToClipboard(clipboard = navigator.clipboard) {
        await clipboard.writeText(this.formatForExport());
        return this.state.entries.length;
    }
    write(entry) {
        this.state.entries.push(entry);
        if (this.state.entries.length > this.bufferSize) {
            this.state.entries.splice(0, this.state.entries.length - this.bufferSize);
        }
    }
    shouldWriteToSink(level) {
        return consoleThresholds[level] <= consoleThresholds[this.state.consoleLevel];
    }
    formatData(data) {
        if (data.length === 0)
            return '';
        return data.map(value => this.formatValue(value)).join(' ');
    }
    formatValue(value) {
        if (value instanceof Error)
            return this.formatError(value);
        if (typeof value === 'string')
            return value;
        try {
            const json = JSON.stringify(value);
            return json ?? String(value);
        }
        catch {
            return String(value);
        }
    }
    formatError(error) {
        return error.stack ?? `${error.name}: ${error.message}`;
    }
}
exports.DebugLogger = DebugLogger;
function createDebugLogger(name, options) {
    return new DebugLogger(name, options);
}
