import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { Vittra, VittraOptions } from '../src/vittra';

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
        setupSpies();
        vi.clearAllMocks();
        log = new Vittra({ logLevel: 1, logTime: true });
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

    describe('logging methods with logLevel 1', () => {
        beforeEach(() => {
            log = new Vittra({ logLevel: 1 });
        });

        it('should log basic message with tf', () => {
            log.tf('test message');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'test message',
                '',
            );
        });

        it('should log clean message with tfc', () => {
            log.tfc('test message');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c',
                'font-weight: bold',
                'test message',
                '',
            );
        });

        it('should log warning with tfw', () => {
            log.tfw('warning message');
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'warning message',
                '',
            );
        });

        it('should log error with tfe', () => {
            log.tfe('error message');
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'error message',
                '',
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
            log = new Vittra({ logLevel: 1, logTime: true });
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
            log = new Vittra({ logLevel: 1 });
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
                '',
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
                '',
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
                '',
            );
        });
    });

    describe('async function tracking', () => {
        beforeEach(() => {
            log = new Vittra({ logLevel: 1, logTime: true });
            performanceNowSpy.mockReturnValue(1000);
        });

        it('should track async operations with proper indentation and timing', () => {
            const opId = log.tfia('asyncOp', 'arg1');
            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('asyncOp', opId, { result: 'success' });

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c⟳ asyncOp(',
                'font-weight: bold',
                'arg1',
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c✓ asyncOp() [1.000 s] =',
                'font-weight: bold',
                { result: 'success' },
            );
        });

        it('should handle nested async operations', () => {
            const outerOpId = log.tfia('outerAsync', { param: 'outer' });
            const innerOpId = log.tfia('innerAsync', { param: 'inner' });

            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('innerAsync', innerOpId, { inner: 'result' });
            log.tfoa('outerAsync', outerOpId, { outer: 'result' });

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c⟳ outerAsync(',
                'font-weight: bold',
                { param: 'outer' },
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c  ⟳ innerAsync(',
                'font-weight: bold',
                { param: 'inner' },
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                3,
                '%c  ✓ innerAsync() [1.000 s] =',
                'font-weight: bold',
                { inner: 'result' },
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                4,
                '%c✓ outerAsync() [1.000 s] =',
                'font-weight: bold',
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
                '%c⟳ asyncOp(',
                'font-weight: bold',
                { id: 1 },
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c  ⟳ asyncOp(',
                'font-weight: bold',
                { id: 2 },
                ')',
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                3,
                '%c✓ asyncOp() [1.000 s] =',
                'font-weight: bold',
                { result: 1 },
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                4,
                '%c  ✓ asyncOp() [1.000 s] =',
                'font-weight: bold',
                { result: 2 },
            );
        });

        it('should handle async operations without arguments or return values', () => {
            const opId = log.tfia('asyncOp');
            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('asyncOp', opId);

            expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '%c⟳ asyncOp()', 'font-weight: bold');

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c✓ asyncOp() [1.000 s]',
                'font-weight: bold',
            );
        });

        it('should warn on mismatched async operations', () => {
            const opId = log.tfia('asyncOp1');
            log.tfoa('asyncOp2', opId);

            expect(consoleLogSpy).toHaveBeenNthCalledWith(1, '%c⟳ asyncOp1()', 'font-weight: bold');

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                `Warning: tfoa called for 'asyncOp2' (ID: ${opId}) but no matching tfia found`,
                '',
            );
        });
    });

    describe('time formatting', () => {
        beforeEach(() => {
            log = new Vittra({ logLevel: 1, logTime: true });
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
            log = new Vittra({ logLevel: 1 });
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

            expect(consoleErrorSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', error, '');
        });

        it('should not throw when logging a function value', () => {
            const fn = () => 42;

            expect(() => log.tf(fn)).not.toThrow();
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', fn, '');
        });

        it('should not throw when structuredClone is unavailable', () => {
            vi.stubGlobal('structuredClone', undefined);
            try {
                const circular: Record<string, unknown> = { name: 'a' };
                circular.self = circular;

                expect(() => log.tf(circular)).not.toThrow();
                expect(consoleLogSpy).toHaveBeenCalledWith(
                    '%c+ ',
                    'font-weight: bold',
                    circular,
                    '',
                );
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

            log.setLogLevel(1);
            log.tf('visible');
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'visible', '');

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
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                'remembered',
                '',
            );
        });

        it('should clear the persisted level when persisting 0', () => {
            log = new Vittra();
            log.setLogLevel(2, { persist: true });
            log.setLogLevel(0, { persist: true });
            expect(localStorage.getItem('vittraLogLevel')).toBeNull();
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
            expect(consoleLogSpy).toHaveBeenCalledWith('%c+ ', 'font-weight: bold', 'from url', '');
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
            log = new Vittra({ logLevel: 1 });
        });

        it('should close open groups and clear all tracing state', () => {
            log.tfi('outer');
            log.tfi('inner');

            log.reset();

            expect(consoleGroupEndSpy).toHaveBeenCalledTimes(2);
            expect(log.checkUnclosedFunctions()).toBe(false);
        });

        it('should reset async indentation', () => {
            log.tfia('first');
            log.reset();

            log.tfia('second');
            expect(consoleLogSpy).toHaveBeenLastCalledWith('%c⟳ second()', 'font-weight: bold');
        });
    });
});
