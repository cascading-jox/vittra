import { bench } from 'vitest';
import { Vittra } from '../src/vittra';

// Benches measure vittra's own per-call JS overhead, not console I/O. Replace
// every console sink the library writes through with a no-op so the numbers
// reflect the library's work (snapshotting, stack bookkeeping, formatting) and
// not the harness's rendering cost.
const noop = (): void => {};
console.log = noop;
console.group = noop;
console.groupEnd = noop;
console.warn = noop;
console.error = noop;
console.table = noop;

// A typical tiny payload passed to a trace call.
const smallObject = { id: 123, name: 'x' };

// ~100 mixed keys with a little nesting, built once so no bench pays to
// construct it. This is the pathological end of what snapshotValue clones.
const largeObject: Record<string, unknown> = (() => {
    const root: Record<string, unknown> = {};
    for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
            root[`str_${i}`] = `value string number ${i}`;
        } else if (i % 3 === 1) {
            root[`num_${i}`] = i * 7.5;
        } else {
            root[`arr_${i}`] = [i, `item-${i}`, i % 2 === 0];
        }
    }
    root.nested = { a: { b: { c: [1, 2, 3, 'deep'], d: 'nested value' } } };
    return root;
})();

// Instances live outside the measured functions so construction cost never
// leaks into a bench. jsdom's localStorage may be a methodless stub; the
// library tolerates that and the explicit logLevel option wins regardless.
const disabled = new Vittra({ banner: false, logLevel: 0, logTime: true });
const active = new Vittra({ banner: false, logLevel: 2, logTime: true });
// Silent flight recorder: captures at level 0 without printing.
const blackBox = new Vittra({ banner: false, logLevel: 0, logTime: true, blackBox: true });
// Level 2 with a no-op onEntry hook to price the hook dispatch + try/catch.
const withHook = new Vittra({ banner: false, logLevel: 2, logTime: true, onEntry: noop });
// Level 2 with buffering disabled to isolate the ring-push cost of the default.
const noBuffer = new Vittra({ banner: false, logLevel: 2, logTime: true, bufferSize: 0 });
// Level 2 emitting real User Timing spans, to price the mark/measure path.
const perfMarks = new Vittra({ banner: false, logLevel: 2, logTime: true, perfMarks: true });

// --- disabled path: every trace call must early-return in nanoseconds ---

bench('disabled level 0: tf with small object', () => {
    disabled.tf(smallObject);
});

bench('disabled level 0: tfi/tfo pair', () => {
    disabled.tfi('fn', smallObject);
    disabled.tfo('fn', smallObject);
});

// --- level 2: the full-trace path the library actually runs when enabled ---

bench('level 2: tf with small object', () => {
    active.tf(smallObject);
});

bench('level 2: tf with large object', () => {
    active.tf(largeObject);
});

bench('level 2: tfi/tfo pair', () => {
    active.tfi('fn', smallObject);
    active.tfo('fn', smallObject);
});

bench('level 2: tfa op with one buffered log', async () => {
    await active.tfa('op', async (t) => {
        t.tf('step');
        return 1;
    });
});

// --- blackBox: capture while silent pays the snapshot price, prints nothing ---

bench('level 0 blackBox: tf with small object', () => {
    blackBox.tf(smallObject);
});

bench('level 0 blackBox: tf with large object', () => {
    blackBox.tf(largeObject);
});

// --- perfMarks: real performance.mark/measure emitted from emit() ---

// LANDMINE: every measured iteration leaves one real performance.measure in the
// User Timing buffer (tfo clears its start mark but the measure is kept — that
// is the artifact). Across a bench's iterations those measures accumulate
// unbounded (~66 MB per 200k) and can OOM. vitest builds the tinybench Task
// directly and forwards no per-iteration hook, so there is no hook to clear
// from outside the fn; instead the fn drains the buffer every 4096 iterations.
// Cost to honesty: each iteration carries an extra counter increment + bitmask
// compare (~1-2 ns) plus an amortized clearMeasures (a few thousand entries
// cleared once per 4096 calls, sub-nanosecond amortized). The reported number
// therefore slightly OVERSTATES the library's true perfMarks overhead by that
// small constant; a real app pays the mark+measure but never this drain.
let perfMarkBenchCounter = 0;
bench('level 2 + perfMarks: tfi/tfo pair', () => {
    perfMarks.tfi('fn', smallObject);
    perfMarks.tfo('fn', smallObject);
    if ((++perfMarkBenchCounter & 4095) === 0) {
        performance.clearMeasures();
    }
});

// --- capture consumers: onEntry hook cost, and buffer-push cost in isolation ---

bench('level 2 + onEntry noop hook: tf with small object', () => {
    withHook.tf(smallObject);
});

bench('level 2 bufferSize 0: tf with small object', () => {
    noBuffer.tf(smallObject);
});

// --- reference: the structuredClone cost that snapshotValue pays per value ---

bench('reference: structuredClone small object', () => {
    structuredClone(smallObject);
});

bench('reference: structuredClone large object', () => {
    structuredClone(largeObject);
});
