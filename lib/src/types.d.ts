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
    /** Set false to suppress the one-line startup banner (only shown when logging is enabled) */
    banner?: boolean;
    /**
     * Ring-buffer capacity: how many of the most recent captured entries to
     * retain for dump() and the onEntry hook. Default 300; 0 disables
     * buffering. Captured entries hold references to the snapshots already
     * made for printing, so buffering what is printed costs ~nothing — memory
     * stays bounded by the ring.
     */
    bufferSize?: number;
    /**
     * Capture into the buffer (and fire onEntry for) everything that WOULD
     * print at level 2, even while the current level suppresses printing — a
     * silent flight recorder. Nothing extra is printed. Default false.
     *
     * Scope limitation: tfa keeps its no-op passthrough below level 2, so
     * tfa-scoped logs are NOT black-boxed. Only the plain paths
     * (tf/tfc/tfw/tfe, tft, tfi/tfo, tfia/tfoa) capture while silent.
     *
     * Cost when enabled: capturing while silent still pays the snapshot
     * (structuredClone) price per call — measured ~1 µs for small objects,
     * ~16 µs for ~100-key objects, the ring push and hook adding only tens of
     * nanoseconds on top. When false (default) the disabled path stays a plain
     * early return with zero extra work.
     */
    blackBox?: boolean;
    /**
     * Called once per captured entry, at capture time, with printed reflecting
     * whether the entry also reached the console (false for black-boxed
     * captures). Never fires again when a tfa buffer is replayed. A throwing
     * hook is swallowed silently and never breaks logging or the app.
     *
     * Sentry breadcrumb recipe:
     * ```typescript
     * onEntry: (e) => Sentry.addBreadcrumb({
     *     category: 'vittra',
     *     message: e.kind === 'log' ? e.values.map(String).join(' ') : e.kind,
     *     level: e.level === 'error' ? 'error' : 'info',
     * })
     * ```
     */
    onEntry?: (entry: VittraLogEntry) => void;
    /**
     * Register global 'error' and 'unhandledrejection' listeners that print
     * the buffered entries — the last frames before a crash — as flat text
     * lines when an uncaught error escapes. Does nothing when the buffer is
     * empty. Default false. Pairs with blackBox for a flight recorder that
     * records silently and reveals its tape only on a crash. SSR-safe:
     * skipped where addEventListener is unavailable.
     */
    dumpOnError?: boolean;
    /**
     * Emit User Timing spans for traced functions and async operations so they
     * surface in the DevTools Performance profiler alongside frames and network
     * activity. Each tfi/tfo pair becomes a `performance.measure` named
     * `vittra: <func>`, and each tfa/tfia/tfoa operation one named
     * `vittra: <func> #<opId>`, spanning entry to exit; the start marks are
     * cleared once consumed. Default false.
     *
     * When off, emit pays a single flag check — the disabled path is untouched.
     * When on, every emitted entry costs one mark or measure call, wrapped in
     * try/catch behind a one-time feature check so engines without the User
     * Timing options form silently skip it.
     *
     * The measures are deliberately left in the User Timing buffer — they are
     * the artifact you inspect — so spans accumulate for the duration of the
     * session. Enable this while profiling, not permanently in production.
     */
    perfMarks?: boolean;
}

/**
 * A captured trace entry: the raw entry data plus the wall-clock time it was
 * captured and whether it also reached the console. This is what the ring
 * buffer stores, what dump() serializes, and what the onEntry hook receives.
 */
export type VittraLogEntry = (
    | {
          kind: 'log';
          level: 'log' | 'clean' | 'warn' | 'error';
          values: unknown[];
          delta?: number;
          withType?: boolean;
      }
    | { kind: 'table'; data: Record<string, unknown> | Array<unknown>; properties?: string[] }
    | { kind: 'funcEntry'; func: string; values: unknown[] }
    | { kind: 'funcExit'; func: string; values: unknown[]; duration?: number }
    | { kind: 'groupEnd' }
    | { kind: 'asyncStart'; func: string; opId: number; args?: unknown[] }
    | { kind: 'asyncEnd'; func: string; opId: number; values: unknown[]; duration?: number }
    | {
          kind: 'asyncComplete';
          func: string;
          opId: number;
          status: 'done' | 'failed';
          values: unknown[];
          badgeParent?: number;
          duration?: number;
          error?: unknown;
      }
    | { kind: 'asyncPending'; func: string; opId: number }
    | { kind: 'opError'; error: unknown }
) & {
    /** Epoch milliseconds (Date.now()) at capture time */
    timestamp: number;
    /** True when the entry was written to the console; false for black-boxed captures */
    printed: boolean;
};

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
 * - dump: export the captured ring buffer as text or JSON
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
     * Reset all tracing state: closes any open console groups, empties the
     * capture ring, and clears function, timer, and async-operation tracking
     */
    reset(): void;

    /**
     * Export the ring buffer's contents, oldest → newest — the recent trace
     * even at log levels that print nothing. Works at any level.
     * @param options.format 'text' (default) one readable line per entry, or
     *   'json' the raw entry array (Errors → {name, message, stack})
     * @param options.download true also downloads the string as a file
     *   (best-effort; the returned string is always the reliable path)
     * @returns The formatted buffer contents
     */
    dump(options?: { format?: 'text' | 'json'; download?: boolean }): string;

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
