/// <reference lib="dom" />

/**
 * Type definitions for log levels and context
 */
export type LogLevel = 'info' | 'warning' | 'error' | 'debug';
export type LogContext = Record<string, unknown>;

/**
 * Configuration options for AvLog
 */
export interface AvLogOptions {
    /** 0 (default) to disable, 1 to enable logging */
    logLevel?: number;
    /** Set true to enable time logging for all functions (default false) */
    logTime?: boolean;
    /** Set true to enable explicit string and number formatting */
    logWithType?: boolean;
}

/**
 * AvLog - A simple context-in-depth logging library.
 * All methods use a 't' prefix for "trace", followed by their specific function:
 * - tfi: trace function in (entry)
 * - tfo: trace function out (exit)
 * - tfia: trace function in async (async entry)
 * - tfoa: trace function out async (async exit)
 * - tf:  trace format (basic logging)
 * - tfc: trace format clean (no prefix)
 * - tfw: trace format warning
 * - tfe: trace format error
 * - tft: trace format table
 *
 * Example usage:
 * ```typescript
 * const log = new AvLog({ logLevel: 1, logTime: true });
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
export class AvLog {
    private logLevel: number;
    private logTime: boolean;
    private logWithType: boolean;
    private boldStyle: string;
    private timers: number[];
    private functionStack: string[] = []; // Track function entries
    private asyncOps: Map<string, { start: number; indent: number; id: number }> = new Map();
    private nextAsyncId: number = 1;
    private currentIndent: number = 0;

    constructor(options: AvLogOptions = {}) {
        // Check URL parameter for log level override
        let logLevelParam = null;
        try {
            if (
                typeof globalThis !== 'undefined' &&
                globalThis.location?.search &&
                typeof globalThis.URLSearchParams === 'function'
            ) {
                const urlParams = new globalThis.URLSearchParams(globalThis.location.search);
                logLevelParam = urlParams.get('avLogLevel');
            }
        } catch {
            // Silently handle any errors if URL parsing fails
        }

        this.logLevel = logLevelParam !== null ? Number(logLevelParam) : options.logLevel || 0;
        this.logTime = options.logTime || false;
        this.logWithType = options.logWithType || false;
        this.boldStyle = 'font-weight: bold';
        this.timers = [];
    }

    /**
     * Formats a time duration into a human-readable string
     * @param delta Time in milliseconds
     * @returns Formatted time string (e.g., "1.2 ms", "2.5 s", "01:30.0")
     */
    private formatTime(delta: number): string {
        // ms
        if (delta < 1000) {
            return `${delta.toFixed(1)} ms`;
        }
        // seconds
        if (delta < 60000) {
            const seconds = Math.floor(delta / 1000);
            const millis = delta % 1000;
            return `${seconds}.${millis.toFixed(0)} s`;
        }
        // minutes:seconds.millis
        const minutes = Math.floor(delta / 60000);
        const seconds = Math.floor((delta % 60000) / 1000);
        const millis = delta % 1000;
        const minutesStr = minutes < 10 ? `0${minutes}` : minutes.toString();
        const secondsStr = seconds < 10 ? `0${seconds}` : seconds.toString();
        return `${minutesStr}:${secondsStr}.${millis.toFixed(0)}`;
    }

    /**
     * Internal method to handle different types of console output
     */
    private logToConsole(mode: 'tf' | 'tfc' | 'tfw' | 'tfe', valuesToLog: unknown[]): void {
        if (this.logLevel === 0) return;

        const objectClone = JSON.parse(JSON.stringify(valuesToLog));
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
        if (this.logLevel === 0) return this.nextAsyncId++;

        const indent = this.currentIndent;
        this.currentIndent += 2;

        const startTime = this.logTime ? performance.now() : 0;
        const opId = this.nextAsyncId++;
        const key = `${func}:${opId}`;

        this.asyncOps.set(key, { start: startTime, indent, id: opId });

        const prefix = ' '.repeat(indent);
        const tmpArray: unknown[] = [];
        if (args != null && args.length > 0) {
            if (typeof args === 'number' || typeof args === 'string') {
                tmpArray.push(args);
            } else {
                let i = 0;
                for (const key in args) {
                    if (Object.prototype.hasOwnProperty.call(args, key)) {
                        const element = args[key];
                        tmpArray.push(element);
                        if (Object.keys(args).length - 1 !== i) {
                            tmpArray.push(',');
                        }
                        ++i;
                    }
                }
            }
            const objectClone = JSON.parse(JSON.stringify(tmpArray));
            console.log(`%c${prefix}⟳ ${func}(`, this.boldStyle, ...objectClone, ')');
        } else {
            console.log(`%c${prefix}⟳ ${func}()`, this.boldStyle);
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
        if (this.logLevel === 0) return;

        const key = `${func}:${opId}`;
        const op = this.asyncOps.get(key);
        if (!op) {
            this.tfw(`Warning: tfoa called for '${func}' (ID: ${opId}) but no matching tfia found`);
            return;
        }

        let runTimeString = '';
        if (this.logTime) {
            const duration = performance.now() - op.start;
            runTimeString = ` [${this.formatTime(duration)}]`;
        }

        const prefix = ' '.repeat(op.indent);
        const tmpArray: unknown[] = [];
        if (returnValues != null && returnValues.length > 0) {
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
            const objectClone = JSON.parse(JSON.stringify(tmpArray));
            console.log(`%c${prefix}✓ ${func}()${runTimeString} =`, this.boldStyle, ...objectClone);
        } else {
            console.log(`%c${prefix}✓ ${func}()${runTimeString}`, this.boldStyle);
        }

        this.asyncOps.delete(key);
        this.currentIndent = op.indent;
    }

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
        if (this.logLevel === 0) return;

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
            const objectClone = JSON.parse(JSON.stringify(tmpArray));

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
        if (this.logLevel === 0) return;

        // Check if this is the expected function
        const lastFunc = this.functionStack[this.functionStack.length - 1];
        if (lastFunc !== func) {
            this.tfw(
                `Warning: Unexpected tfo call for '${func}'. Expected '${lastFunc || 'no function'}'`,
            );
            return;
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

            const objectClone = JSON.parse(JSON.stringify(tmpArray));
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
     * Trace format: Log a string with `+` prefix
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
     * Trace format clean: Log a string without type formatting and +
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
     * Trace format warning: Log a warning string with `+` prefix
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
     * Trace format error: Log an error string with `+` prefix
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
     * Trace format table: Log a table. Does not output delta time.
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
        if (this.logLevel === 0) return;
        console.table(tabularData, properties);
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
}
