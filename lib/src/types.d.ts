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
 * operation completes.
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
 * - tfia: trace function in async (entry for async operations)
 * - tfoa: trace function out async (exit for async operations)
 * - tfa: trace function async (wraps a whole async operation)
 * - tfat: trace function async table (pending + recent operations)
 *
 * Runtime control:
 * - setLogLevel: change the log level on demand (optionally persisted)
 * - reset: clear all tracing state
 *
 * Log levels: 0 = off, 1 = warnings and errors, 2 = full trace, 3+ reserved.
 */
export declare class Vittra {
    constructor(options?: VittraOptions);

    /**
     * Change the log level at runtime
     * @param level The new log level (0 disables logging)
     * @param options Set persist to true to remember the level in localStorage
     *                across page loads; persisting 0 clears the remembered level
     */
    setLogLevel(level: number, options?: { persist?: boolean }): void;

    /**
     * Reset all tracing state: closes any open console groups and clears
     * function, timer, and async-operation tracking
     */
    reset(): void;

    /**
     * Track Function In Async - logs the start of an async function call
     * @param func - The name of the function being called
     * @param args - Optional arguments passed to the function
     * @returns A unique operation ID that must be passed to tfoa
     */
    tfia(func: string, ...args: unknown[]): number;

    /**
     * Track Function Out Async - logs the completion of an async function call
     * @param func - The name of the function being completed
     * @param opId - The operation ID returned from the corresponding tfia call
     * @param returnValues - Optional return values from the function
     */
    tfoa(func: string, opId: number, ...returnValues: unknown[]): void;

    /**
     * Trace function async - wraps a whole async operation: logs entry
     * immediately, buffers scoped-logger output, replays it as one grouped
     * block on completion. Accepts a callback or a bare promise.
     * @param func The name of the operation
     * @param fnOrPromise Callback receiving a scoped logger, or a promise to time
     * @returns The callback's return value (or the promise's resolution)
     */
    tfa<T>(
        func: string,
        fnOrPromise: ((t: VittraOpLogger) => T | Promise<T>) | Promise<T>,
    ): Promise<T>;

    /**
     * Trace function async table: print a table of pending and recently
     * completed async operations
     */
    tfat(): void;

    /**
     * Check for async operations that never completed
     * @returns true if there are unclosed async operations
     */
    checkUnclosedAsyncOps(): boolean;

    /**
     * Trace function in: Log function call & increment log depth
     * @param func The name of the function that is called
     * @param callerArgs Arguments passed to the function
     */
    tfi(func: string, ...callerArgs: unknown[]): void;

    /**
     * Trace function out: Log exit from function & decrement log depth
     * @param func The name of the function that exits
     * @param returnValues The values returned from the function
     */
    tfo(func: string, ...returnValues: unknown[]): void;

    /**
     * Trace function: Log a string with `+` prefix
     * @param valuesToLog The values to log
     */
    tf(...valuesToLog: unknown[]): void;

    /**
     * Trace function clean: Log a string without type formatting and +
     * @param valuesToLog The values to log
     */
    tfc(...valuesToLog: unknown[]): void;

    /**
     * Trace function warning: Log a warning string with `+` prefix
     * @param valuesToLog The values to log
     */
    tfw(...valuesToLog: unknown[]): void;

    /**
     * Trace function error: Log an error string with `+` prefix
     * @param valuesToLog The values to log
     */
    tfe(...valuesToLog: unknown[]): void;

    /**
     * Trace function table: Log a table
     * @param tabularData The data to display in tabular format
     * @param properties Optional array of property names to include
     */
    tft(tabularData: Record<string, unknown> | Array<unknown>, properties?: string[]): void;

    /**
     * Check for any unclosed functions (missing tfo calls)
     * @returns true if there are unclosed functions
     */
    checkUnclosedFunctions(): boolean;
}
