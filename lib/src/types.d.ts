/**
 * Type definitions for log levels and context
 */
export type LogLevel = 'info' | 'warning' | 'error' | 'debug';

/**
 * Configuration options for Vittra
 */
export interface VittraOptions {
    /**
     * 0 (default) disables logging, any higher value enables it. When omitted,
     * a level persisted via setLogLevel(level, { persist: true }) is used if present.
     */
    logLevel?: number;
    /** Set true to enable time logging for all functions (default false) */
    logTime?: boolean;
    /** Set true to enable explicit string and number formatting */
    logWithType?: boolean;
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
 *
 * Runtime control:
 * - setLogLevel: change the log level on demand (optionally persisted)
 * - reset: clear all tracing state
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
