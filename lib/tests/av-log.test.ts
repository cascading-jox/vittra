import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { MockInstance } from 'vitest';
import { AvLog, AvLogOptions } from '../src/av-log';

describe('AvLog', () => {
    let log: AvLog;
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
        log = new AvLog({ logLevel: 1, logTime: true });
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            log = new AvLog();
            expect(log).toBeDefined();
        });

        it('should initialize with custom options', () => {
            const options: AvLogOptions = {
                logLevel: 1,
                logTime: true,
                logWithType: true,
            };
            log = new AvLog(options);
            expect(log).toBeDefined();
        });
    });

    describe('logging methods with logLevel 0', () => {
        beforeEach(() => {
            log = new AvLog({ logLevel: 0 });
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
            log = new AvLog({ logLevel: 1 });
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
            log = new AvLog({ logLevel: 1, logTime: true });
            performanceNowSpy.mockReturnValueOnce(1000);
        });

        it('should log function entry with tfi', () => {
            log.tfi('testFunction', 'arg1', 'arg2');
            expect(consoleGroupSpy).toHaveBeenCalledWith(
                '%c--> testFunction( ',
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
                '%c<-- testFunction [1.0 s] = ',
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
                '%c<-- testFunction [1.0 s]',
                'font-weight: bold',
            );
        });
    });

    describe('function tracking', () => {
        beforeEach(() => {
            log = new AvLog({ logLevel: 1 });
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

        it('should warn on mismatched tfo call', () => {
            log.tfi('outer');
            log.tfi('inner');
            log.tfo('outer'); // Wrong order

            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '%c+ ',
                'font-weight: bold',
                "Warning: Unexpected tfo call for 'outer'. Expected 'inner'",
                '',
            );
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
            log = new AvLog({ logLevel: 1, logTime: true });
            performanceNowSpy.mockReturnValue(1000);
        });

        it('should track async operations with proper indentation and timing', () => {
            const opId = log.tfia('asyncOp');
            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('asyncOp', opId);

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c',
                'font-weight: bold',
                '⟳ asyncOp()',
                ''
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c',
                'font-weight: bold',
                '✓ asyncOp() [1.0 s]',
                ''
            );
        });

        it('should handle nested async operations', () => {
            const outerOpId = log.tfia('outerAsync');
            const innerOpId = log.tfia('innerAsync');

            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('innerAsync', innerOpId);
            log.tfoa('outerAsync', outerOpId);

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c',
                'font-weight: bold',
                '⟳ outerAsync()',
                ''
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c',
                'font-weight: bold',
                '  ⟳ innerAsync()',
                ''
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                3,
                '%c',
                'font-weight: bold',
                '  ✓ innerAsync() [1.0 s]',
                ''
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                4,
                '%c',
                'font-weight: bold',
                '✓ outerAsync() [1.0 s]',
                ''
            );
        });

        it('should handle multiple concurrent calls to the same async function', () => {
            const op1Id = log.tfia('asyncOp');
            const op2Id = log.tfia('asyncOp');

            performanceNowSpy.mockReturnValue(2000);
            log.tfoa('asyncOp', op1Id);
            log.tfoa('asyncOp', op2Id);

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c',
                'font-weight: bold',
                '⟳ asyncOp()',
                ''
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                2,
                '%c',
                'font-weight: bold',
                '  ⟳ asyncOp()',
                ''
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                3,
                '%c',
                'font-weight: bold',
                '✓ asyncOp() [1.0 s]',
                ''
            );

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                4,
                '%c',
                'font-weight: bold',
                '  ✓ asyncOp() [1.0 s]',
                ''
            );
        });

        it('should warn on mismatched async operations', () => {
            const opId = log.tfia('asyncOp1');
            log.tfoa('asyncOp2', opId);

            expect(consoleLogSpy).toHaveBeenNthCalledWith(
                1,
                '%c',
                'font-weight: bold',
                '⟳ asyncOp1()',
                ''
            );

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
            log = new AvLog({ logLevel: 1, logTime: true });
            setupSpies();
        });

        it('should format milliseconds correctly', () => {
            performanceNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1500);
            log.tfi('test');
            log.tfo('test');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c<-- test [500.0 ms]',
                'font-weight: bold'
            );
        });

        it('should format seconds correctly', () => {
            performanceNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(2500);
            log.tfi('test');
            log.tfo('test');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c<-- test [1.500 s]',
                'font-weight: bold'
            );
        });

        it('should format minutes correctly', () => {
            performanceNowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(91000);
            log.tfi('test');
            log.tfo('test');
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '%c<-- test [01:30.0]',
                'font-weight: bold'
            );
        });
    });
});
