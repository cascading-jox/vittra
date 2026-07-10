/**
 * Configuration options for Vittra
 */
export interface VittraOptions {
    /**
     * 0 (default) disables logging, 1 shows warnings and errors only,
     * 2 shows the full trace. Levels above 2 are reserved and currently
     * behave like 2. When omitted, a level persisted via
     * setLogLevel(level, { persist: true }) is used if present.
     */
    logLevel?: number;
    /** Set true to enable time logging for all functions (default false) */
    logTime?: boolean;
    /** Set true to enable explicit string and number formatting */
    logWithType?: boolean;
}

/**
 * Scoped logger handed to a tfa callback. Everything logged through it is
 * buffered into that async operation and replayed as one block when the
 * operation completes, so concurrent operations never interleave their logs.
 */
export interface VittraOpLogger {
    tf(...valuesToLog: unknown[]): void;
    tfc(...valuesToLog: unknown[]): void;
    tfw(...valuesToLog: unknown[]): void;
    tfe(...valuesToLog: unknown[]): void;
    tft(tabularData: Record<string, unknown> | Array<unknown>, properties?: string[]): void;
    tfa<T>(
        func: string,
        fnOrPromise: ((t: VittraOpLogger) => T | Promise<T>) | Promise<T>,
    ): Promise<T>;
}

interface BufferedLog {
    kind: 'log';
    level: 'log' | 'clean' | 'warn' | 'error';
    values: unknown[];
    /** ms since the operation started, for Δ display at replay */
    delta: number;
}

interface BufferedTable {
    kind: 'table';
    data: Record<string, unknown> | Array<unknown>;
    properties?: string[];
}

interface BufferedChild {
    kind: 'child';
    childId: number;
}

type BufferedEntry = BufferedLog | BufferedTable | BufferedChild;

interface AsyncOp {
    id: number;
    func: string;
    start: number;
    parent: number | null;
    buffer: BufferedEntry[];
    status: 'pending' | 'done' | 'failed';
    resultValues: unknown[];
    error?: unknown;
    duration?: number;
}

interface CompletedOp {
    id: number;
    func: string;
    parent: number | null;
    status: 'done' | 'failed';
    duration: number;
}

/** Per-operation colors so entry and completion lines pair visually */
const OP_COLORS = [
    '#2196f3',
    '#e91e63',
    '#4caf50',
    '#ff9800',
    '#9c27b0',
    '#00bcd4',
    '#f44336',
    '#795548',
];

/** How many completed operations tfat() keeps for display */
const COMPLETED_OPS_LIMIT = 50;

/** Name of both the URL parameter and the localStorage key for the log level */
const LOG_LEVEL_KEY = 'vittraLogLevel';

/**
 * Read the log level from the vittraLogLevel URL parameter.
 * Returns null when the parameter is absent or not a valid number.
 */
function readUrlLogLevel(): number | null {
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.location?.search &&
            typeof globalThis.URLSearchParams === 'function'
        ) {
            const urlParams = new globalThis.URLSearchParams(globalThis.location.search);
            const param = urlParams.get(LOG_LEVEL_KEY);
            if (param !== null) {
                const level = Number(param);
                if (Number.isFinite(level)) {
                    return level;
                }
            }
        }
    } catch {
        // Silently handle any errors if URL parsing fails
    }
    return null;
}

/** Intersperse ',' between values so console output reads like an argument list */
function intersperseCommas(values: unknown[]): unknown[] {
    const result: unknown[] = [];
    for (let i = 0; i < values.length; i++) {
        result.push(values[i]);
        if (i !== values.length - 1) {
            result.push(',');
        }
    }
    return result;
}

/**
 * Read a log level persisted by setLogLevel(level, { persist: true }).
 * Returns null when nothing valid is stored or localStorage is unavailable.
 */
function readPersistedLogLevel(): number | null {
    try {
        const stored = globalThis.localStorage?.getItem(LOG_LEVEL_KEY);
        if (stored != null) {
            const level = Number(stored);
            if (Number.isFinite(level)) {
                return level;
            }
        }
    } catch {
        // localStorage unavailable (SSR, privacy settings) — nothing persisted
    }
    return null;
}

/**
 * Vittra - A simple context-in-depth logging library.
 * All methods use a 't' prefix for "trace", followed by their specific function:
 * - tfi: trace function in (entry)
 * - tfo: trace function out (exit)
 * - tf:  trace function (basic logging)
 * - tfc: trace function clean (no prefix)
 * - tfw: trace function warning
 * - tfe: trace function error
 * - tft: trace function table
 * - tfa: trace function async (wraps a whole async operation)
 * - tfat: trace function async table (pending + recent operations)
 *
 * Runtime control:
 * - setLogLevel: change the log level on demand (optionally persisted)
 * - reset: clear all tracing state
 *
 * Log levels: 0 = off, 1 = warnings and errors, 2 = full trace, 3+ reserved.
 *
 * Example usage:
 * ```typescript
 * const log = new Vittra({ logLevel: 2, logTime: true });
 *
 * function processUser(userId: string) {
 *   log.tfi('processUser', userId);  // --> processUser( "123" )
 *
 *   log.tf('Fetching user data...');  // + Fetching user data... [Δ 0.5ms]
 *   const user = { id: userId, name: 'John' };
 *
 *   log.tfw('User data incomplete');  // + User data incomplete
 *
 *   log.tft(user);  // Displays user object in table format
 *
 *   log.tfo('processUser', user);  // <-- processUser [1.2ms] = { id: "123", name: "John" }
 *   return user;
 * }
 * ```
 */
export class Vittra {
    private logLevel: number;
    private logTime: boolean;
    private logWithType: boolean;
    private boldStyle: string;
    private timers: number[];
    private functionStack: string[] = []; // Track function entries
    private asyncOps: Map<number, AsyncOp> = new Map();
    private completedOps: CompletedOp[] = [];
    private nextAsyncId: number = 1;
    /** Ops in their synchronous start phase — parents for nested tfa calls */
    private currentOpStack: number[] = [];

    constructor(options: VittraOptions = {}) {
        // URL parameter overrides the option; an omitted option falls back to a persisted level
        this.logLevel = readUrlLogLevel() ?? options.logLevel ?? readPersistedLogLevel() ?? 0;
        this.logTime = options.logTime || false;
        this.logWithType = options.logWithType || false;
        this.boldStyle = 'font-weight: bold';
        this.timers = [];
    }

    /**
     * Change the log level at runtime, e.g. to escalate tracing when a
     * suspected bug condition is hit.
     * @param level The new log level (0 disables logging)
     * @param options Set persist to true to remember the level in localStorage
     *                across page loads; persisting 0 clears the remembered level.
     *
     * Example:
     * ```typescript
     * if (value === suspectedBugValue) {
     *     log.setLogLevel(3); // this session only
     * }
     * log.setLogLevel(2, { persist: true }); // remembered across reloads
     * log.setLogLevel(0, { persist: true }); // off, and forgotten
     * ```
     */
    setLogLevel(level: number, options: { persist?: boolean } = {}): void {
        if (!Number.isFinite(level)) {
            return;
        }
        this.logLevel = level;
        if (options.persist !== true) {
            return;
        }
        try {
            if (level === 0) {
                globalThis.localStorage?.removeItem(LOG_LEVEL_KEY);
            } else {
                globalThis.localStorage?.setItem(LOG_LEVEL_KEY, String(level));
            }
        } catch {
            // localStorage unavailable — the level still applies in memory
        }
    }

    /**
     * Formats a time duration into a human-readable string
     * @param delta Time in milliseconds
     * @returns Formatted time string (e.g., "1.2 ms", "2.500 s", "01:30.000")
     */
    private formatTime(delta: number): string {
        // ms
        if (delta < 1000) {
            return `${delta.toFixed(1)} ms`;
        }
        // seconds
        if (delta < 60000) {
            const seconds = Math.floor(delta / 1000);
            const millis = Math.floor(delta % 1000);
            return `${seconds}.${millis.toString().padStart(3, '0')} s`;
        }
        // minutes:seconds.millis
        const minutes = Math.floor(delta / 60000);
        const seconds = Math.floor((delta % 60000) / 1000);
        const millis = Math.floor(delta % 1000);
        const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();
        const secondsStr = seconds < 10 ? `0${seconds}` : seconds.toString();
        return `${minutesStr}:${secondsStr}.${millis.toString().padStart(3, '0')}`;
    }

    /**
     * Snapshot a logged value so the console shows it as it was at log time.
     * Errors are passed through live so message and stack survive. Values
     * that cannot be cloned fall back to the live reference — a log call
     * must never throw.
     */
    private snapshotValue(value: unknown): unknown {
        if (value instanceof Error) {
            return value;
        }
        if (typeof globalThis.structuredClone === 'function') {
            try {
                return globalThis.structuredClone(value);
            } catch {
                // Not structured-cloneable (e.g. contains a function) — try JSON
            }
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }

    private snapshot(values: unknown[]): unknown[] {
        const cloned: unknown[] = [];
        for (const value of values) {
            cloned.push(this.snapshotValue(value));
        }
        return cloned;
    }

    /**
     * Internal method to handle different types of console output
     */
    private logToConsole(mode: 'tf' | 'tfc' | 'tfw' | 'tfe', valuesToLog: unknown[]): void {
        // Level 1 shows warnings and errors only; plain logs need level 2
        const requiredLevel = mode === 'tfw' || mode === 'tfe' ? 1 : 2;
        if (this.logLevel < requiredLevel) return;

        const objectClone = this.snapshot(valuesToLog);
        const lastTimer = this.timers[this.timers.length - 1];
        let deltaString = '';

        if (this.logTime && typeof lastTimer === 'number') {
            const delta = performance.now() - lastTimer;
            const formattedTime = this.formatTime(delta);
            deltaString = `  [Δ ${formattedTime}]`;
        }

        let nOs = '';
        if (this.logWithType === true) {
            nOs = '%o'.repeat(objectClone.length);
        }

        const isSimpleType = typeof objectClone === 'number' || typeof objectClone === 'string';

        switch (mode) {
            case 'tfc':
                if (isSimpleType) {
                    console.log('%c', this.boldStyle, objectClone, deltaString);
                } else {
                    console.log(`%c${nOs}`, this.boldStyle, ...objectClone, deltaString);
                }
                break;
            case 'tfw':
                if (isSimpleType) {
                    console.warn('%c+ ', this.boldStyle, objectClone, deltaString);
                } else {
                    console.warn(`%c+ ${nOs}`, this.boldStyle, ...objectClone, deltaString);
                }
                break;
            case 'tfe':
                if (isSimpleType) {
                    console.error('%c+ ', this.boldStyle, objectClone, deltaString);
                } else {
                    console.error(`%c+ ${nOs}`, this.boldStyle, ...objectClone, deltaString);
                }
                break;
            case 'tf':
            default:
                if (isSimpleType) {
                    console.log('%c+ ', this.boldStyle, objectClone, deltaString);
                } else {
                    console.log(`%c+ ${nOs}`, this.boldStyle, ...objectClone, deltaString);
                }
                break;
        }
    }

    /**
     * Track Function In Async - logs the start of an async function call and returns an operation ID
     * that must be used when calling tfoa to complete the async operation.
     *
     * @param func - The name of the function being called
     * @param args - Optional arguments passed to the function
     * @returns A unique operation ID that must be stored and passed to tfoa
     *
     * @example
     * ```typescript
     * // Single async operation
     * async function fetchData() {
     *   const opId = log.tfia('fetchData');
     *   try {
     *     const result = await api.getData();
     *     log.tfoa('fetchData', opId, result);
     *     return result;
     *   } catch (error) {
     *     log.tfoa('fetchData', opId, error);
     *     throw error;
     *   }
     * }
     *
     * // Multiple concurrent calls to same function
     * async function processBatch(items: string[]) {
     *   const ops = items.map(item => {
     *     const opId = log.tfia('processItem', item);
     *     return { item, opId };
     *   });
     *
     *   await Promise.all(
     *     ops.map(async ({ item, opId }) => {
     *       const result = await process(item);
     *       log.tfoa('processItem', opId, result);
     *     })
     *   );
     * }
     * ```
     */
    tfia(func: string, ...args: unknown[]): number {
        const opId = this.nextAsyncId++;
        if (this.logLevel < 2) return opId;

        this.asyncOps.set(opId, {
            id: opId,
            func,
            start: performance.now(),
            parent: null,
            buffer: [],
            status: 'pending',
            resultValues: [],
        });

        const style = this.opStyle(opId);
        if (args.length > 0) {
            const objectClone = this.snapshot(intersperseCommas(args));
            console.log(`%c⟳ ${func} #${opId} (`, style, ...objectClone, ')');
        } else {
            console.log(`%c⟳ ${func} #${opId} ()`, style);
        }

        return opId;
    }

    /**
     * Track Function Out Async - logs the completion of an async function call.
     * Must be called with the operation ID returned from the corresponding tfia call.
     *
     * @param func - The name of the function being completed
     * @param opId - The operation ID returned from the corresponding tfia call
     * @param returnValues - Optional return values from the function
     *
     * @example
     * ```typescript
     * // Basic usage
     * async function fetchData() {
     *   const opId = log.tfia('fetchData');
     *   const result = await api.getData();
     *   log.tfoa('fetchData', opId, result);
     *   return result;
     * }
     *
     * // Nested async operations
     * async function processData() {
     *   const outerOpId = log.tfia('processData');
     *
     *   // Start nested operation
     *   const innerOpId = log.tfia('fetchDetails');
     *   const details = await api.getDetails();
     *   log.tfoa('fetchDetails', innerOpId, details);
     *
     *   // Complete outer operation
     *   const result = transform(details);
     *   log.tfoa('processData', outerOpId, result);
     *   return result;
     * }
     * ```
     */
    tfoa(func: string, opId: number, ...returnValues: unknown[]): void {
        if (this.logLevel < 2) return;

        const op = this.asyncOps.get(opId);
        if (!op || op.func !== func) {
            this.tfw(`Warning: tfoa called for '${func}' (ID: ${opId}) but no matching tfia found`);
            return;
        }

        const duration = performance.now() - op.start;
        const runTimeString = this.logTime ? ` [${this.formatTime(duration)}]` : '';
        const style = this.opStyle(opId);
        if (returnValues.length > 0) {
            const objectClone = this.snapshot(intersperseCommas(returnValues));
            console.log(`%c✓ ${func} #${opId}${runTimeString} =`, style, ...objectClone);
        } else {
            console.log(`%c✓ ${func} #${opId}${runTimeString}`, style);
        }

        this.recordCompleted(op, 'done', duration);
        this.asyncOps.delete(opId);
    }

    /**
     * Trace function async - wraps a whole async operation: logs entry (⟳)
     * immediately, buffers everything logged through the scoped logger, and
     * replays the buffer as one grouped block when the operation settles —
     * ✓ on success, ✗ on failure (failures rethrow). Concurrent operations
     * therefore never interleave their internal logs.
     *
     * Accepts either a callback receiving the scoped logger, or a bare
     * promise for one-line cases.
     *
     * @param func The name of the operation
     * @param fnOrPromise Callback receiving a scoped logger, or a promise to time
     * @returns The callback's return value (or the promise's resolution)
     *
     * Example:
     * ```typescript
     * const user = await log.tfa('fetchUser', async (t) => {
     *     const res = await fetch(url);
     *     t.tf('got response');            // buffered into this operation
     *     return res.json();
     * });
     *
     * const res = await log.tfa('GET /user', fetch(url)); // one-liner
     * ```
     */
    tfa<T>(
        func: string,
        fnOrPromise: ((t: VittraOpLogger) => T | Promise<T>) | Promise<T>,
    ): Promise<T> {
        const parentId =
            this.currentOpStack.length > 0
                ? this.currentOpStack[this.currentOpStack.length - 1]
                : null;
        return this.runOp(func, fnOrPromise, parentId);
    }

    private runOp<T>(
        func: string,
        fnOrPromise: ((t: VittraOpLogger) => T | Promise<T>) | Promise<T>,
        parentId: number | null,
    ): Promise<T> {
        if (this.logLevel < 2) {
            if (typeof fnOrPromise === 'function') {
                return Promise.resolve(fnOrPromise(this.noopOpLogger));
            }
            return Promise.resolve(fnOrPromise);
        }

        const opId = this.nextAsyncId++;
        const op: AsyncOp = {
            id: opId,
            func,
            start: performance.now(),
            parent: parentId,
            buffer: [],
            status: 'pending',
            resultValues: [],
        };
        this.asyncOps.set(opId, op);

        // Entry line: recorded inside a pending parent, printed live otherwise
        const parent = parentId !== null ? this.asyncOps.get(parentId) : undefined;
        if (parent && parent.status === 'pending') {
            parent.buffer.push({ kind: 'child', childId: opId });
        } else {
            op.parent = null;
            console.log(`%c⟳ ${func} #${opId}`, this.opStyle(opId));
        }

        let result: T | Promise<T>;
        if (typeof fnOrPromise === 'function') {
            this.currentOpStack.push(opId);
            try {
                result = fnOrPromise(this.createOpLogger(op));
            } catch (error) {
                this.currentOpStack.pop();
                this.completeOp(op, 'failed', [], error);
                throw error;
            }
            this.currentOpStack.pop();
        } else {
            result = fnOrPromise;
        }

        return Promise.resolve(result).then(
            (value) => {
                this.completeOp(op, 'done', value === undefined ? [] : [value]);
                return value;
            },
            (error) => {
                this.completeOp(op, 'failed', [], error);
                throw error;
            },
        );
    }

    private completeOp(
        op: AsyncOp,
        status: 'done' | 'failed',
        resultValues: unknown[],
        error?: unknown,
    ): void {
        if (op.status !== 'pending') return;
        op.status = status;
        op.resultValues = this.snapshot(resultValues);
        op.error = error;
        op.duration = performance.now() - op.start;
        this.recordCompleted(op, status, op.duration);

        const parent = op.parent !== null ? this.asyncOps.get(op.parent) : undefined;
        if (parent && parent.status === 'pending') {
            return; // replayed inline when the parent completes
        }
        if (this.logLevel >= 2) {
            this.replayOp(op, true);
        }
        this.asyncOps.delete(op.id);
    }

    /**
     * Print a completed operation's block: header, buffered lines in order,
     * completed children inlined as nested blocks at their start position.
     */
    private replayOp(op: AsyncOp, standalone: boolean): void {
        const style = this.opStyle(op.id);
        const mark = op.status === 'failed' ? '✗' : '✓';
        const badge = standalone && op.parent !== null ? ` ←#${op.parent}` : '';
        const runTimeString =
            this.logTime && op.duration !== undefined ? ` [${this.formatTime(op.duration)}]` : '';
        const header = `%c${mark} ${op.func} #${op.id}${badge}${runTimeString}`;

        if (op.resultValues.length > 0) {
            console.group(`${header} =`, style, ...op.resultValues);
        } else {
            console.group(header, style);
        }

        for (const entry of op.buffer) {
            if (entry.kind === 'log') {
                const deltaString = this.logTime ? `  [Δ ${this.formatTime(entry.delta)}]` : '';
                if (entry.level === 'clean') {
                    console.log('%c', this.boldStyle, ...entry.values, deltaString);
                } else if (entry.level === 'warn') {
                    console.warn('%c+ ', this.boldStyle, ...entry.values, deltaString);
                } else if (entry.level === 'error') {
                    console.error('%c+ ', this.boldStyle, ...entry.values, deltaString);
                } else {
                    console.log('%c+ ', this.boldStyle, ...entry.values, deltaString);
                }
            } else if (entry.kind === 'table') {
                console.table(entry.data, entry.properties);
            } else {
                const child = this.asyncOps.get(entry.childId);
                if (child && child.status !== 'pending') {
                    this.replayOp(child, false);
                    this.asyncOps.delete(child.id);
                } else if (child) {
                    console.log(`%c⟳ ${child.func} #${child.id} (pending)`, this.opStyle(child.id));
                }
            }
        }

        if (op.status === 'failed' && op.error !== undefined) {
            console.error(op.error);
        }
        console.groupEnd();
    }

    private createOpLogger(op: AsyncOp): VittraOpLogger {
        return {
            tf: (...values: unknown[]) => this.bufferLog(op, 'log', values),
            tfc: (...values: unknown[]) => this.bufferLog(op, 'clean', values),
            tfw: (...values: unknown[]) => this.bufferLog(op, 'warn', values),
            tfe: (...values: unknown[]) => this.bufferLog(op, 'error', values),
            tft: (data: Record<string, unknown> | Array<unknown>, properties?: string[]) => {
                if (this.logLevel < 2) return;
                if (op.status === 'pending') {
                    op.buffer.push({ kind: 'table', data, properties });
                } else {
                    this.tft(data, properties);
                }
            },
            tfa: <T>(
                childFunc: string,
                fnOrPromise: ((t: VittraOpLogger) => T | Promise<T>) | Promise<T>,
            ): Promise<T> => this.runOp(childFunc, fnOrPromise, op.id),
        };
    }

    private bufferLog(op: AsyncOp, level: BufferedLog['level'], values: unknown[]): void {
        const requiredLevel = level === 'warn' || level === 'error' ? 1 : 2;
        if (this.logLevel < requiredLevel) return;
        if (op.status !== 'pending') {
            // Operation already replayed — fall back to live logging
            const mode =
                level === 'clean'
                    ? 'tfc'
                    : level === 'warn'
                      ? 'tfw'
                      : level === 'error'
                        ? 'tfe'
                        : 'tf';
            this.logToConsole(mode, values);
            return;
        }
        op.buffer.push({
            kind: 'log',
            level,
            values: this.snapshot(values),
            delta: performance.now() - op.start,
        });
    }

    private recordCompleted(op: AsyncOp, status: 'done' | 'failed', duration: number): void {
        this.completedOps.push({
            id: op.id,
            func: op.func,
            parent: op.parent,
            status,
            duration,
        });
        if (this.completedOps.length > COMPLETED_OPS_LIMIT) {
            this.completedOps.shift();
        }
    }

    private opStyle(opId: number): string {
        return `font-weight: bold; color: ${OP_COLORS[opId % OP_COLORS.length]}`;
    }

    private noopOpLogger: VittraOpLogger = {
        tf: () => {},
        tfc: () => {},
        tfw: () => {},
        tfe: () => {},
        tft: () => {},
        tfa: <T>(
            func: string,
            fnOrPromise: ((t: VittraOpLogger) => T | Promise<T>) | Promise<T>,
        ): Promise<T> => this.runOp(func, fnOrPromise, null),
    };

    /**
     * Trace function in: Log function call & increment log depth with 1
     * @param func The name of the function that is called
     * @param callerArgs Either spread args (`...args`) or the `arguments` object
     *
     * Example:
     * ```typescript
     * function getData(userId: string, type: string) {
     *   log.tfi('getData', userId, type);  // --> getData( "123", "user" )
     *   // ... function code ...
     * }
     * ```
     */
    tfi(func: string, ...callerArgs: unknown[]): void {
        if (this.logLevel < 2) return;

        // Add function to stack
        this.functionStack.push(func);

        if (this.logTime === true) {
            this.timers.push(performance.now());
        }

        const tmpArray: unknown[] = [];
        if (callerArgs != null && callerArgs.length > 0) {
            if (typeof callerArgs === 'number' || typeof callerArgs === 'string') {
                tmpArray.push(callerArgs);
            } else {
                let i = 0;
                for (const key in callerArgs) {
                    if (Object.prototype.hasOwnProperty.call(callerArgs, key)) {
                        const element = callerArgs[key];
                        tmpArray.push(element);
                        if (Object.keys(callerArgs).length - 1 !== i) {
                            tmpArray.push(',');
                        }
                        ++i;
                    }
                }
            }
            const objectClone = this.snapshot(tmpArray);

            if (objectClone.length === 0) {
                console.group(`%c--> ${func}(`, this.boldStyle, ...objectClone, ')');
            } else {
                console.group(`%c--> ${func}(`, this.boldStyle, ...objectClone, ')');
            }
        } else {
            console.group(`%c--> ${func}(`, this.boldStyle, ')');
        }
    }

    /**
     * Trace function out: Log exit from function & decrement log depth with 1
     * @param func The name of the function that exits
     * @param returnValues The values returned from the function
     *
     * Example:
     * ```typescript
     * function getData(userId: string) {
     *   log.tfi('getData', userId);
     *   const data = { id: userId, value: 42 };
     *   log.tfo('getData', data);  // <-- getData [0.5ms] = { id: "123", value: 42 }
     *   return data;
     * }
     * ```
     */
    tfo(func: string, ...returnValues: unknown[]): void {
        if (this.logLevel < 2) return;

        if (!this.functionStack.includes(func)) {
            this.tfw(`Warning: tfo called for '${func}' but no matching tfi found`);
            return;
        }

        // Close functions left open above this one (e.g. early returns without a tfo)
        // so one missing tfo does not skew the indentation of everything after it
        if (this.functionStack[this.functionStack.length - 1] !== func) {
            const orphanedFunctions: string[] = [];
            while (this.functionStack[this.functionStack.length - 1] !== func) {
                const orphan = this.functionStack.pop();
                if (orphan !== undefined) {
                    orphanedFunctions.push(orphan);
                }
                if (this.logTime === true && this.timers.length > 0) {
                    this.timers.pop();
                }
                console.groupEnd();
            }
            this.tfw(
                `Warning: Unexpected tfo call for '${func}'. Auto-closed unclosed functions: ${orphanedFunctions.join(', ')}`,
            );
        }

        // Remove function from stack
        this.functionStack.pop();

        let runTimeString = '';
        if (this.logTime === true && this.timers.length > 0) {
            const startTime = this.timers.pop();
            if (typeof startTime === 'number') {
                const delta = performance.now() - startTime;
                const runTime = this.formatTime(delta);
                runTimeString = `[${runTime}]`;
            }
        }

        if (returnValues != null && Object.keys(returnValues).length !== 0) {
            const tmpArray: unknown[] = [];
            if (typeof returnValues === 'number' || typeof returnValues === 'string') {
                tmpArray.push(returnValues);
            } else {
                let i = 0;
                for (const key in returnValues) {
                    if (Object.prototype.hasOwnProperty.call(returnValues, key)) {
                        const element = returnValues[key];
                        tmpArray.push(element);
                        if (Object.keys(returnValues).length - 1 !== i) {
                            tmpArray.push(',');
                        }
                        ++i;
                    }
                }
            }

            const objectClone = this.snapshot(tmpArray);
            console.groupEnd();

            if (objectClone.length === 0) {
                console.log(`%c<-- ${func} ${runTimeString} =`, this.boldStyle, ...objectClone);
            } else {
                console.log(`%c<-- ${func} ${runTimeString} =`, this.boldStyle, ...objectClone);
            }
        } else {
            console.groupEnd();
            console.log(`%c<-- ${func} ${runTimeString}`, this.boldStyle);
        }
    }

    /**
     * Trace function: Log a string with `+` prefix
     * @param valuesToLog The values to log (same parameters as console.log)
     *
     * Example:
     * ```typescript
     * log.tf('Processing data...');  // + Processing data...
     * log.tf('Status:', { progress: '50%' });  // + Status: { progress: "50%" }
     * ```
     */
    tf(...valuesToLog: unknown[]): void {
        this.logToConsole('tf', valuesToLog);
    }

    /**
     * Trace function clean: Log a string without type formatting and +
     * @param valuesToLog The values to log (same parameters as console.log)
     *
     * Example:
     * ```typescript
     * log.tfc('Clean output');  // Clean output
     * ```
     */
    tfc(...valuesToLog: unknown[]): void {
        this.logToConsole('tfc', valuesToLog);
    }

    /**
     * Trace function warning: Log a warning string with `+` prefix
     * @param valuesToLog The values to log (same parameters as console.log)
     *
     * Example:
     * ```typescript
     * log.tfw('Invalid input');  // + Invalid input (in yellow)
     * ```
     */
    tfw(...valuesToLog: unknown[]): void {
        this.logToConsole('tfw', valuesToLog);
    }

    /**
     * Trace function error: Log an error string with `+` prefix
     * @param valuesToLog The values to log (same parameters as console.log)
     *
     * Example:
     * ```typescript
     * log.tfe('Failed to connect');  // + Failed to connect (in red)
     * ```
     */
    tfe(...valuesToLog: unknown[]): void {
        this.logToConsole('tfe', valuesToLog);
    }

    /**
     * Trace function table: Log a table. Does not output delta time.
     * @param tabularData The data to display in tabular format
     * @param properties Optional array of property names to include in the output
     *
     * Example:
     * ```typescript
     * const users = [
     *   { id: 1, name: 'John' },
     *   { id: 2, name: 'Jane' }
     * ];
     * log.tft(users);  // Displays a table with id and name columns
     * log.tft(users, ['name']);  // Displays a table with only the name column
     * ```
     */
    tft(tabularData: Record<string, unknown> | Array<unknown>, properties?: string[]): void {
        if (this.logLevel < 2) return;
        console.table(tabularData, properties);
    }

    /**
     * Reset all tracing state: closes any console groups left open by
     * unmatched tfi calls and clears function, timer, and async-operation
     * tracking. Use to recover when a trace has gone out of sync.
     */
    reset(): void {
        for (let i = 0; i < this.functionStack.length; i++) {
            console.groupEnd();
        }
        this.functionStack = [];
        this.timers = [];
        this.asyncOps.clear();
        this.completedOps = [];
        this.currentOpStack = [];
    }

    /**
     * Check for any unclosed functions (missing tfo calls)
     * This should be called at points where all functions should be properly closed
     * @returns true if there are unclosed functions
     */
    checkUnclosedFunctions(): boolean {
        if (this.functionStack.length > 0) {
            const unclosed = this.functionStack.join(', ');
            this.tfw(`Warning: Unclosed functions detected: ${unclosed}`);
            return true;
        }
        return false;
    }

    /**
     * Check for async operations that never completed (missing tfoa calls or
     * tfa callbacks that never settled)
     * @returns true if there are unclosed async operations
     */
    checkUnclosedAsyncOps(): boolean {
        const pending: string[] = [];
        for (const op of this.asyncOps.values()) {
            if (op.status === 'pending') {
                pending.push(`${op.func} #${op.id}`);
            }
        }
        if (pending.length > 0) {
            this.tfw(`Warning: Unclosed async operations detected: ${pending.join(', ')}`);
            return true;
        }
        return false;
    }

    /**
     * Trace function async table: print a table of async operations —
     * pending ones first, then recently completed ones. The view into
     * in-flight operations that buffered logging otherwise hides.
     */
    tfat(): void {
        if (this.logLevel < 2) return;
        const rows: Array<Record<string, unknown>> = [];
        for (const op of this.asyncOps.values()) {
            if (op.status !== 'pending') continue;
            rows.push({
                id: op.id,
                name: op.func,
                parent: op.parent ?? '',
                status: 'pending',
                duration: this.formatTime(performance.now() - op.start),
            });
        }
        for (const done of this.completedOps) {
            rows.push({
                id: done.id,
                name: done.func,
                parent: done.parent ?? '',
                status: done.status,
                duration: this.formatTime(done.duration),
            });
        }
        console.table(rows);
    }
}
