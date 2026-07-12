import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { Vittra, VittraOptions, _resetVittraModuleState } from '../src/vittra';
import type { VittraLogEntry } from '../src/vittra';

describe('Vittra', () => {
    let log: Vittra;
    let performanceNowSpy: MockInstance;
    let consoleLogSpy: MockInstance;
    let consoleWarnSpy: MockInstance;
    let consoleErrorSpy: MockInstance;
    let consoleTableSpy: MockInstance;
    let consoleGroupSpy: MockInstance;
    let consoleGroupEndSpy: MockInstance;

    function setupSpies(defaultPerformanceNow = 1000) {
        performanceNowSpy = vi.fn(() => defaultPerformanceNow);
        performance.now = performanceNowSpy;
        consoleLogSpy = vi.fn();
        console.log = consoleLogSpy;
        consoleWarnSpy = vi.fn();
        console.warn = consoleWarnSpy;
        consoleErrorSpy = vi.fn();
        console.error = consoleErrorSpy;
        consoleTableSpy = vi.fn();
        console.table = consoleTableSpy;
        consoleGroupSpy = vi.fn();
        console.group = consoleGroupSpy;
        consoleGroupEndSpy = vi.fn();
        console.groupEnd = consoleGroupEndSpy;
    }

    beforeEach(() => {
        // Every test starts from pristine module state: shared op-id counter,
        // banner flag, runtime spec, and instance registry all reset.
        _resetVittraModuleState();
        setupSpies();
        vi.clearAllMocks();
        log = new Vittra({ banner: false, logLevel: 2, logTime: true });
    });

    describe('constructor', () => {
        it('should create instance with default options', () => {
            log = new Vittra();
            expect(log).toBeDefined();
        });

        it('should create instance with custom options', () => {
            const options: VittraOptions = {
                logLevel: 1,
                logTime: true,
                logWithType: true,
            };
            log = new Vittra(options);
            expect(log).toBeDefined();
        });
    });

    describe('logging methods with logLevel 0', () => {
        beforeEach(() => {
            log = new Vittra({ logLevel: 0 });
        });

        it('should not log anything when logLevel is 0', () => {
            log.tf('test');
            log.tfc('test');
            log.tfw('test');
            log.tfe('test');
            log.tft({ test: 'data' });
            log.tfi('testFunc', 'arg1');
            log.tfo('testFunc', 'result');

            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleTableSpy).not.toHaveBeenCalled();
            expect(consoleGroupSpy).not.toHaveBeenCalled();
            expect(consoleGroupEndSpy).not.toHaveBeenCalled();
        });
    });

    describe('logging methods with logLevel 2', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2 });
        });

        it('should log basic message with tf', () => {
            log.tf('test message');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'test message');
        });

        it('should log clean message with tfc', () => {
            log.tfc('test message');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c', 'font-weight: bold', 'test message');
        });

        it('should log warning with tfw', () => {
            log.tfw('warning message');
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'warning message',
            );
        });

        it('should log error with tfe', () => {
            log.tfe('error message');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'error message',
            );
        });

        it('should log table with tft', () => {
            const data = { id: 1, name: 'test' };
            log.tft(data);
            expect(consoleTableSpy).toHaveBeenCalledWith(data, undefined);
        });

        it('should log table with specific columns', () => {
            const data = { id: 1, name: 'test' };
            log.tft(data, ['name']);
            expect(consoleTableSpy).toHaveBeenCalledWith(data, ['name']);
        });
    });

    describe('function tracing', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2, logTime: true });
            performanceNowSpy.mockReturnValueOnce(1000);
        });

        it('should log function entry with tfi', () => {
            log.tfi('testFunction', 'arg1', 'arg2');
            expect(consoleGroupSpy).toHaveBeenCalledWith(
                '%c--> testFunction(',
                'font-weight: bold',
                'arg1',
                ',',
                'arg2',
                ')',
            );
        });

        it('should log function exit with tfo', () => {
            log.tfi('testFunction');
            performanceNowSpy.mockReturnValue(2000); // 1s difference
            log.tfo('testFunction', { result: 'success' });

            expect(consoleGroupEndSpy).toHaveBeenCalled();
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c<-- testFunction [1.000 s] =',
                'font-weight: bold',
                { result: 'success' },
            );
        });

        it('should handle function tracing without arguments', () => {
            log.tfi('testFunction');
            performanceNowSpy.mockReturnValue(2000); // 1s difference
            log.tfo('testFunction');

            expect(consoleGroupSpy).toHaveBeenCalledWith(
                '%c--> testFunction(',
                'font-weight: bold',
                ')',
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c<-- testFunction [1.000 s]',
                'font-weight: bold',
            );
        });
    });

    describe('function tracking', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2 });
            vi.clearAllMocks();
            setupSpies();
        });

        it('should track functions properly with matching tfi/tfo calls', () => {
            log.tfi('outer');
            log.tfi('inner');
            log.tfo('inner');
            log.tfo('outer');

            expect(log.checkUnclosedFunctions()).toBe(false);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should warn and auto-close unclosed functions on mismatched tfo call', () => {
            log.tfi('outer');
            log.tfi('inner');
            log.tfo('outer'); // inner was never closed

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                "Warning: Unexpected tfo call for 'outer'. Auto-closed unclosed functions: inner",
            );
            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(2);
            expect(log.checkUnclosedFunctions()).toBe(false);
        });

        it('should warn and leave state untouched on tfo call with no matching tfi', () => {
            log.tfi('outer');
            log.tfo('unknown');

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                "Warning: tfo called for 'unknown' but no matching tfi found",
            );
            expect(consoleGroupEndSpy).not.toHaveBeenCalled();
            expect(log.checkUnclosedFunctions()).toBe(true);
        });

        it('should detect unclosed functions', () => {
            log.tfi('outer');
            log.tfi('inner');
            log.tfo('inner');
            // Missing tfo for outer

            expect(log.checkUnclosedFunctions()).toBe(true);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'Warning: Unclosed functions detected: outer',
            );
        });
    });

    describe('async function tracking', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2, logTime: true });
            performanceNowSpy.mockReturnValue(1000);
        });

        it('should track async operations with ids and timing', () => {
            const opId = log.tfia('asyncOp', 'arg1');
            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('asyncOp', opId, { result: 'success' });

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c⟳ asyncOp #1 (',
                'font-weight: bold; color: #e91e63',
                'arg1',
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c✓ asyncOp #1 [1.000 s] =',
                'font-weight: bold; color: #e91e63',
                { result: 'success' },
            );
        });

        it('should log overlapping operations flat with distinct ids', () => {
            const outerOpId = log.tfia('outerAsync', { param: 'outer' });
            const innerOpId = log.tfia('innerAsync', { param: 'inner' });

            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('innerAsync', innerOpId, { inner: 'result' });
            log.tfoa('outerAsync', outerOpId, { outer: 'result' });

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c⟳ outerAsync #1 (',
                'font-weight: bold; color: #e91e63',
                { param: 'outer' },
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c⟳ innerAsync #2 (',
                'font-weight: bold; color: #4caf50',
                { param: 'inner' },
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                3,
                '%c✓ innerAsync #2 [1.000 s] =',
                'font-weight: bold; color: #4caf50',
                { inner: 'result' },
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                4,
                '%c✓ outerAsync #1 [1.000 s] =',
                'font-weight: bold; color: #e91e63',
                { outer: 'result' },
            );
        });

        it('should handle multiple concurrent calls to the same async function', () => {
            const op1Id = log.tfia('asyncOp', { id: 1 });
            const op2Id = log.tfia('asyncOp', { id: 2 });

            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('asyncOp', op1Id, { result: 1 });
            log.tfoa('asyncOp', op2Id, { result: 2 });

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c⟳ asyncOp #1 (',
                'font-weight: bold; color: #e91e63',
                { id: 1 },
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c⟳ asyncOp #2 (',
                'font-weight: bold; color: #4caf50',
                { id: 2 },
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                3,
                '%c✓ asyncOp #1 [1.000 s] =',
                'font-weight: bold; color: #e91e63',
                { result: 1 },
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                4,
                '%c✓ asyncOp #2 [1.000 s] =',
                'font-weight: bold; color: #4caf50',
                { result: 2 },
            );
        });

        it('should handle async operations without arguments or return values', () => {
            const opId = log.tfia('asyncOp');
            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('asyncOp', opId);

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c⟳ asyncOp #1 ()',
                'font-weight: bold; color: #e91e63',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c✓ asyncOp #1 [1.000 s]',
                'font-weight: bold; color: #e91e63',
            );
        });

        it('should warn on mismatched async operations', () => {
            const opId = log.tfia('asyncOp1');
            log.tfoa('asyncOp2', opId);

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c⟳ asyncOp1 #1 ()',
                'font-weight: bold; color: #e91e63',
            );

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                `Warning: tfoa called for 'asyncOp2' (ID: ${opId}) but no matching tfia found`,
            );
        });
    });

    describe('shared async id counter', () => {
        it('should number ops sequentially across separate instances', () => {
            const api = new Vittra({ name: 'api', banner: false, logLevel: 2 });
            const ui = new Vittra({ name: 'ui', banner: false, logLevel: 2 });

            // The counter lives at module scope, so ids are unique console-wide:
            // ui's first op continues api's sequence rather than restarting at 1.
            expect(api.tfia('apiOp')).toBe(1);
            expect(ui.tfia('uiOp')).toBe(2);
        });
    });

    describe('time formatting', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2, logTime: true });
            setupSpies();
        });

        it('should format milliseconds correctly', () => {
            performanceNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1500);
            log.tfi('test');
            log.tfo('test');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c<-- test [500.0 ms]',
                'font-weight: bold',
            );
        });

        it('should format seconds correctly', () => {
            performanceNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2500);
            log.tfi('test');
            log.tfo('test');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c<-- test [1.500 s]', 'font-weight: bold');
        });

        it('should format minutes correctly', () => {
            performanceNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(91000);
            log.tfi('test');
            log.tfo('test');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c<-- test [01:30.000]',
                'font-weight: bold',
            );
        });

        it('should zero-pad milliseconds in the seconds format', () => {
            performanceNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(3005);
            log.tfi('test');
            log.tfo('test');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c<-- test [2.005 s]', 'font-weight: bold');
        });

        it('should zero-pad milliseconds in the minutes format', () => {
            performanceNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(66005);
            log.tfi('test');
            log.tfo('test');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c<-- test [01:05.005]',
                'font-weight: bold',
            );
        });
    });

    describe('value snapshotting', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2 });
        });

        it('should not throw when logging a circular object', () => {
            const circular: Record<string, unknown> = { name: 'a' };
            circular.self = circular;

            expect(() => log.tf('state:', circular)).not.toThrow();
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should preserve Error message and stack', () => {
            const error = new Error('boom');
            log.tfe(error);

            expect(consoleErrorSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', error);
        });

        it('should not throw when logging a function value', () => {
            const fn = () => 42;

            expect(() => log.tf(fn)).not.toThrow();
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', fn);
        });

        it('should not throw when structuredClone is unavailable', () => {
            vi.stubGlobal('structuredClone', undefined);
            try {
                const circular: Record<string, unknown> = { name: 'a' };
                circular.self = circular;

                expect(() => log.tf(circular)).not.toThrow();
                expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', circular);
            } finally {
                vi.unstubAllGlobals();
            }
        });
    });

    describe('setLogLevel and persistence', () => {
        // jsdom's localStorage lacks the Storage methods, so stub a real one
        function createStorageMock(): Storage {
            const store = new Map<string, string>();
            return {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, String(value));
                },
                removeItem: (key: string) => {
                    store.delete(key);
                },
                clear: () => {
                    store.clear();
                },
                key: (index: number) => Array.from(store.keys())[index] ?? null,
                get length() {
                    return store.size;
                },
            };
        }

        beforeEach(() => {
            vi.stubGlobal('localStorage', createStorageMock());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should change the log level at runtime', () => {
            log = new Vittra();
            log.tf('hidden');
            expect(consoleLogSpy).not.toHaveBeenCalled();

            log.setLogLevel(2);
            log.tf('visible');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'visible');

            log.setLogLevel(0);
            consoleLogSpy.mockClear();
            log.tf('hidden again');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should not persist by default', () => {
            log = new Vittra();
            log.setLogLevel(2);
            expect(localStorage.getItem('vittraLogLevel')).toBeNull();
        });

        it('should persist with persist: true and apply to a new instance without an explicit level', () => {
            log = new Vittra();
            log.setLogLevel(2, { persist: true });
            expect(localStorage.getItem('vittraLogLevel')).toBe('2');

            const nextLoad = new Vittra();
            nextLoad.tf('remembered');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'remembered');
        });

        it('should clear the persisted level when persisting 0', () => {
            log = new Vittra();
            log.setLogLevel(2, { persist: true });
            log.setLogLevel(0, { persist: true });
            expect(localStorage.getItem('vittraLogLevel')).toBeNull();
        });

        it('should keep a persisted wildcard when an unnamed instance persists 0, yet resolve 0 next load', () => {
            localStorage.setItem('vittraLogLevel', '*:1');
            const first = new Vittra({ banner: false });
            first.setLogLevel(0, { persist: true });

            // The wildcard survives so other namespaces stay enabled...
            expect(localStorage.getItem('vittraLogLevel')).toContain('*:1');

            // ...but the explicit global 0 beats it, so the next unnamed load is off
            consoleLogSpy.mockClear();
            const next = new Vittra({ banner: false });
            next.tf('hidden');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should let an explicit constructor level beat the persisted one', () => {
            log = new Vittra();
            log.setLogLevel(2, { persist: true });

            const explicitOff = new Vittra({ logLevel: 0 });
            explicitOff.tf('hidden');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should leave the persisted level untouched on a non-persisting set', () => {
            log = new Vittra();
            log.setLogLevel(2, { persist: true });
            log.setLogLevel(3);
            expect(localStorage.getItem('vittraLogLevel')).toBe('2');
        });
    });

    describe('URL parameter', () => {
        afterEach(() => {
            window.history.replaceState(null, '', '/');
        });

        it('should let the URL parameter override an explicit constructor level', () => {
            window.history.replaceState(null, '', '/?vittraLogLevel=2');
            log = new Vittra({ logLevel: 0 });
            log.tf('from url');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'from url');
        });

        it('should ignore a non-numeric URL parameter', () => {
            window.history.replaceState(null, '', '/?vittraLogLevel=abc');
            log = new Vittra();
            log.tf('hidden');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe('reset', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2 });
        });

        it('should close open groups and clear all tracing state', () => {
            log.tfi('outer');
            log.tfi('inner');

            log.reset();

            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(2);
            expect(log.checkUnclosedFunctions()).toBe(false);
        });

        it('should clear pending async operations', () => {
            log.tfia('first');
            log.reset();

            expect(log.checkUnclosedAsyncOps()).toBe(false);
            log.tfia('second');
            expect(consoleLogSpy).toHaveBeenLastCalledWith(
                '%c⟳ second #2 ()',
                'font-weight: bold; color: #4caf50',
            );
        });
    });

    describe('logging with logLevel 1', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 1 });
        });

        it('should show warnings and errors only', () => {
            log.tfw('warned');
            log.tfe('failed');

            expect(consoleWarnSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'warned');
            expect(consoleErrorSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'failed');
        });

        it('should suppress logs, tables, and traces', () => {
            log.tf('hidden');
            log.tfc('hidden');
            log.tft({ a: 1 });
            log.tfi('func');
            log.tfo('func');
            log.tfia('asyncFunc');

            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleTableSpy).not.toHaveBeenCalled();
            expect(consoleGroupSpy).not.toHaveBeenCalled();
        });

        it('should run a tfa callback without logging and return its value', async () => {
            const result = await log.tfa('op', async (t) => {
                t.tf('hidden');
                return 42;
            });

            expect(result).toBe(42);
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleGroupSpy).not.toHaveBeenCalled();
        });
    });

    describe('tfa async wrapper', () => {
        const color1 = 'font-weight: bold; color: #e91e63';
        const color2 = 'font-weight: bold; color: #4caf50';

        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2, logTime: true });
            performanceNowSpy.mockReturnValue(1000);
        });

        it('should log entry live and replay buffered logs on completion', async () => {
            const result = await log.tfa('fetchUser', async (t) => {
                t.tf('got response');
                return { ok: true };
            });

            expect(result).toEqual({ ok: true });
            expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '%c⟳ fetchUser #1', color1);
            expect(consoleGroupSpy).toHaveBeenCalledWith('%c✓ fetchUser #1 [0.0 ms] =', color1, {
                ok: true,
            });
            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c+ ',
                'font-weight: bold',
                'got response',
                '  [Δ 0.0 ms]',
            );
            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(1);
        });

        it('should replay buffered logs without a time suffix when logTime is off', async () => {
            log = new Vittra({ banner: false, logLevel: 2 });

            await log.tfa('fetchUser', async (t) => {
                t.tf('got response');
            });

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c+ ',
                'font-weight: bold',
                'got response',
            );
        });

        it('should log a failure block and rethrow', async () => {
            const error = new Error('boom');

            await expect(
                log.tfa('fetchUser', async () => {
                    throw error;
                }),
            ).rejects.toThrow('boom');

            expect(consoleGroupSpy).toHaveBeenCalledWith('%c✗ fetchUser #1 [0.0 ms]', color1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(error);
        });

        it('should accept a bare promise', async () => {
            const result = await log.tfa('GET /user', Promise.resolve(42));

            expect(result).toBe(42);
            expect(consoleLogSpy).toHaveBeenCalledWith('%c⟳ GET /user #1', color1);
            expect(consoleGroupSpy).toHaveBeenCalledWith('%c✓ GET /user #1 [0.0 ms] =', color1, 42);
        });

        it('should inline a nested operation that completed before its parent', async () => {
            await log.tfa('parent', async (t) => {
                await t.tfa('child', async (t2) => {
                    t2.tf('inner');
                });
                t.tf('after child');
            });

            expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '%c⟳ parent #1', color1);
            expect(consoleGroupSpy).toHaveBeenNthCalledWith(1, '%c✓ parent #1 [0.0 ms]', color1);
            expect(consoleGroupSpy).toHaveBeenNthCalledWith(2, '%c✓ child #2 [0.0 ms]', color2);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c+ ',
                'font-weight: bold',
                'inner',
                '  [Δ 0.0 ms]',
            );
            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                3,
                '%c+ ',
                'font-weight: bold',
                'after child',
                '  [Δ 0.0 ms]',
            );
            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(2);
        });

        it('should print a pending marker and a standalone block for a child that outlives its parent', async () => {
            let releaseChild!: () => void;
            const gate = new Promise<void>((resolve) => {
                releaseChild = resolve;
            });
            let childPromise!: Promise<void>;

            await log.tfa('parent', async (t) => {
                childPromise = t.tfa('child', () => gate);
            });

            expect(consoleGroupSpy).toHaveBeenCalledWith('%c✓ parent #1 [0.0 ms]', color1);
            expect(consoleLogSpy).toHaveBeenCalledWith('%c⟳ child #2 (pending)', color2);

            releaseChild();
            await childPromise;

            expect(consoleGroupSpy).toHaveBeenCalledWith('%c✓ child #2 ←#1 [0.0 ms]', color2);
        });

        it('should keep global log calls live during an operation', async () => {
            await log.tfa('op', async () => {
                log.tf('live line');
            });

            expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '%c⟳ op #1', color1);
            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c+ ',
                'font-weight: bold',
                'live line',
            );
        });
    });

    describe('async operation table and checks', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2, logTime: true });
            performanceNowSpy.mockReturnValue(1000);
        });

        it('should list pending and completed operations with tfat', async () => {
            log.tfia('pendingOp');
            await log.tfa('doneOp', Promise.resolve(1));
            log.tfat();

            expect(consoleTableSpy).toHaveBeenCalledWith([
                expect.objectContaining({ id: 1, name: 'pendingOp', status: 'pending' }),
                expect.objectContaining({ id: 2, name: 'doneOp', status: 'done' }),
            ]);
        });

        it('should detect unclosed async operations', () => {
            log.tfia('lost');

            expect(log.checkUnclosedAsyncOps()).toBe(true);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'Warning: Unclosed async operations detected: lost #1',
            );
        });

        it('should report no unclosed ops after completion', () => {
            const opId = log.tfia('op');
            log.tfoa('op', opId);

            expect(log.checkUnclosedAsyncOps()).toBe(false);
        });
    });

    describe('startup banner', () => {
        it('should print a one-line banner when logging is enabled', () => {
            log = new Vittra({ logLevel: 2 });

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            const [format, badgeStyle] = consoleLogSpy.mock.calls[0];
            expect(format).toContain('🪽 vittra');
            expect(format).toContain('level 2');
            expect(format).toContain('via option');
            expect(badgeStyle).toContain('linear-gradient');
        });

        it('should not print a banner when logging is disabled', () => {
            log = new Vittra();

            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should not print a banner when banner is false', () => {
            log = new Vittra({ banner: false, logLevel: 2 });

            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should print the banner only once across several eligible instances', () => {
            new Vittra({ logLevel: 2 });
            new Vittra({ logLevel: 2 });
            new Vittra({ logLevel: 1 });

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        });

        it('should not let a banner: false instance consume the once-per-page flag', () => {
            new Vittra({ banner: false, logLevel: 2 });
            expect(consoleLogSpy).not.toHaveBeenCalled();

            // The flag was never claimed, so the next eligible instance prints
            new Vittra({ logLevel: 2 });
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('logWithType', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2, logWithType: true });
        });

        it('should space-separate %o specifiers for multiple values', () => {
            log.tf('a', 'b');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ %o %o', 'font-weight: bold', 'a', 'b');
        });
    });

    describe('orphaned manual op eviction', () => {
        beforeEach(() => {
            log = new Vittra({ banner: false, logLevel: 2 });
        });

        it('should evict the oldest pending manual op past the limit with a warning', () => {
            const firstOpId = log.tfia('firstOp');
            for (let i = 0; i < 99; i++) {
                log.tfia('filler');
            }
            consoleWarnSpy.mockClear();
            log.tfia('trigger');

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                `Warning: evicting orphaned async operation firstOp #${firstOpId} after 100 pending manual operations without a matching tfoa`,
            );
        });

        it('should warn about no matching tfia when tfoa arrives for an evicted op', () => {
            const firstOpId = log.tfia('firstOp');
            for (let i = 0; i < 100; i++) {
                log.tfia('filler');
            }
            consoleWarnSpy.mockClear();
            log.tfoa('firstOp', firstOpId);

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                `Warning: tfoa called for 'firstOp' (ID: ${firstOpId}) but no matching tfia found`,
            );
        });

        it('should never evict a managed tfa operation', async () => {
            log = new Vittra({ banner: false, logLevel: 2, logTime: true });
            performanceNowSpy.mockReturnValue(1000);

            let releaseOp!: () => void;
            const gate = new Promise<void>((resolve) => {
                releaseOp = resolve;
            });
            const opPromise = log.tfa('managedOp', async (t) => {
                t.tf('inside op');
                await gate;
            });

            for (let i = 0; i < 150; i++) {
                log.tfia('flood');
            }

            releaseOp();
            await opPromise;

            expect(consoleGroupSpy).toHaveBeenCalledWith(
                '%c✓ managedOp #1 [0.0 ms]',
                'font-weight: bold; color: #e91e63',
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'inside op',
                '  [Δ 0.0 ms]',
            );
        });
    });

    describe('ring buffer and dump', () => {
        it('should retain only the most recent entries and dump them in order', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 3 });
            log.tf('one');
            log.tf('two');
            log.tf('three');
            log.tf('four');
            log.tf('five');

            const dump = log.dump();
            expect(dump).not.toContain('one');
            expect(dump).not.toContain('two');
            expect(dump).toContain('three');
            expect(dump).toContain('four');
            expect(dump).toContain('five');
            expect(dump.indexOf('three')).toBeLessThan(dump.indexOf('four'));
            expect(dump.indexOf('four')).toBeLessThan(dump.indexOf('five'));
        });

        it('dump text mirrors console markers and orders entries by capture time', async () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 50 });
            log.tf('alpha');
            log.tfi('fn', 1);
            log.tfo('fn', 2);
            await log.tfa('op', async (t) => {
                t.tf('inside-op');
            });
            log.tf('omega');

            const dump = log.dump();
            expect(dump).toContain('--> fn(1)');
            expect(dump).toContain('<-- fn = 2');
            expect(dump).toContain('⟳ op');
            expect(dump).toContain('✓ op');

            const order = ['alpha', '--> fn', '<-- fn', '⟳ op', 'inside-op', '✓ op', 'omega'];
            const positions = order.map((token) => dump.indexOf(token));
            for (const position of positions) {
                expect(position).toBeGreaterThanOrEqual(0);
            }
            for (let i = 1; i < positions.length; i++) {
                expect(positions[i]).toBeGreaterThan(positions[i - 1]);
            }

            // The tfa buffered log sits at its CAPTURE position (before the ✓
            // replay in the buffer), whereas console replay prints it afterward.
            expect(dump.indexOf('inside-op')).toBeLessThan(dump.indexOf('✓ op'));
        });

        it('dump text carries the error of a failed operation', async () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 10 });

            await expect(
                log.tfa('op', async () => {
                    throw new Error('boom');
                }),
            ).rejects.toThrow('boom');

            expect(log.dump()).toContain('✗ op #1 — Error: boom');
        });

        it('should serialize as JSON with Error values surviving as objects', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 10 });
            log.tfe(new Error('boom'));

            const json = log.dump({ format: 'json' });
            const parsed = JSON.parse(json) as VittraLogEntry[];
            expect(Array.isArray(parsed)).toBe(true);

            const logEntry = parsed.find((entry) => entry.kind === 'log');
            expect(logEntry).toBeDefined();
            const errorValue = (logEntry as { values: Array<{ message?: string }> }).values[0];
            expect(errorValue.message).toBe('boom');
        });

        it('should store nothing and dump empty when bufferSize is 0', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 0 });
            log.tf('nothing');
            log.tfi('fn');
            log.tfo('fn');

            expect(log.dump()).toBe('');
            // Printing is unaffected by a disabled buffer
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should clear the buffer on reset', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 10 });
            log.tf('a');
            log.tf('b');
            expect(log.dump()).not.toBe('');

            log.reset();
            expect(log.dump()).toBe('');
        });
    });

    describe('blackBox', () => {
        it('should capture at level 0 while printing nothing', () => {
            log = new Vittra({ banner: false, logLevel: 0, blackBox: true });
            log.tf('secret');
            log.tfi('fn', 1);
            log.tfo('fn', 2);
            log.tft({ a: 1 });

            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleGroupSpy).not.toHaveBeenCalled();
            expect(consoleGroupEndSpy).not.toHaveBeenCalled();
            expect(consoleTableSpy).not.toHaveBeenCalled();

            const dump = log.dump();
            expect(dump).toContain('secret');
            expect(dump).toContain('--> fn(1)');
            expect(dump).toContain('<-- fn = 2');
        });

        it('should capture nothing at level 0 without blackBox', () => {
            log = new Vittra({ banner: false, logLevel: 0 });
            log.tf('x');
            log.tfi('fn');
            log.tfo('fn');

            expect(log.dump()).toBe('');
        });
    });

    describe('blackBox tfa operations', () => {
        it('should capture a silent tfa operation and its scoped logs while printing nothing', async () => {
            const captured: VittraLogEntry[] = [];
            log = new Vittra({
                banner: false,
                logLevel: 0,
                blackBox: true,
                bufferSize: 50,
                onEntry: (entry) => captured.push(entry),
            });

            const result = await log.tfa('fetchUser', async (t) => {
                t.tf('got response');
                return { ok: true };
            });

            expect(result).toEqual({ ok: true });

            // Nothing reaches the console while silent
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleGroupSpy).not.toHaveBeenCalled();
            expect(consoleGroupEndSpy).not.toHaveBeenCalled();

            // The dump holds the whole operation: entry, scoped log, completion
            const dump = log.dump();
            expect(dump).toContain('⟳ fetchUser #1');
            expect(dump).toContain('got response');
            expect(dump).toContain('✓ fetchUser #1');
            // The scoped log sits at its capture position, before the ✓ completion
            expect(dump.indexOf('got response')).toBeLessThan(dump.indexOf('✓ fetchUser'));

            // Every captured entry was black-boxed: seen but never printed
            expect(captured).toHaveLength(3);
            expect(captured.every((entry) => entry.printed === false)).toBe(true);
            expect(captured.some((entry) => entry.kind === 'asyncStart')).toBe(true);
            expect(captured.some((entry) => entry.kind === 'asyncComplete')).toBe(true);
        });

        it('should capture nested silent operations with the child linked to its parent', async () => {
            log = new Vittra({ banner: false, logLevel: 0, blackBox: true, bufferSize: 50 });

            // Hold the child open past the parent so it settles as a standalone
            // block carrying the ←#parent back-reference (badgeParent).
            let releaseChild!: () => void;
            const gate = new Promise<void>((resolve) => {
                releaseChild = resolve;
            });
            let childPromise!: Promise<void>;

            await log.tfa('parent', async (t) => {
                childPromise = t.tfa('child', () => gate);
            });

            releaseChild();
            await childPromise;

            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleGroupSpy).not.toHaveBeenCalled();

            const entries = JSON.parse(log.dump({ format: 'json' })) as VittraLogEntry[];
            const parentComplete = entries.find(
                (entry) => entry.kind === 'asyncComplete' && entry.opId === 1,
            );
            const childComplete = entries.find(
                (entry) => entry.kind === 'asyncComplete' && entry.opId === 2,
            );

            expect(parentComplete).toBeDefined();
            expect(childComplete).toBeDefined();
            // The standalone child records its parent's id as the back-reference
            expect((childComplete as { badgeParent?: number }).badgeParent).toBe(1);
            expect(entries.every((entry) => entry.printed === false)).toBe(true);
        });

        it('should capture the error of a failing silent operation and still rethrow', async () => {
            log = new Vittra({ banner: false, logLevel: 0, blackBox: true, bufferSize: 10 });

            await expect(
                log.tfa('op', async () => {
                    throw new Error('boom');
                }),
            ).rejects.toThrow('boom');

            // The failure block never prints while silent
            expect(consoleErrorSpy).not.toHaveBeenCalled();
            expect(consoleGroupSpy).not.toHaveBeenCalled();

            expect(log.dump()).toContain('✗ op #1 — Error: boom');
        });

        it('should print the replay block when the level escalates mid-operation', async () => {
            log = new Vittra({ banner: false, logLevel: 0, blackBox: true, logTime: true });
            performanceNowSpy.mockReturnValue(1000);
            const color1 = 'font-weight: bold; color: #e91e63';

            await log.tfa('op', async (t) => {
                t.tf('before');
                log.setLogLevel(2);
                return 7;
            });

            // The completion decision is made at completion time: the level has
            // risen, so the whole block replays to the console now.
            expect(consoleGroupSpy).toHaveBeenCalledWith('%c✓ op #1 [0.0 ms] =', color1, 7);
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'before',
                '  [Δ 0.0 ms]',
            );
            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(1);
            // The ⟳ start line never printed — the operation started silent
            expect(consoleLogSpy.mock.calls.some((call) => String(call[0]).includes('⟳'))).toBe(
                false,
            );
        });

        it('should leave a tfa fully silent and uncaptured at level 0 without blackBox', async () => {
            log = new Vittra({ banner: false, logLevel: 0, bufferSize: 10 });

            const result = await log.tfa('op', async (t) => {
                t.tf('hidden');
                return 5;
            });

            expect(result).toBe(5);
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleGroupSpy).not.toHaveBeenCalled();
            expect(log.dump()).toBe('');
        });
    });

    describe('onEntry hook', () => {
        it('should fire per captured entry with the correct printed flag', () => {
            const silent: VittraLogEntry[] = [];
            log = new Vittra({
                banner: false,
                logLevel: 0,
                blackBox: true,
                onEntry: (entry) => silent.push(entry),
            });
            log.tf('quiet');
            expect(silent).toHaveLength(1);
            expect(silent[0].printed).toBe(false);

            const loud: VittraLogEntry[] = [];
            log = new Vittra({
                banner: false,
                logLevel: 2,
                onEntry: (entry) => loud.push(entry),
            });
            log.tf('loud');
            expect(loud[loud.length - 1].printed).toBe(true);
        });

        it('should not re-fire when a tfa buffer is replayed', async () => {
            const captured: VittraLogEntry[] = [];
            log = new Vittra({
                banner: false,
                logLevel: 2,
                onEntry: (entry) => captured.push(entry),
            });

            await log.tfa('op', async (t) => {
                t.tf('inside-op');
            });

            const insideCaptures = captured.filter(
                (entry) =>
                    entry.kind === 'log' && JSON.stringify(entry.values).includes('inside-op'),
            );
            expect(insideCaptures).toHaveLength(1);
        });

        it('should swallow a throwing hook without breaking subsequent logging', () => {
            log = new Vittra({
                banner: false,
                logLevel: 2,
                onEntry: () => {
                    throw new Error('hook boom');
                },
            });

            expect(() => log.tf('first')).not.toThrow();
            log.tf('second');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'second');
        });
    });

    describe('dumpOnError', () => {
        let errorHandler: (() => void) | undefined;
        let addEventListenerSpy: MockInstance;

        beforeEach(() => {
            errorHandler = undefined;
            addEventListenerSpy = vi
                .spyOn(globalThis, 'addEventListener')
                .mockImplementation((type: string, handler: unknown) => {
                    if (type === 'error') {
                        errorHandler = handler as () => void;
                    }
                });
        });

        afterEach(() => {
            addEventListenerSpy.mockRestore();
        });

        it('should print a banner group and one line per buffered entry on an error', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 10, dumpOnError: true });
            log.tf('breadcrumb-one');
            log.tf('breadcrumb-two');

            consoleGroupSpy.mockClear();
            consoleLogSpy.mockClear();
            consoleGroupEndSpy.mockClear();

            expect(errorHandler).toBeTypeOf('function');
            errorHandler?.();

            expect(consoleGroupSpy).toHaveBeenCalledWith(
                expect.stringContaining('vittra — last 2 entries before uncaught error'),
                expect.stringContaining('linear-gradient'),
            );
            expect(consoleLogSpy).toHaveBeenCalledTimes(2);
            expect(consoleLogSpy.mock.calls[0][0]).toContain('breadcrumb-one');
            expect(consoleLogSpy.mock.calls[1][0]).toContain('breadcrumb-two');
            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(1);
        });

        it('should do nothing on an error when the buffer is empty', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 10, dumpOnError: true });

            consoleGroupSpy.mockClear();
            consoleLogSpy.mockClear();

            errorHandler?.();

            expect(consoleGroupSpy).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe('perfMarks', () => {
        let markSpy: MockInstance;
        let measureSpy: MockInstance;
        let clearMarksSpy: MockInstance;
        let getEntriesByNameSpy: MockInstance;
        let originalMark: typeof performance.mark;
        let originalMeasure: typeof performance.measure;
        let originalClearMarks: typeof performance.clearMarks;
        let originalGetEntriesByName: typeof performance.getEntriesByName;
        // Models the User Timing buffer so the getEntriesByName guard behaves as
        // it would against real marks: mark() adds, clearMarks() removes.
        let liveMarks: Set<string>;

        beforeEach(() => {
            liveMarks = new Set();
            originalMark = performance.mark;
            originalMeasure = performance.measure;
            originalClearMarks = performance.clearMarks;
            originalGetEntriesByName = performance.getEntriesByName;

            markSpy = vi.fn((name: string) => {
                liveMarks.add(name);
            });
            measureSpy = vi.fn();
            clearMarksSpy = vi.fn((name?: string) => {
                if (name === undefined) liveMarks.clear();
                else liveMarks.delete(name);
            });
            getEntriesByNameSpy = vi.fn((name: string, type?: string) =>
                type === 'mark' && liveMarks.has(name) ? [{ name }] : [],
            );

            performance.mark = markSpy as unknown as typeof performance.mark;
            performance.measure = measureSpy as unknown as typeof performance.measure;
            performance.clearMarks = clearMarksSpy as unknown as typeof performance.clearMarks;
            performance.getEntriesByName =
                getEntriesByNameSpy as unknown as typeof performance.getEntriesByName;
        });

        afterEach(() => {
            performance.mark = originalMark;
            performance.measure = originalMeasure;
            performance.clearMarks = originalClearMarks;
            performance.getEntriesByName = originalGetEntriesByName;
        });

        it('should not touch mark or measure by default', async () => {
            log = new Vittra({ banner: false, logLevel: 2, logTime: true });
            log.tfi('fn');
            log.tfo('fn');
            await log.tfa('op', Promise.resolve(1));

            expect(markSpy).not.toHaveBeenCalled();
            expect(measureSpy).not.toHaveBeenCalled();
        });

        it('should mark on tfi and measure on tfo, consuming the matching start mark', () => {
            log = new Vittra({ banner: false, logLevel: 2, logTime: true, perfMarks: true });
            log.tfi('doWork');
            log.tfo('doWork');

            expect(markSpy).toHaveBeenCalledTimes(1);
            const startMark = markSpy.mock.calls[0][0];

            expect(measureSpy).toHaveBeenCalledTimes(1);
            const [measureName, measureOptions] = measureSpy.mock.calls[0];
            expect(measureName).toBe('vittra: doWork');
            expect(measureOptions.start).toBe(startMark);
            expect(clearMarksSpy).toHaveBeenCalledWith(startMark);
        });

        it('should give recursive same-name frames two measures with distinct start marks', () => {
            log = new Vittra({ banner: false, logLevel: 2, perfMarks: true });
            log.tfi('f');
            log.tfi('f');
            log.tfo('f');
            log.tfo('f');

            expect(measureSpy).toHaveBeenCalledTimes(2);
            const [name1, opts1] = measureSpy.mock.calls[0];
            const [name2, opts2] = measureSpy.mock.calls[1];
            expect(name1).toBe('vittra: f');
            expect(name2).toBe('vittra: f');
            expect(opts1.start).not.toBe(opts2.start);
        });

        it('should measure a tfa operation once with opId and status detail', async () => {
            log = new Vittra({ banner: false, logLevel: 2, logTime: true, perfMarks: true });
            await log.tfa('loadThing', Promise.resolve(42));

            const opMeasures = measureSpy.mock.calls.filter(([n]) => n === 'vittra: loadThing #1');
            expect(opMeasures).toHaveLength(1);
            const options = opMeasures[0][1];
            expect(options.start).toBe('vittra-op-1');
            expect(options.detail.opId).toBe(1);
            expect(options.detail.status).toBe('done');
        });

        it('should measure nested tfa children once each', async () => {
            log = new Vittra({ banner: false, logLevel: 2, perfMarks: true });
            await log.tfa('parent', async (t) => {
                await t.tfa('child', async () => {});
            });

            const names = measureSpy.mock.calls.map(([n]) => n);
            expect(names.filter((n) => n === 'vittra: parent #1')).toHaveLength(1);
            expect(names.filter((n) => n === 'vittra: child #2')).toHaveLength(1);
        });

        it('should measure a nested child at its own completion, before the parent replays', async () => {
            log = new Vittra({ banner: false, logLevel: 2, perfMarks: true });
            await log.tfa('parent', async (t) => {
                await t.tfa('child', async () => {});
            });

            // The child's measure must fire when the child settles (its true
            // duration), not when the parent replays it into the console group.
            const childMeasureIndex = measureSpy.mock.calls.findIndex(
                ([name]) => name === 'vittra: child #2',
            );
            expect(childMeasureIndex).toBeGreaterThanOrEqual(0);
            const childMeasureOrder = measureSpy.mock.invocationCallOrder[childMeasureIndex];

            const parentGroupIndex = consoleGroupSpy.mock.calls.findIndex(
                ([header]) => typeof header === 'string' && header.includes('✓ parent #1'),
            );
            expect(parentGroupIndex).toBeGreaterThanOrEqual(0);
            const parentGroupOrder = consoleGroupSpy.mock.invocationCallOrder[parentGroupIndex];

            expect(childMeasureOrder).toBeLessThan(parentGroupOrder);
        });

        it('should clear auto-closed frame marks without measuring them', () => {
            log = new Vittra({ banner: false, logLevel: 2, perfMarks: true });
            log.tfi('outer');
            log.tfi('inner');
            log.tfo('outer'); // inner is auto-closed

            const innerMark = markSpy.mock.calls[1][0];
            const measuredStarts = measureSpy.mock.calls.map(([, opts]) => opts.start);
            expect(measuredStarts).not.toContain(innerMark);
            expect(clearMarksSpy).toHaveBeenCalledWith(innerMark);

            expect(measureSpy.mock.calls.filter(([n]) => n === 'vittra: outer')).toHaveLength(1);
            expect(measureSpy.mock.calls.filter(([n]) => n === 'vittra: inner')).toHaveLength(0);
        });

        it('should do nothing at level 0 without blackBox', () => {
            log = new Vittra({ banner: false, logLevel: 0, perfMarks: true });
            log.tfi('fn');
            log.tfo('fn');

            expect(markSpy).not.toHaveBeenCalled();
            expect(measureSpy).not.toHaveBeenCalled();
        });
    });

    describe('namespaces: named badge', () => {
        // djb2('api') % OP_COLORS.length === 7 → OP_COLORS[7]
        const apiStyle = 'font-weight: bold; color: #795548';

        beforeEach(() => {
            log = new Vittra({ name: 'api', banner: false, logLevel: 2 });
        });

        it('should prefix tf output with a colored [api] badge', () => {
            log.tf('hi');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c[api]%c+ ',
                apiStyle,
                'font-weight: bold',
                'hi',
            );
        });

        it('should prefix the tfi group with the badge', () => {
            log.tfi('doThing', 'x');
            expect(consoleGroupSpy).toHaveBeenCalledWith(
                '%c[api]%c--> doThing(',
                apiStyle,
                'font-weight: bold',
                'x',
                ')',
            );
        });

        it('should leave an unnamed instance byte-identical', () => {
            const plain = new Vittra({ banner: false, logLevel: 2 });
            plain.tf('hi');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'hi');
        });
    });

    describe('namespaces: static setLogLevel', () => {
        it('should apply per-namespace levels to registered instances', () => {
            const api = new Vittra({ name: 'api', banner: false });
            const ui = new Vittra({ name: 'ui', banner: false });
            const other = new Vittra({ name: 'other', banner: false });

            Vittra.setLogLevel('api:2,ui:1');
            consoleLogSpy.mockClear();
            consoleWarnSpy.mockClear();

            api.tf('shown'); // level 2 → full trace
            expect(consoleLogSpy).toHaveBeenCalled();

            consoleLogSpy.mockClear();
            ui.tf('suppressed'); // level 1 → plain logs need level 2
            expect(consoleLogSpy).not.toHaveBeenCalled();
            ui.tfw('warned'); // level 1 → warnings show
            expect(consoleWarnSpy).toHaveBeenCalled();

            consoleLogSpy.mockClear();
            consoleWarnSpy.mockClear();
            other.tf('nope'); // unmentioned → dropped to 0
            other.tfw('nope'); // level 0 → not even warnings
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should apply the runtime spec to instances constructed afterward', () => {
            Vittra.setLogLevel('api:2,ui:1');

            const lateApi = new Vittra({ name: 'api', banner: false });
            lateApi.tf('shown');
            expect(consoleLogSpy).toHaveBeenCalled();

            consoleLogSpy.mockClear();
            const lateOther = new Vittra({ name: 'other', banner: false });
            lateOther.tf('hidden'); // not mentioned → 0
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe('namespaces: instance persist merge', () => {
        // jsdom's localStorage lacks the Storage methods, so stub a real one
        function createStorageMock(): Storage {
            const store = new Map<string, string>();
            return {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, String(value));
                },
                removeItem: (key: string) => {
                    store.delete(key);
                },
                clear: () => {
                    store.clear();
                },
                key: (index: number) => Array.from(store.keys())[index] ?? null,
                get length() {
                    return store.size;
                },
            };
        }

        beforeEach(() => {
            vi.stubGlobal('localStorage', createStorageMock());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should preserve other namespaces when one instance persists its level', () => {
            localStorage.setItem('vittraLogLevel', 'ui:1');
            const api = new Vittra({ name: 'api', banner: false });

            api.setLogLevel(2, { persist: true });

            const stored = localStorage.getItem('vittraLogLevel');
            expect(stored).toContain('ui:1');
            expect(stored).toContain('api:2');
        });

        it('should write an explicit 0 for a named instance persisting 0 so a wildcard cannot re-enable it', () => {
            localStorage.setItem('vittraLogLevel', 'ui:1,api:2');
            const api = new Vittra({ name: 'api', banner: false });

            api.setLogLevel(0, { persist: true });

            const stored = localStorage.getItem('vittraLogLevel');
            expect(stored).toContain('ui:1');
            expect(stored).toContain('api:0');
        });

        it('should keep a wildcard but write an explicit named 0 that beats it', () => {
            localStorage.setItem('vittraLogLevel', '*:1');
            const api = new Vittra({ name: 'api', banner: false });

            api.setLogLevel(0, { persist: true });

            const stored = localStorage.getItem('vittraLogLevel');
            expect(stored).toContain('*:1');
            expect(stored).toContain('api:0');
        });
    });

    describe('namespaces: banner', () => {
        it('should show the namespace in the banner', () => {
            log = new Vittra({ name: 'api', logLevel: 2 });

            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            const [format] = consoleLogSpy.mock.calls[0];
            expect(format).toContain('🪽 vittra');
            expect(format).toContain('[api]');
            expect(format).toContain('level 2');
        });
    });

    describe('namespaces: level spec via URL', () => {
        afterEach(() => {
            window.history.replaceState(null, '', '/');
        });

        it('should apply a bare number as a global level to named and unnamed instances', () => {
            window.history.replaceState(null, '', '/?vittraLogLevel=2');
            const unnamed = new Vittra({ banner: false });
            const api = new Vittra({ name: 'api', banner: false });

            unnamed.tf('a');
            expect(consoleLogSpy).toHaveBeenCalled();
            consoleLogSpy.mockClear();
            api.tf('b'); // a global applies to a named instance too
            expect(consoleLogSpy).toHaveBeenCalled();
        });

        it('should apply a per-namespace spec to the matching instance only', () => {
            window.history.replaceState(null, '', '/?vittraLogLevel=api:2');
            const api = new Vittra({ name: 'api', banner: false });
            const unnamed = new Vittra({ banner: false });

            api.tf('shown');
            expect(consoleLogSpy).toHaveBeenCalled();
            consoleLogSpy.mockClear();
            unnamed.tf('hidden'); // no global/wildcard → unnamed stays 0
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should apply a wildcard default with a per-namespace override', () => {
            window.history.replaceState(null, '', '/?vittraLogLevel=*:1,api:2');
            const api = new Vittra({ name: 'api', banner: false });
            const other = new Vittra({ name: 'other', banner: false });

            api.tf('full-trace'); // 2 → logs
            expect(consoleLogSpy).toHaveBeenCalled();
            consoleLogSpy.mockClear();
            other.tf('suppressed'); // wildcard 1 → plain log suppressed
            expect(consoleLogSpy).not.toHaveBeenCalled();
            other.tfw('warned'); // wildcard 1 → warning shows
            expect(consoleWarnSpy).toHaveBeenCalled();
        });

        it('should ignore an invalid spec entirely, leaving instances at 0', () => {
            window.history.replaceState(null, '', '/?vittraLogLevel=api:2,bogus');
            const api = new Vittra({ name: 'api', banner: false });

            api.tf('hidden');
            api.tfw('hidden');
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });

    describe('group pairing across level changes', () => {
        it('reset closes groups that printed, even after the level dropped to 0', () => {
            log = new Vittra({ banner: false, logLevel: 2 });
            log.tfi('a');
            log.tfi('b'); // two real, printed groups

            log.setLogLevel(0);
            consoleGroupEndSpy.mockClear();
            log.reset();

            // Both printed groups must close or the console stays indented forever
            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(2);
        });

        it('reset closes nothing for black-boxed groups that never printed, even after escalation', () => {
            log = new Vittra({ banner: false, logLevel: 0, blackBox: true });
            log.tfi('a');
            log.tfi('b');
            log.tfi('c'); // captured silently — no console.group was ever called

            log.setLogLevel(2);
            consoleGroupEndSpy.mockClear();
            log.reset();

            // Emitting groupEnds here would close the host app's own open groups
            expect(consoleGroupEndSpy).not.toHaveBeenCalled();
        });

        it('a plain tfo after escalation does not close a group that never opened', () => {
            log = new Vittra({ banner: false, logLevel: 0, blackBox: true });
            log.tfi('a'); // silent entry, no group printed

            log.setLogLevel(2);
            consoleGroupEndSpy.mockClear();
            log.tfo('a');

            expect(consoleGroupEndSpy).not.toHaveBeenCalled();
            // The exit line still follows the current level's print gate
            expect(consoleLogSpy).toHaveBeenCalledWith('%c<-- a ', 'font-weight: bold');
        });

        it('a matched tfo closes a printed group even after the level dropped to 0', () => {
            log = new Vittra({ banner: false, logLevel: 2 });
            log.tfi('a'); // real, printed group

            log.setLogLevel(0);
            consoleGroupEndSpy.mockClear();
            log.tfo('a');

            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(1);
        });

        it('closes exactly the frames whose groups printed when printed and silent frames are mixed', () => {
            log = new Vittra({ banner: false, logLevel: 2, blackBox: true });
            log.tfi('printed'); // level 2 → group printed
            log.setLogLevel(0);
            log.tfi('silent'); // black-boxed → no group printed
            log.setLogLevel(2);

            consoleGroupEndSpy.mockClear();
            log.reset();

            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('dump crash-proofness', () => {
        // Object.create(null) with a function member and a self-cycle defeats
        // structuredClone AND JSON AND String — the worst case for any dump path.
        function makePoison(): Record<string, unknown> {
            const poison = Object.create(null) as Record<string, unknown>;
            poison.fn = () => 42;
            poison.cycle = poison;
            return poison;
        }

        it('text dump renders an unstringifiable value as a placeholder without throwing', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 10 });
            log.tf(makePoison());

            let text = '';
            expect(() => {
                text = log.dump();
            }).not.toThrow();
            expect(text).toContain('[unstringifiable]');
        });

        it('json dump parses with a placeholder instead of collapsing or throwing', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 10 });
            log.tf(makePoison());

            let json = '';
            expect(() => {
                json = log.dump({ format: 'json' });
            }).not.toThrow();
            const parsed = JSON.parse(json) as unknown[];
            expect(Array.isArray(parsed)).toBe(true);
            // The genuine self-cycle becomes the circular placeholder
            expect(json).toContain('[Circular]');
        });

        it('the dumpOnError flight recorder prints the dump without throwing at crash time', () => {
            let errorHandler: (() => void) | undefined;
            const spy = vi
                .spyOn(globalThis, 'addEventListener')
                .mockImplementation((type: string, handler: unknown) => {
                    if (type === 'error') errorHandler = handler as () => void;
                });
            try {
                log = new Vittra({
                    banner: false,
                    logLevel: 2,
                    bufferSize: 10,
                    dumpOnError: true,
                });
                log.tf(makePoison());

                consoleLogSpy.mockClear();
                expect(errorHandler).toBeTypeOf('function');
                expect(() => errorHandler?.()).not.toThrow();
                expect(
                    consoleLogSpy.mock.calls.some((call) =>
                        String(call[0]).includes('[unstringifiable]'),
                    ),
                ).toBe(true);
            } finally {
                spy.mockRestore();
            }
        });

        it('json dump serializes a shared sibling twice and only a real cycle as circular', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 10 });
            const shared = { tag: 'shared-value' };
            log.tf({ x: shared, y: shared }); // shared is a sibling, not an ancestor

            const cycle: Record<string, unknown> = { name: 'root' };
            cycle.self = cycle;
            log.tf(cycle);

            const json = log.dump({ format: 'json' });
            // A repeated sibling is serialized in full each time
            const occurrences = json.split('shared-value').length - 1;
            expect(occurrences).toBe(2);
            // A genuine ancestor cycle gets the placeholder
            expect(json).toContain('[Circular]');
        });
    });

    describe('tft data snapshot', () => {
        it('snapshots table data for the ring while console.table keeps the live object', () => {
            log = new Vittra({ banner: false, logLevel: 2, bufferSize: 10 });
            const data = { count: 1 };
            log.tft(data);

            // console.table received the LIVE reference (stays devtools-expandable)
            expect(consoleTableSpy.mock.calls[0][0]).toBe(data);

            data.count = 999;
            const dump = log.dump();
            // The ring copy was snapshotted at log time, so the mutation is invisible
            expect(dump).toContain('"count":1');
            expect(dump).not.toContain('999');
        });
    });

    describe('constructor: runtime spec binds later instances', () => {
        function createStorageMock(): Storage {
            const store = new Map<string, string>();
            return {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, String(value));
                },
                removeItem: (key: string) => {
                    store.delete(key);
                },
                clear: () => {
                    store.clear();
                },
                key: (index: number) => Array.from(store.keys())[index] ?? null,
                get length() {
                    return store.size;
                },
            };
        }

        beforeEach(() => {
            vi.stubGlobal('localStorage', createStorageMock());
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('binds an instance the runtime spec omits to 0, not to the persisted level', () => {
            localStorage.setItem('vittraLogLevel', '2'); // persisted global 2
            Vittra.setLogLevel('api:2'); // runtime spec names only api

            const unnamed = new Vittra({ banner: false }); // unmentioned → 0
            unnamed.tf('hidden');
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });

    describe('throttle', () => {
        it('is off by default: every entry prints and the print path never reads the clock', () => {
            log = new Vittra({ banner: false, logLevel: 2 }); // logTime off, throttle off
            performanceNowSpy.mockClear();

            for (let i = 0; i < 10; i++) {
                log.tf(`msg ${i}`);
            }

            // All ten print — no rate limit
            expect(consoleLogSpy).toHaveBeenCalledTimes(10);
            // The throttle-off print path makes zero performance.now calls, which
            // is what keeps the position-sensitive timing mocks undisturbed.
            expect(performanceNowSpy).not.toHaveBeenCalled();
        });

        it('prints up to the limit per window, suppresses the rest, then summarizes on rollover', () => {
            performanceNowSpy.mockReturnValue(1000);
            log = new Vittra({ banner: false, logLevel: 2, throttle: 5 });

            for (let i = 0; i < 10; i++) {
                log.tf(`msg ${i}`);
            }

            // Exactly five of the ten reached the console; no summary mid-window
            expect(consoleLogSpy).toHaveBeenCalledTimes(5);
            expect(consoleWarnSpy).not.toHaveBeenCalled();

            // Advance the mocked clock past the 1s window and log once more
            performanceNowSpy.mockReturnValue(2000);
            log.tf('after window');

            // The rollover prints the summary warn (mentioning the 5 suppressed)
            // and then the new entry.
            expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
            expect(String(consoleWarnSpy.mock.calls[0][0])).toContain('5');
            expect(String(consoleWarnSpy.mock.calls[0][0])).toContain('suppressed');
            expect(consoleLogSpy).toHaveBeenCalledTimes(6);
        });

        it('captures all entries despite suppression, with printed flags reflecting reality', () => {
            performanceNowSpy.mockReturnValue(1000);
            const captured: VittraLogEntry[] = [];
            log = new Vittra({
                banner: false,
                logLevel: 2,
                throttle: 5,
                bufferSize: 50,
                onEntry: (entry) => captured.push(entry),
            });

            for (let i = 0; i < 10; i++) {
                log.tf(`m${i}`);
            }

            // onEntry fired for every entry, suppressed ones included
            const logs = captured.filter((entry) => entry.kind === 'log');
            expect(logs).toHaveLength(10);
            expect(logs.filter((entry) => entry.printed)).toHaveLength(5);
            expect(logs.filter((entry) => !entry.printed)).toHaveLength(5);

            // dump() holds all ten regardless of what printed
            const dump = log.dump();
            for (let i = 0; i < 10; i++) {
                expect(dump).toContain(`m${i}`);
            }
        });

        it('a suppressed tfi leaves no dangling groupEnd', () => {
            performanceNowSpy.mockReturnValue(1000);
            log = new Vittra({ banner: false, logLevel: 2, throttle: 1 });

            log.tf('uses the one slot'); // consumes the window's single print
            log.tfi('fn'); // group-open throttled away → printedGroup false
            log.tfo('fn'); // its close must be skipped, not left dangling

            expect(consoleGroupSpy).not.toHaveBeenCalled();
            expect(consoleGroupEndSpy).not.toHaveBeenCalled();
        });

        it('a printed tfi still closes its group even when the exit line is throttled', () => {
            performanceNowSpy.mockReturnValue(1000);
            log = new Vittra({ banner: false, logLevel: 2, throttle: 1 });

            log.tfi('fn'); // opens the group, consuming the one slot
            log.tfo('fn'); // exit LINE suppressed, but the group must still close

            expect(consoleGroupSpy).toHaveBeenCalledTimes(1);
            // groupEnd is structural — exempt from the throttle — so it fires
            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(1);
            // ...while the '<-- fn' exit line itself was rate-limited away
            expect(
                consoleLogSpy.mock.calls.some((call) => String(call[0]).includes('<-- fn')),
            ).toBe(false);
        });

        it('suppresses a whole tfa replay block atomically when the window is exhausted', async () => {
            performanceNowSpy.mockReturnValue(1000);
            log = new Vittra({ banner: false, logLevel: 2, throttle: 1, bufferSize: 50 });

            log.tf('exhaust the window'); // consumes the single print slot

            await log.tfa('op', async (t) => {
                t.tf('inside one');
                t.tf('inside two');
                return 42;
            });

            // Nothing from the block reached the console: the ✓ header is a
            // console.group, and it never opened — so no partial header/lines.
            expect(consoleGroupSpy).not.toHaveBeenCalled();

            // The dump still holds the whole operation despite the suppression.
            const dump = log.dump();
            expect(dump).toContain('⟳ op');
            expect(dump).toContain('inside one');
            expect(dump).toContain('inside two');
            expect(dump).toContain('✓ op');
        });

        it('prints a whole tfa replay block atomically when the window has room', async () => {
            performanceNowSpy.mockReturnValue(1000);
            log = new Vittra({ banner: false, logLevel: 2, throttle: 100 });
            const color1 = 'font-weight: bold; color: #e91e63';

            await log.tfa('op', async (t) => {
                t.tf('inside one');
                t.tf('inside two');
                return 1;
            });

            // Header, both buffered lines, and the close all print together.
            expect(consoleGroupSpy).toHaveBeenCalledWith('%c✓ op #1 =', color1, 1);
            expect(
                consoleLogSpy.mock.calls.some((call) => String(call).includes('inside one')),
            ).toBe(true);
            expect(
                consoleLogSpy.mock.calls.some((call) => String(call).includes('inside two')),
            ).toBe(true);
            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(1);
        });
    });
});
