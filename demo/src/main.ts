/* global document, HTMLElement */
import { Vittra } from '../../dist/vittra';

// All loggers are created once, at module scope, so their startup banners print
// on load and every section reuses the same configured instance — the way a real
// app would keep one logger per subsystem.

/** Section 1: an unnamed, fully verbose logger with timing. */
const basics = new Vittra({ logLevel: 2, logTime: true });

/** Section 2: two named loggers that print colored [api] / [ui] badges. */
const apiLog = new Vittra({ name: 'api', logLevel: 2 });
const uiLog = new Vittra({ name: 'ui', logLevel: 2 });

/** Section 3: a timed logger so async durations show in the replay blocks. */
const asyncLog = new Vittra({ name: 'async', logLevel: 2, logTime: true });

/**
 * Section 4: a silent flight recorder. logLevel 0 prints nothing, but blackBox
 * still captures every entry into the ring buffer, and dumpOnError replays that
 * buffer to the console if an uncaught error escapes.
 */
const recorder = new Vittra({
    name: 'rec',
    logLevel: 0,
    blackBox: true,
    dumpOnError: true,
    banner: false,
});

/** Section 5: emits User Timing marks/measures so traces show in the profiler. */
const perfLog = new Vittra({ name: 'perf', logLevel: 2, perfMarks: true, banner: false });

/** Resolve after ms milliseconds — stand-in for real async work. */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Section 1: Basics -------------------------------------------------------

function demoBasicLines(): void {
    basics.tf('plain trace line');
    basics.tfw('a warning');
    basics.tfe('an error');
}

function demoNestedTrace(): void {
    demoOuter(3);
}

function demoOuter(count: number): number {
    basics.tfi('demoOuter', count);
    const doubled = demoInner(count);
    basics.tfo('demoOuter', doubled);
    return doubled;
}

function demoInner(value: number): number {
    basics.tfi('demoInner', value);
    const result = demoLeaf(value) * 2;
    basics.tfo('demoInner', result);
    return result;
}

function demoLeaf(value: number): number {
    basics.tfi('demoLeaf', value);
    const incremented = value + 1;
    basics.tfo('demoLeaf', incremented);
    return incremented;
}

function demoTable(): void {
    basics.tft([
        { id: 1, name: 'Alice', role: 'admin' },
        { id: 2, name: 'Bob', role: 'user' },
        { id: 3, name: 'Carol', role: 'user' },
    ]);
}

// --- Section 2: Namespaces ---------------------------------------------------

function demoInterleavedNamespaces(): void {
    apiLog.tf('GET /users -> 200');
    uiLog.tf('rendered user list');
    apiLog.tfw('slow response (820 ms)');
    uiLog.tf('opened detail panel');
    apiLog.tfe('GET /users/7 -> 500');
    uiLog.tf('showed error toast');
}

// --- Section 3: Async operations ---------------------------------------------

function demoSingleAsync(): Promise<{ id: number; name: string }> {
    return asyncLog.tfa('loadProfile', async (t) => {
        t.tf('requesting profile');
        await delay(400);
        t.tf('parsing response');
        await delay(150);
        return { id: 7, name: 'Alice' };
    });
}

function demoOverlappingAsync(): Promise<[string, string]> {
    // Two operations run at once with different durations. The faster one
    // settles and prints its whole block first; the slower one prints its whole
    // block second. Their internal logs never interleave.
    const slow = asyncLog.tfa('slowFetch', async (t) => {
        t.tf('slow step 1');
        await delay(700);
        t.tf('slow step 2');
        return 'slow done';
    });
    const fast = asyncLog.tfa('fastFetch', async (t) => {
        t.tf('fast step');
        await delay(200);
        return 'fast done';
    });
    return Promise.all([slow, fast]);
}

function demoNestedAsync(): Promise<string> {
    // The child operation is started through the scoped logger `t`, so it nests
    // under the parent and is drawn inline in the parent's replay block.
    return asyncLog.tfa('parentOp', async (t) => {
        t.tf('parent started');
        const childResult = await t.tfa('childOp', async (child) => {
            child.tf('child working');
            await delay(200);
            return 'child result';
        });
        t.tf('parent resumed with ' + childResult);
        await delay(150);
        return 'parent result';
    });
}

async function demoFailingAsync(): Promise<void> {
    // The operation rejects; the ✗ block still prints. Catching it here keeps the
    // page alive — a real caller would handle or rethrow the error.
    try {
        await asyncLog.tfa('riskyOp', async (t) => {
            t.tf('about to fail');
            await delay(150);
            throw new Error('deliberate failure');
        });
    } catch {
        // Swallowed on purpose — the console already shows the failed operation.
    }
}

// --- Section 4: Flight recorder ----------------------------------------------

function recordSilently(): void {
    // logLevel 0 means nothing prints, but blackBox captures each entry.
    recorder.tfi('checkout', { cartId: 42 });
    recorder.tf('validating cart');
    recorder.tfw('coupon expired');
    recorder.tf('charging card');
    recorder.tfo('checkout', { ok: true });
}

function triggerUncaughtError(): void {
    // Thrown from a timer so it escapes as an uncaught error. The recorder's
    // dumpOnError listener replays the buffered entries just before it surfaces.
    setTimeout(() => {
        throw new Error('demo crash');
    });
}

// --- Section 5: Performance timeline -----------------------------------------

async function runPerfWorkload(): Promise<void> {
    perfLog.tfi('computeReport');
    let total = 0;
    for (let i = 0; i < 2_000_000; i++) {
        total += Math.sqrt(i);
    }
    perfLog.tf('finished summation');
    perfLog.tfo('computeReport', Math.round(total));

    await perfLog.tfa('persistReport', async (t) => {
        t.tf('writing report');
        await delay(120);
        return 'saved';
    });
}

// --- UI ----------------------------------------------------------------------

function requireElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (element === null) {
        throw new Error(`missing #${id} element`);
    }
    return element;
}

const app = requireElement('app');

function addSection(title: string): HTMLElement {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = title;
    section.append(heading);
    app.append(section);
    return section;
}

function addButtonRow(section: HTMLElement): HTMLElement {
    const row = document.createElement('div');
    row.className = 'buttons';
    section.append(row);
    return row;
}

function addButton(row: HTMLElement, label: string, handler: () => unknown): void {
    const button = document.createElement('button');
    button.textContent = label;
    button.addEventListener('click', () => {
        void Promise.resolve(handler()).catch((error) => console.error(error));
    });
    row.append(button);
}

function addHint(section: HTMLElement, text: string): void {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = text;
    section.append(hint);
}

function buildBasicsSection(): void {
    const section = addSection('1 · Basics');
    const row = addButtonRow(section);
    addButton(row, 'tf / tfw / tfe', demoBasicLines);
    addButton(row, 'nested tfi/tfo trace', demoNestedTrace);
    addButton(row, 'tft table', demoTable);
    addHint(
        section,
        'Check the source link at the right edge of any console row — with the shipped ' +
            'source-map ignore list it points at this demo file, not vittra.js.',
    );
}

function buildNamespacesSection(): void {
    const section = addSection('2 · Namespaces');
    const row = addButtonRow(section);
    addButton(row, 'interleave [api] + [ui]', demoInterleavedNamespaces);

    const specRow = addButtonRow(section);
    const specInput = document.createElement('input');
    specInput.type = 'text';
    specInput.value = 'api:2,ui:1';
    specInput.size = 16;
    specRow.append(specInput);

    const persistLabel = document.createElement('label');
    const persistCheckbox = document.createElement('input');
    persistCheckbox.type = 'checkbox';
    persistLabel.append(persistCheckbox, document.createTextNode('persist'));
    specRow.append(persistLabel);

    addButton(specRow, 'Apply spec', () => {
        Vittra.setLogLevel(specInput.value, { persist: persistCheckbox.checked });
    });

    addHint(
        section,
        'A spec is the WHOLE configuration: applying api:2,ui:1 also drops every ' +
            'unlisted logger (basics, async, perf, rec) to level 0 until reload. Persist ' +
            'remembers it in localStorage. The same key works in the URL: ?vittraLogLevel=api:2.',
    );
}

function buildAsyncSection(): void {
    const section = addSection('3 · Async operations');
    const row = addButtonRow(section);
    addButton(row, 'single tfa', demoSingleAsync);
    addButton(row, 'two overlapping tfa', demoOverlappingAsync);
    addButton(row, 'nested tfa', demoNestedAsync);
    addButton(row, 'failing tfa', demoFailingAsync);
    addHint(
        section,
        'Each operation prints as one grouped ⟳ … ✓/✗ block only once it settles, so ' +
            'concurrent operations never interleave their internal logs.',
    );
}

function buildFlightRecorderSection(): void {
    const section = addSection('4 · Flight recorder');
    const row = addButtonRow(section);
    const dumpOutput = document.createElement('pre');
    dumpOutput.className = 'dump-output';
    dumpOutput.hidden = true;

    addButton(row, 'record silently', recordSilently);
    addButton(row, 'dump() to page', () => {
        dumpOutput.hidden = false;
        dumpOutput.textContent = recorder.dump() || '(buffer empty — record something first)';
    });
    addButton(row, 'download dump', () => {
        recorder.dump({ download: true });
    });
    addButton(row, 'trigger uncaught error', triggerUncaughtError);

    addHint(
        section,
        'Record first: the console stays silent (level 0). dump() shows the captured ' +
            'tape; the uncaught error makes dumpOnError replay that tape to the console right ' +
            'before the error appears.',
    );
    section.append(dumpOutput);
}

function buildPerfSection(): void {
    const section = addSection('5 · Performance timeline');
    const row = addButtonRow(section);
    addButton(row, 'run workload (tfi/tfo + tfa)', runPerfWorkload);
    addHint(
        section,
        'Start recording in the DevTools Performance panel, click the button, then stop: ' +
            'the traced functions appear as vittra: spans in the Timings track.',
    );
}

buildBasicsSection();
buildNamespacesSection();
buildAsyncSection();
buildFlightRecorderSection();
buildPerfSection();
