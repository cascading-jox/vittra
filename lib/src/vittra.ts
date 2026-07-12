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
     * Namespace label for this instance. When set, every printed line is
     * prefixed with a colored `[name]` badge (color derived from a hash of the
     * name), and the name becomes addressable in level specs — e.g.
     * `Vittra.setLogLevel('api:2,ui:1')` sets this instance's level when name
     * is 'api'. Unnamed instances print exactly as they do without a name.
     */
    name?: string;
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
     * tfa operations are captured too: below level 2 with blackBox on, the
     * async machinery runs in capture-only mode, so the ⟳ entry, every
     * level-suppressed scoped-logger log, and the ✓/✗ completion are all
     * recorded (printed: false) without printing a thing — scoped warnings and
     * errors at level 1 print live instead, as they do everywhere. Every path —
     * tf/tfc/tfw/tfe, tft, tfi/tfo, tfia/tfoa, and tfa — is black-boxed while
     * silent.
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
     * For lines buffered inside a tfa operation, printed records the print
     * gate at buffer time; the block's real print decision is made later, at
     * completion, so a level change mid-operation or a throttled replay can
     * differ from the recorded flag in either direction.
     *
     * Treat the received entry as immutable: it is the same object the ring
     * buffer stores and that may still be about to print, so mutating it alters
     * both the console output and later dump() contents.
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
    /**
     * Rate-limit PRINTED console output to at most this many entries per
     * second, per instance. 0 or undefined (default) disables throttling
     * entirely. A hot loop logging thousands of lines makes DevTools unusable —
     * rendering is the expensive part — so throttling drops the surplus PRINTS
     * while capture is untouched: the ring buffer and the onEntry hook still
     * record every entry (printed: false for suppressed live entries; lines
     * buffered inside a tfa operation keep their buffer-time flag — see
     * onEntry), so dump() stays complete.
     *
     * The window is a fixed 1-second bucket. When a window that suppressed
     * anything rolls over, the next printed entry is preceded by a one-line
     * console.warn summarizing how many entries were dropped and reminding that
     * the buffer kept recording. Structural group closes are never throttled,
     * so console nesting stays balanced; a whole tfa replay block shares one
     * throttle decision, so it prints or suppresses atomically — never
     * half-drawn.
     *
     * Never limits capture, dump(), or onEntry — only what reaches the console.
     * When off (default) the print path pays a single falsy check: no clock
     * read, no allocation. Use it in production hot paths where the buffer with
     * dumpOnError or onEntry is your real record and the live console is only a
     * convenience.
     */
    throttle?: number;
}

/**
 * Scoped logger handed to a tfa callback. Everything logged through it is
 * buffered into that async operation and replayed as one block when the
 * operation completes, so concurrent operations never interleave their logs.
 * Below level 2 (without blackBox) the operation is untracked and every call
 * falls back to live level-gated logging — warnings and errors still print at
 * level 1, exactly like their instance-level counterparts.
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

/**
 * One unit of trace content in raw form. Every gated logging path emits one of
 * these; printEntry() is the sole place that turns them into console output.
 * Values are already snapshotted; timing is carried as raw deltas and durations
 * that printEntry formats.
 */
type LogEntry =
    | {
          kind: 'log';
          level: 'log' | 'clean' | 'warn' | 'error';
          values: unknown[];
          /** Δ-since-last-timer to display; absent means no time suffix */
          delta?: number;
          /** Apply logWithType %o specifiers; live logs only */
          withType?: boolean;
      }
    | { kind: 'table'; data: Record<string, unknown> | Array<unknown>; properties?: string[] }
    // markName: the unique User Timing start mark for this frame, present only
    // while perfMarks is on so emit can pair the entry mark with the exit measure
    | { kind: 'funcEntry'; func: string; values: unknown[]; markName?: string }
    | { kind: 'funcExit'; func: string; values: unknown[]; duration?: number; markName?: string }
    | { kind: 'groupEnd' }
    | { kind: 'asyncStart'; func: string; opId: number; args?: unknown[] }
    | { kind: 'asyncEnd'; func: string; opId: number; values: unknown[]; duration?: number }
    | {
          kind: 'asyncComplete';
          func: string;
          opId: number;
          status: 'done' | 'failed';
          values: unknown[];
          /** Parent id for the ←#n back-reference on a standalone replayed child */
          badgeParent?: number;
          duration?: number;
          /** The rejection value of a failed operation, so dumps carry it */
          error?: unknown;
      }
    | { kind: 'asyncPending'; func: string; opId: number }
    | { kind: 'opError'; error: unknown };

/**
 * A captured trace entry: the raw LogEntry data plus the wall-clock time it
 * was captured and whether it also reached the console. This is what the ring
 * buffer stores, what dump() serializes, and what the onEntry hook receives.
 */
export type VittraLogEntry = LogEntry & {
    /** Epoch milliseconds (Date.now()) at capture time */
    timestamp: number;
    /** True when the entry was written to the console; false for black-boxed captures */
    printed: boolean;
};

interface AsyncOp {
    id: number;
    func: string;
    start: number;
    parent: number | null;
    buffer: BufferedEntry[];
    status: 'pending' | 'done' | 'failed';
    resultValues: unknown[];
    /** True for ops started by the public tfia; managed tfa ops are false */
    manual: boolean;
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

/**
 * One open function frame on the trace stack. printedGroup records whether THIS
 * frame's console.group actually printed at entry — so tfo and reset can close
 * exactly the groups that opened, independent of the level in force when they
 * run. markName is the frame's unique User Timing start mark (perfMarks only).
 */
interface FunctionFrame {
    func: string;
    printedGroup: boolean;
    markName?: string;
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

/** djb2 hash of a string, kept in unsigned 32-bit range */
function hashName(name: string): number {
    let hash = 5381;
    for (let index = 0; index < name.length; index++) {
        // hash * 33 + charCode, coerced back to an unsigned 32-bit integer
        hash = ((hash << 5) + hash + name.charCodeAt(index)) >>> 0;
    }
    return hash;
}

/** Deterministic per-namespace badge style: a stable OP_COLORS pick from the name */
function namespaceStyle(name: string): string {
    return `font-weight: bold; color: ${OP_COLORS[hashName(name) % OP_COLORS.length]}`;
}

/** How many completed operations tfat() keeps for display */
const COMPLETED_OPS_LIMIT = 50;

/** How many pending manual (tfia) operations to keep before evicting the oldest */
const MANUAL_OPS_LIMIT = 100;

/** Length of the fixed rate-limit window, in milliseconds, for the throttle option */
const THROTTLE_WINDOW_MS = 1000;

/** Name of both the URL parameter and the localStorage key for the log level */
const LOG_LEVEL_KEY = 'vittraLogLevel';

/**
 * A parsed level spec. `global` applies to every instance, `wildcard` is the
 * default for any namespace not named explicitly, and `byName` holds
 * per-namespace levels. Any field may be absent, meaning "this spec does not
 * determine that slot".
 */
interface LevelSpec {
    global?: number;
    wildcard?: number;
    byName: Map<string, number>;
}

/** Namespace identifiers accepted in a spec: word chars, dashes, or the `*` wildcard */
const NAMESPACE_IDENT = /^[A-Za-z0-9_-]+$/;

/**
 * Parse a level spec string. Accepts a bare number (`'2'` → global), a
 * comma-separated list of `<name>:<level>` pairs (`'api:2,ui:1'`), and the
 * `*:<level>` wildcard default. Returns null — the spec is ignored entirely —
 * unless every segment is a finite number or `<ident>:<finite number>`.
 */
function parseLevelSpec(raw: string): LevelSpec | null {
    const spec: LevelSpec = { byName: new Map<string, number>() };
    for (const segment of raw.split(',')) {
        const trimmed = segment.trim();
        if (trimmed === '') {
            return null;
        }
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) {
            // A bare segment is the global level
            const level = Number(trimmed);
            if (!Number.isFinite(level)) {
                return null;
            }
            spec.global = level;
            continue;
        }
        const ident = trimmed.slice(0, colonIndex);
        const valueText = trimmed.slice(colonIndex + 1);
        const level = Number(valueText);
        // Number('') is 0, so an empty value must be rejected explicitly
        if (valueText.trim() === '' || !Number.isFinite(level)) {
            return null;
        }
        if (ident === '*') {
            spec.wildcard = level;
        } else if (NAMESPACE_IDENT.test(ident)) {
            spec.byName.set(ident, level);
        } else {
            return null;
        }
    }
    return spec;
}

/** Serialize a spec back to its string form (the inverse of parseLevelSpec) */
function serializeLevelSpec(spec: LevelSpec): string {
    const parts: string[] = [];
    if (spec.global !== undefined) {
        parts.push(String(spec.global));
    }
    if (spec.wildcard !== undefined) {
        parts.push(`*:${spec.wildcard}`);
    }
    for (const [name, level] of spec.byName) {
        parts.push(`${name}:${level}`);
    }
    return parts.join(',');
}

/**
 * Resolve the level a spec assigns to one instance. A named instance prefers
 * its own slot, then the wildcard, then the global; an unnamed instance takes
 * the global, then the wildcard. undefined means the spec is silent about this
 * instance, so the caller should fall through to the next source.
 */
function resolveLevel(spec: LevelSpec, name: string | undefined): number | undefined {
    if (name !== undefined) {
        const named = spec.byName.get(name);
        if (named !== undefined) {
            return named;
        }
        if (spec.wildcard !== undefined) {
            return spec.wildcard;
        }
        return spec.global;
    }
    if (spec.global !== undefined) {
        return spec.global;
    }
    return spec.wildcard;
}

/**
 * Every constructed instance, named or unnamed. Strong references — fine for
 * the page-lifetime logger singletons this library is built for; an instance
 * lives as long as the module. Vittra.setLogLevel iterates this to apply a
 * spec to every instance at once, and every instance participates in global
 * level updates.
 */
const registry: Vittra[] = [];

/** The spec set by Vittra.setLogLevel this session; consulted by new instances */
let runtimeSpec: LevelSpec | null = null;

/**
 * Monotonic source of async operation ids, shared across every instance so a
 * given #<id> is unique console-wide. An instance's reset() never rewinds it —
 * only _resetVittraModuleState does, for tests.
 */
let nextAsyncId = 1;

/**
 * Set once the first eligible instance prints its startup banner, so the banner
 * shows at most once per page load regardless of how many instances exist.
 */
let bannerPrinted = false;

/** @internal Reset all module-level state to pristine — for tests only. */
export function _resetVittraModuleState(): void {
    nextAsyncId = 1;
    bannerPrinted = false;
    runtimeSpec = null;
    registry.length = 0;
}

/** Library version — updated by release automation */
const VITTRA_VERSION = '0.7.1'; // x-release-please-version

/** Winged-badge gradient shared by the startup banner and the dumpOnError header */
const BANNER_STYLE =
    'background:linear-gradient(135deg,#5c6bc0,#26a69a);color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold';

/** One-line startup banner confirming that tracing is active and why */
function printBanner(level: number, levelSource: string, name?: string): void {
    const nameSegment = name !== undefined ? `[${name}] ` : '';
    console.log(
        `%c🪽 vittra%c v${VITTRA_VERSION} · ${nameSegment}level ${level} · via ${levelSource}`,
        BANNER_STYLE,
        'color:#8a8a8a',
    );
}

/**
 * Read a level spec from the vittraLogLevel URL parameter. Returns null when
 * the parameter is absent or the spec is invalid (which is then ignored).
 */
function readUrlLevelSpec(): LevelSpec | null {
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.location?.search &&
            typeof globalThis.URLSearchParams === 'function'
        ) {
            const urlParams = new globalThis.URLSearchParams(globalThis.location.search);
            const param = urlParams.get(LOG_LEVEL_KEY);
            if (param !== null) {
                return parseLevelSpec(param);
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
 * Read a level spec persisted by setLogLevel(..., { persist: true }). Returns
 * null when nothing valid is stored or localStorage is unavailable.
 */
function readPersistedLevelSpec(): LevelSpec | null {
    try {
        const stored = globalThis.localStorage?.getItem(LOG_LEVEL_KEY);
        if (stored != null) {
            return parseLevelSpec(stored);
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
    private functionStack: FunctionFrame[] = []; // Track function entries
    private asyncOps: Map<number, AsyncOp> = new Map();
    private completedOps: CompletedOp[] = [];
    /** Ops in their synchronous start phase — parents for nested tfa calls */
    private currentOpStack: number[] = [];
    /** Capture everything printable at level 2 even while the level suppresses printing */
    private blackBox: boolean;
    /** Fired at capture time for every captured entry; a throwing hook is swallowed */
    private onEntry?: (entry: VittraLogEntry) => void;
    /** Ring-buffer capacity; 0 disables capture entirely */
    private bufferSize: number;
    /** Preallocated ring of captured entries; never shifted, only overwritten */
    private buffer: VittraLogEntry[];
    /** Next slot to write in the ring */
    private bufferWriteIndex: number = 0;
    /** Number of valid entries (caps at bufferSize once the ring has wrapped) */
    private bufferCount: number = 0;
    /** Emit User Timing marks/measures from emit() so traces show in the profiler */
    private perfMarks: boolean;
    /** Monotonic source of unique function span mark names (perfMarks only) */
    private perfMarkCounter: number = 0;
    /** Max printed console entries per 1-second window; 0 disables throttling */
    private throttle: number;
    /** performance.now() timestamp when the current throttle window opened */
    private throttleWindowStart: number = -Infinity;
    /** Prints admitted in the current throttle window */
    private throttlePrinted: number = 0;
    /** Prints suppressed in the current window; drives the rollover summary */
    private throttleSuppressed: number = 0;
    /** Namespace label; addressable in level specs and shown as a badge */
    private readonly name?: string;
    /** `%c[name]` format segment prepended to every printed line ('' when unnamed) */
    private nameBadge: string = '';
    /** The style(s) for nameBadge, spread before each line's own style ([] when unnamed) */
    private nameBadgeStyle: string[] = [];

    constructor(options: VittraOptions = {}) {
        this.name = options.name;
        // A named instance prepends a colored %c[name] segment to every printed
        // line. Unnamed instances keep an empty badge and no extra style, so
        // '' + format and ...[] leave the console call byte-for-byte unchanged.
        if (this.name !== undefined) {
            this.nameBadge = `%c[${this.name}]`;
            this.nameBadgeStyle = [namespaceStyle(this.name)];
        }

        // Resolution order (highest first): URL spec > constructor option >
        // runtime spec (Vittra.setLogLevel this session) > persisted spec > 0.
        // A spec silent about this instance (resolves undefined) falls through.
        const urlSpec = readUrlLevelSpec();
        const persistedSpec = readPersistedLevelSpec();
        const urlLevel = urlSpec !== null ? resolveLevel(urlSpec, this.name) : undefined;
        // A runtime spec (Vittra.setLogLevel this session) is the whole
        // configuration once set: an instance it does not mention resolves to 0
        // and never falls through to the persisted spec — including instances
        // constructed after the spec was set.
        const runtimeLevel =
            runtimeSpec !== null ? (resolveLevel(runtimeSpec, this.name) ?? 0) : undefined;
        const persistedLevel =
            persistedSpec !== null ? resolveLevel(persistedSpec, this.name) : undefined;

        let levelSource = 'option';
        if (urlLevel !== undefined) {
            this.logLevel = urlLevel;
            levelSource = 'url parameter';
        } else if (options.logLevel !== undefined) {
            this.logLevel = options.logLevel;
        } else if (runtimeLevel !== undefined) {
            this.logLevel = runtimeLevel;
            levelSource = 'runtime';
        } else if (persistedLevel !== undefined) {
            this.logLevel = persistedLevel;
            levelSource = 'localStorage';
        } else {
            this.logLevel = 0;
        }

        this.logTime = options.logTime || false;
        this.logWithType = options.logWithType || false;
        this.boldStyle = 'font-weight: bold';
        this.timers = [];

        this.blackBox = options.blackBox === true;
        this.onEntry = options.onEntry;
        // One-time feature check: an engine lacking the User Timing options form
        // disables perf integration entirely, so emit's hot path never probes it
        this.perfMarks =
            options.perfMarks === true &&
            typeof performance !== 'undefined' &&
            typeof performance.mark === 'function' &&
            typeof performance.measure === 'function';
        // Any non-positive or non-finite size disables buffering
        const requestedSize = options.bufferSize;
        this.bufferSize =
            requestedSize === undefined
                ? 300
                : Number.isFinite(requestedSize) && requestedSize > 0
                  ? Math.floor(requestedSize)
                  : 0;
        this.buffer = this.bufferSize > 0 ? new Array(this.bufferSize) : [];

        // Any non-positive or non-finite limit disables throttling
        const requestedThrottle = options.throttle;
        this.throttle =
            requestedThrottle !== undefined &&
            Number.isFinite(requestedThrottle) &&
            requestedThrottle > 0
                ? Math.floor(requestedThrottle)
                : 0;

        if (options.dumpOnError === true) {
            this.registerErrorListeners();
        }

        // Register so Vittra.setLogLevel can reach this instance later
        registry.push(this);

        // Startup banner, once per page load: the first eligible instance
        // (level >= 1, banner not suppressed) prints it and claims the flag;
        // later instances stay silent. A banner: false instance never prints
        // and never claims the flag, so a later eligible instance still shows
        // it. A named instance shows its badge in the banner text.
        if (this.logLevel >= 1 && options.banner !== false && !bannerPrinted) {
            printBanner(this.logLevel, levelSource, this.name);
            bannerPrinted = true;
        }
    }

    /**
     * Change the log level at runtime, e.g. to escalate tracing when a
     * suspected bug condition is hit.
     * @param level The new log level (0 disables logging)
     * @param options Set persist to true to remember the level in localStorage
     *                across page loads. Persisting merges into the shared spec:
     *                this instance's slot is written (a named instance as
     *                `name:level`, an unnamed one as the global level) without
     *                touching other namespaces. Persisting 0 writes an explicit
     *                0 so a `*` wildcard or global default can't re-enable this
     *                instance next load; the stored key is cleared only when
     *                nothing but that bare 0 remains.
     *
     * Example:
     * ```typescript
     * if (value === suspectedBugValue) {
     *     log.setLogLevel(3); // this session only
     * }
     * log.setLogLevel(2, { persist: true }); // remembered across reloads
     * log.setLogLevel(0, { persist: true }); // off; key cleared if nothing else persisted
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
        this.persistOwnLevel(level);
    }

    /**
     * Persist just this instance's slot into the shared spec, leaving every
     * other namespace's persisted level untouched. Merges into the stored spec
     * rather than overwriting it, so one instance never wipes another's level.
     * A named instance owns its `name` slot, an unnamed instance the global
     * slot. Level 0 is written explicitly (not removed) so a wildcard or global
     * default can't re-enable this instance next load; the key is cleared only
     * when the whole spec reduces to a bare global 0.
     */
    private persistOwnLevel(level: number): void {
        try {
            const stored = globalThis.localStorage?.getItem(LOG_LEVEL_KEY);
            const spec: LevelSpec = (stored != null ? parseLevelSpec(stored) : null) ?? {
                byName: new Map<string, number>(),
            };
            if (this.name !== undefined) {
                spec.byName.set(this.name, level);
            } else {
                spec.global = level;
            }
            const serialized = serializeLevelSpec(spec);
            // A bare global 0 means "off and nothing else remembered" — forget it
            // entirely; any other spec (an explicit name:0, or 0 alongside a
            // wildcard) is stored so the explicit 0 survives to beat that default.
            if (serialized === '' || serialized === '0') {
                globalThis.localStorage?.removeItem(LOG_LEVEL_KEY);
            } else {
                globalThis.localStorage?.setItem(LOG_LEVEL_KEY, serialized);
            }
        } catch {
            // localStorage unavailable — the level still applies in memory
        }
    }

    /**
     * Set log levels across every instance from a spec. A spec is a
     * comma-separated list mixing a bare number for the global level,
     * `<name>:<level>` pairs, and a `*:<level>` wildcard default — e.g.
     * `'api:2,ui:1'` or `'*:1,api:2'`. A plain number sets the global level.
     * An invalid spec is ignored entirely. Each registered instance is set to
     * its resolved level, or 0 when the spec does not mention it — with a spec
     * string the spec is the whole configuration.
     *
     * @param spec A level spec string, or a number for a global level
     * @param options Set persist to true to remember the raw spec in
     *                localStorage; a plain 0 clears the remembered value.
     *
     * Example:
     * ```typescript
     * Vittra.setLogLevel('api:2,ui:1');                 // per-namespace
     * Vittra.setLogLevel('*:1,api:2', { persist: true }); // wildcard + override
     * ```
     */
    static setLogLevel(spec: string | number, options: { persist?: boolean } = {}): void {
        const parsed =
            typeof spec === 'number'
                ? Number.isFinite(spec)
                    ? { byName: new Map<string, number>(), global: spec }
                    : null
                : parseLevelSpec(spec);
        if (parsed === null) {
            return;
        }
        runtimeSpec = parsed;
        // The spec is the whole configuration: an instance it does not mention
        // drops to 0, matching how the debug package's DEBUG variable behaves.
        for (const instance of registry) {
            instance.logLevel = resolveLevel(parsed, instance.name) ?? 0;
        }
        if (options.persist === true) {
            Vittra.persistRawSpec(spec);
        }
    }

    /**
     * Persist the raw spec string for the static setter. A plain 0 clears the
     * remembered value (the existing "off is forgotten" semantic); any other
     * spec is stored verbatim.
     */
    private static persistRawSpec(spec: string | number): void {
        try {
            const raw = typeof spec === 'number' ? String(spec) : spec;
            if (raw.trim() === '0') {
                globalThis.localStorage?.removeItem(LOG_LEVEL_KEY);
            } else {
                globalThis.localStorage?.setItem(LOG_LEVEL_KEY, raw);
            }
        } catch {
            // localStorage unavailable — the spec still applies in memory
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
     * Snapshot table data for the ring/hook. A clone of a Record or Array keeps
     * that shape; the fallback returns the live reference (also the right type),
     * so the cast is safe and lets console.table keep receiving the live object.
     */
    private snapshotTableData(
        data: Record<string, unknown> | Array<unknown>,
    ): Record<string, unknown> | Array<unknown> {
        return this.snapshotValue(data) as Record<string, unknown> | Array<unknown>;
    }

    /**
     * Translate a live tf/tfc/tfw/tfe call into an emitted log entry.
     */
    private logToConsole(mode: 'tf' | 'tfc' | 'tfw' | 'tfe', valuesToLog: unknown[]): void {
        // Level 1 shows warnings and errors only; plain logs need level 2
        const requiredLevel = mode === 'tfw' || mode === 'tfe' ? 1 : 2;
        const print = this.logLevel >= requiredLevel;
        // Disabled path: return before any work unless black-boxing captures silently
        if (!print && !this.blackBox) return;

        const level =
            mode === 'tfc' ? 'clean' : mode === 'tfw' ? 'warn' : mode === 'tfe' ? 'error' : 'log';
        let delta: number | undefined;
        const lastTimer = this.timers[this.timers.length - 1];
        if (this.logTime && typeof lastTimer === 'number') {
            delta = performance.now() - lastTimer;
        }
        this.emit(
            {
                kind: 'log',
                level,
                values: this.snapshot(valuesToLog),
                delta,
                withType: this.logWithType,
            },
            { print },
        );
    }

    /**
     * The one ingress for trace content. Every gated logging path funnels its
     * raw entry through here. capture routes it into the ring buffer and the
     * onEntry hook; print routes it to the console. Live paths do both; replay
     * and presentation-only paths print without re-capturing; black-boxed
     * captures capture without printing.
     */
    private emit(
        entry: LogEntry,
        options: { print?: boolean; capture?: boolean; throttleForced?: boolean } = {},
    ): boolean {
        let print = options.print ?? true;
        const capture = options.capture ?? true;
        // Fire spans for every entry that reaches emit — printed, captured, or
        // both — so black-boxed traces still profile. A single flag when off.
        if (this.perfMarks) {
            this.applyPerfMark(entry);
        }
        // Throttle the PRINT path only (capture/onEntry are never affected). Off
        // (this.throttle === 0) short-circuits here, so the disabled path is one
        // falsy check — no clock read, no allocation. A groupEnd is structural: a
        // printed group's close must never be throttled or the console nests
        // forever. A replay block passes throttleForced so its lines share the
        // header's single decision and the block cannot tear mid-replay.
        if (print && this.throttle && entry.kind !== 'groupEnd') {
            const forced = options.throttleForced;
            if (forced === undefined) {
                print = this.throttleAdmit();
            } else {
                if (forced) {
                    this.throttlePrinted++;
                } else {
                    this.throttleSuppressed++;
                }
                print = forced;
            }
        }
        if (capture) {
            this.capture(entry, print);
        }
        if (print) {
            this.printEntry(entry);
        }
        return print;
    }

    /**
     * The live throttle decision for one printed entry. Rolls the fixed
     * 1-second window when it has elapsed — first emitting the suppression
     * summary for a completed window that hid anything — then admits the entry
     * while the window still has room, counting it as printed or suppressed.
     * Only ever reached on the print path with the throttle active, so its
     * clock read is never paid when throttling is off.
     */
    private throttleAdmit(): boolean {
        const now = performance.now();
        if (now - this.throttleWindowStart >= THROTTLE_WINDOW_MS) {
            if (this.throttleSuppressed > 0) {
                this.printThrottleSummary(this.throttleSuppressed);
            }
            this.throttleWindowStart = now;
            this.throttlePrinted = 0;
            this.throttleSuppressed = 0;
        }
        if (this.throttlePrinted < this.throttle) {
            this.throttlePrinted++;
            return true;
        }
        this.throttleSuppressed++;
        return false;
    }

    /**
     * Announce a throttle window that suppressed prints, once, as the next
     * window opens. A direct console.warn — a deliberate egress exception, like
     * the banner and tfat — because routing a meta-notice through emit would
     * itself be throttled or captured. Reassures that the ring buffer kept
     * recording, so dump() remains complete.
     */
    private printThrottleSummary(suppressed: number): void {
        const nameSegment = this.name !== undefined ? `[${this.name}] ` : '';
        const noun = suppressed === 1 ? 'entry' : 'entries';
        console.warn(
            `%c${nameSegment}vittra throttle: suppressed ${suppressed} console ${noun} in the last second (buffer kept recording)`,
            this.boldStyle,
        );
    }

    /**
     * Turn an entry into User Timing activity: funcEntry/asyncStart open a span
     * (a mark), funcExit/asyncEnd/asyncComplete close it (a measure that clears
     * its start mark). Every other kind is span-less. All perf calls are
     * best-effort and swallow failures — logging must never break on them.
     */
    private applyPerfMark(entry: LogEntry): void {
        switch (entry.kind) {
            case 'funcEntry':
                if (entry.markName !== undefined) {
                    try {
                        performance.mark(entry.markName);
                    } catch {
                        // Perf integration is best-effort
                    }
                }
                break;
            case 'funcExit':
                if (entry.markName !== undefined) {
                    this.measureFunc(entry.func, entry.markName);
                }
                break;
            case 'asyncStart':
                this.markOpStart(entry.opId);
                break;
            case 'asyncEnd':
                // Manual tfoa measures at exit — op.duration is known here.
                this.measureOp(entry.func, entry.opId, { opId: entry.opId });
                break;
            // asyncComplete carries no measure: managed ops measure in completeOp,
            // at completion time, so a nested child records its own duration
            // rather than the (later) parent-replay time this entry is emitted at.
            // log, table, groupEnd, asyncPending, opError carry no span
        }
    }

    /** Open the span for an async operation at its start (mark name is opId-unique) */
    private markOpStart(opId: number): void {
        try {
            performance.mark(`vittra-op-${opId}`);
        } catch {
            // Perf integration is best-effort
        }
    }

    /** Drop an op's un-consumed start mark (op evicted or reset before completion) */
    private clearOpStartMark(opId: number): void {
        try {
            performance.clearMarks(`vittra-op-${opId}`);
        } catch {
            // Perf integration is best-effort
        }
    }

    /**
     * Close a function span: measure from its start mark, then clear the mark.
     * The measure name repeats across recursive frames by design; only the
     * unique start mark keeps their spans from colliding.
     */
    private measureFunc(func: string, markName: string): void {
        try {
            performance.measure(`vittra: ${func}`, { start: markName });
            performance.clearMarks(markName);
        } catch {
            // Older engines lack the options form of measure — skip silently
        }
    }

    /**
     * Close an async-operation span. Measures only when the start mark still
     * exists, so an op whose mark was already consumed (a replay re-visiting it)
     * produces no second measure rather than relying on a thrown duplicate.
     */
    private measureOp(func: string, opId: number, detail: Record<string, unknown>): void {
        const markName = `vittra-op-${opId}`;
        try {
            if (performance.getEntriesByName(markName, 'mark').length === 0) {
                return;
            }
            performance.measure(`vittra: ${func} #${opId}`, { start: markName, detail });
            performance.clearMarks(markName);
        } catch {
            // Older engines lack the options form of measure — skip silently
        }
    }

    /**
     * Record an entry into the ring buffer and fire the onEntry hook. Mutates
     * the passed entry in place with its capture metadata — every call site
     * builds a fresh entry, so there is no aliasing to worry about, and it
     * avoids a per-call copy. printed carries whether the entry also reached
     * the console.
     */
    private capture(entry: LogEntry, printed: boolean): void {
        // Nothing consumes captures — stay allocation-free
        if (this.bufferSize <= 0 && this.onEntry === undefined) return;

        const captured = entry as VittraLogEntry;
        captured.timestamp = Date.now();
        captured.printed = printed;

        if (this.bufferSize > 0) {
            this.buffer[this.bufferWriteIndex] = captured;
            this.bufferWriteIndex = (this.bufferWriteIndex + 1) % this.bufferSize;
            if (this.bufferCount < this.bufferSize) {
                this.bufferCount++;
            }
        }

        if (this.onEntry !== undefined) {
            try {
                this.onEntry(captured);
            } catch {
                // A throwing hook must never break logging or the app
            }
        }
    }

    /** Snapshot the ring's contents oldest → newest, skipping unfilled slots */
    private orderedBuffer(): VittraLogEntry[] {
        if (this.bufferSize <= 0 || this.bufferCount === 0) return [];
        const ordered: VittraLogEntry[] = [];
        if (this.bufferCount < this.bufferSize) {
            for (let i = 0; i < this.bufferCount; i++) {
                ordered.push(this.buffer[i]);
            }
        } else {
            // Wrapped: the oldest live entry sits at the write cursor
            for (let i = 0; i < this.bufferSize; i++) {
                ordered.push(this.buffer[(this.bufferWriteIndex + i) % this.bufferSize]);
            }
        }
        return ordered;
    }

    /**
     * The one egress for trace content: the sole method that touches console.*
     * and the group-indentation stack. It owns all presentation — prefixes, op
     * colors, comma interspersing, %o type specifiers, and time suffixes.
     *
     * Four paths deliberately bypass this egress and call console directly: the
     * startup banner (printBanner), the operation table (tfat), the crash dump
     * (printErrorDump, documented at its own definition), and the throttle
     * rollover summary (printThrottleSummary) — each a meta-notice that must
     * neither be captured nor rate-limited alongside real trace content.
     */
    private printEntry(entry: LogEntry): void {
        // Named instances prepend a %c[name] badge to every line; unnamed
        // instances carry an empty badge and no extra style, leaving each
        // console call identical to the un-namespaced output.
        const badge = this.nameBadge;
        const badgeStyle = this.nameBadgeStyle;
        switch (entry.kind) {
            case 'log': {
                const prefix = entry.level === 'clean' ? '' : '+ ';
                // Space-separated %o specifiers so multiple values render apart,
                // matching how the console spaces native arguments
                const nOs = entry.withType ? entry.values.map(() => '%o').join(' ') : '';
                const timeSuffix =
                    entry.delta !== undefined ? [`  [Δ ${this.formatTime(entry.delta)}]`] : [];
                const format = `${badge}%c${prefix}${nOs}`;
                if (entry.level === 'warn') {
                    console.warn(
                        format,
                        ...badgeStyle,
                        this.boldStyle,
                        ...entry.values,
                        ...timeSuffix,
                    );
                } else if (entry.level === 'error') {
                    console.error(
                        format,
                        ...badgeStyle,
                        this.boldStyle,
                        ...entry.values,
                        ...timeSuffix,
                    );
                } else {
                    console.log(
                        format,
                        ...badgeStyle,
                        this.boldStyle,
                        ...entry.values,
                        ...timeSuffix,
                    );
                }
                break;
            }
            case 'table':
                console.table(entry.data, entry.properties);
                break;
            case 'funcEntry':
                console.group(
                    `${badge}%c--> ${entry.func}(`,
                    ...badgeStyle,
                    this.boldStyle,
                    ...intersperseCommas(entry.values),
                    ')',
                );
                break;
            case 'funcExit': {
                // The group close is emitted separately (as a groupEnd) so it can
                // follow the frame's own printedGroup, independent of this line.
                const runtime =
                    entry.duration !== undefined ? ` [${this.formatTime(entry.duration)}]` : '';
                if (entry.values.length > 0) {
                    console.log(
                        `${badge}%c<-- ${entry.func}${runtime} =`,
                        ...badgeStyle,
                        this.boldStyle,
                        ...intersperseCommas(entry.values),
                    );
                } else {
                    console.log(
                        `${badge}%c<-- ${entry.func}${runtime}`,
                        ...badgeStyle,
                        this.boldStyle,
                    );
                }
                break;
            }
            case 'groupEnd':
                console.groupEnd();
                break;
            case 'asyncStart': {
                const style = this.opStyle(entry.opId);
                if (entry.args === undefined) {
                    console.log(`${badge}%c⟳ ${entry.func} #${entry.opId}`, ...badgeStyle, style);
                } else if (entry.args.length > 0) {
                    console.log(
                        `${badge}%c⟳ ${entry.func} #${entry.opId} (`,
                        ...badgeStyle,
                        style,
                        ...intersperseCommas(entry.args),
                        ')',
                    );
                } else {
                    console.log(
                        `${badge}%c⟳ ${entry.func} #${entry.opId} ()`,
                        ...badgeStyle,
                        style,
                    );
                }
                break;
            }
            case 'asyncEnd': {
                const style = this.opStyle(entry.opId);
                const runtime =
                    entry.duration !== undefined ? ` [${this.formatTime(entry.duration)}]` : '';
                if (entry.values.length > 0) {
                    console.log(
                        `${badge}%c✓ ${entry.func} #${entry.opId}${runtime} =`,
                        ...badgeStyle,
                        style,
                        ...intersperseCommas(entry.values),
                    );
                } else {
                    console.log(
                        `${badge}%c✓ ${entry.func} #${entry.opId}${runtime}`,
                        ...badgeStyle,
                        style,
                    );
                }
                break;
            }
            case 'asyncComplete': {
                const style = this.opStyle(entry.opId);
                const mark = entry.status === 'failed' ? '✗' : '✓';
                const parentBadge =
                    entry.badgeParent !== undefined ? ` ←#${entry.badgeParent}` : '';
                const runtime =
                    entry.duration !== undefined ? ` [${this.formatTime(entry.duration)}]` : '';
                const header = `${badge}%c${mark} ${entry.func} #${entry.opId}${parentBadge}${runtime}`;
                if (entry.values.length > 0) {
                    console.group(`${header} =`, ...badgeStyle, style, ...entry.values);
                } else {
                    console.group(header, ...badgeStyle, style);
                }
                break;
            }
            case 'asyncPending':
                console.log(
                    `${badge}%c⟳ ${entry.func} #${entry.opId} (pending)`,
                    ...badgeStyle,
                    this.opStyle(entry.opId),
                );
                break;
            case 'opError':
                console.error(entry.error);
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
        const opId = nextAsyncId++;
        const print = this.logLevel >= 2;
        if (!print && !this.blackBox) return opId;

        this.asyncOps.set(opId, {
            id: opId,
            func,
            start: performance.now(),
            parent: null,
            buffer: [],
            status: 'pending',
            resultValues: [],
            manual: true,
        });
        this.evictOrphanedManualOps();

        this.emit({ kind: 'asyncStart', func, opId, args: this.snapshot(args) }, { print });

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
        const print = this.logLevel >= 2;
        const op = this.asyncOps.get(opId);
        if (!op || op.func !== func) {
            // A pair that ran untracked (tfia below level 2 without blackBox)
            // legitimately has no registered op — warning would flag correct code
            if (!print && !this.blackBox) return;
            this.tfw(`Warning: tfoa called for '${func}' (ID: ${opId}) but no matching tfia found`);
            return;
        }

        // The op was registered, so the bookkeeping always completes — even when
        // the level has since dropped — or it would linger pending forever and
        // checkUnclosedAsyncOps would flag a tfoa that DID arrive. Only the
        // printed line and its capture follow the current gates; the perf span
        // still closes so a profile keeps the op's true duration.
        const duration = performance.now() - op.start;
        if (print || this.blackBox) {
            this.emit(
                {
                    kind: 'asyncEnd',
                    func,
                    opId,
                    values: this.snapshot(returnValues),
                    duration: this.logTime ? duration : undefined,
                },
                { print },
            );
        } else if (this.perfMarks) {
            this.measureOp(func, opId, { opId });
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
     * Below level 2 (without blackBox) the operation runs untracked: no ⟳/✓
     * output and no buffering, but scoped tfw/tfe still print at level 1,
     * exactly like their instance-level counterparts.
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
        // Below level 2 with blackBox off, the op is a pure passthrough — no id,
        // no tracking, zero overhead; the scoped logger falls back to live
        // level-gated logging so warnings and errors still honor level 1. With
        // blackBox on, the real machinery runs in capture-only mode: the entry,
        // every level-suppressed scoped-logger log, and the completion are all
        // recorded (printed: false) so the flight recorder sees inside silent
        // operations. Prints stay gated on the level.
        if (this.logLevel < 2 && !this.blackBox) {
            if (typeof fnOrPromise === 'function') {
                return Promise.resolve(fnOrPromise(this.untrackedOpLogger));
            }
            return Promise.resolve(fnOrPromise);
        }

        const opId = nextAsyncId++;
        const op: AsyncOp = {
            id: opId,
            func,
            start: performance.now(),
            parent: parentId,
            buffer: [],
            status: 'pending',
            resultValues: [],
            manual: false,
        };
        this.asyncOps.set(opId, op);

        // Entry line: recorded inside a pending parent, printed live otherwise
        const parent = parentId !== null ? this.asyncOps.get(parentId) : undefined;
        if (parent && parent.status === 'pending') {
            parent.buffer.push({ kind: 'child', childId: opId });
            // Inline children never emit asyncStart (their entry is drawn at the
            // parent's replay), so open their span here where the op truly starts
            if (this.perfMarks) {
                this.markOpStart(opId);
            }
        } else {
            op.parent = null;
            // The entry prints only at level 2; a silent blackBox start captures
            // it (printed: false) without a live ⟳ line.
            this.emit({ kind: 'asyncStart', func, opId }, { print: this.logLevel >= 2 });
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

        // Measure the op span now, when its real duration is known — not at
        // replay/emit time, which for a child settled inside a still-pending
        // parent is the parent's later replay (recording the parent's duration).
        if (this.perfMarks) {
            this.measureOp(op.func, op.id, {
                opId: op.id,
                status,
                parent: op.parent ?? undefined,
            });
        }

        const parent = op.parent !== null ? this.asyncOps.get(op.parent) : undefined;
        if (parent && parent.status === 'pending') {
            return; // replayed inline when the parent completes
        }
        // Replay at completion time: the level NOW decides whether the block
        // prints, so an op that started silent under blackBox but escalated
        // before settling prints its replay. blackBox keeps replaying
        // (capture-only, printed: false) while silent; without it a level that
        // dropped below 2 skips replay entirely, exactly as before.
        if (this.logLevel >= 2 || this.blackBox) {
            this.replayOp(op, true, this.logLevel >= 2);
        }
        this.asyncOps.delete(op.id);
    }

    /**
     * Replay a completed operation's block: header, buffered lines in order,
     * completed children inlined as nested blocks at their start position. print
     * gates every console write — false replays a blackBox op silently, still
     * capturing the completion (printed: false) but printing nothing. The
     * completion header is the only entry captured here; everything else was
     * captured at buffer time and replays print-only.
     *
     * When throttling is active the header makes one throttle decision for the
     * whole block; that fate is forced onto every line and threaded to nested
     * children via `forced`, so a rate-limited replay prints or suppresses
     * atomically and never tears.
     */
    private replayOp(op: AsyncOp, standalone: boolean, print: boolean, forced?: boolean): void {
        // The header carries the block's throttle fate: at a block root (forced
        // undefined) emit decides live and returns whether it printed; a nested
        // inline child receives that fate as `forced` and reuses it. With
        // throttle off, forced is unused and this behaves exactly as before.
        const printed = this.emit(
            {
                kind: 'asyncComplete',
                func: op.func,
                opId: op.id,
                status: op.status === 'failed' ? 'failed' : 'done',
                values: op.resultValues,
                badgeParent: standalone && op.parent !== null ? op.parent : undefined,
                duration: this.logTime && op.duration !== undefined ? op.duration : undefined,
                error: op.status === 'failed' ? op.error : undefined,
            },
            { print, throttleForced: forced },
        );
        // Below the header, force every emit to the header's fate. undefined when
        // throttle is off leaves emit's normal zero-cost path in place.
        const blockForced = this.throttle ? printed : undefined;

        // Buffered content was captured at buffer time; replay only prints it
        for (const entry of op.buffer) {
            if (entry.kind === 'log') {
                this.emit(
                    {
                        kind: 'log',
                        level: entry.level,
                        values: entry.values,
                        delta: this.logTime ? entry.delta : undefined,
                    },
                    { print, capture: false, throttleForced: blockForced },
                );
            } else if (entry.kind === 'table') {
                this.emit(
                    { kind: 'table', data: entry.data, properties: entry.properties },
                    { print, capture: false, throttleForced: blockForced },
                );
            } else {
                const child = this.asyncOps.get(entry.childId);
                if (child && child.status !== 'pending') {
                    this.replayOp(child, false, print, blockForced);
                    this.asyncOps.delete(child.id);
                } else if (child) {
                    this.emit(
                        { kind: 'asyncPending', func: child.func, opId: child.id },
                        { print, capture: false, throttleForced: blockForced },
                    );
                }
            }
        }

        if (op.status === 'failed' && op.error !== undefined) {
            this.emit(
                { kind: 'opError', error: op.error },
                { print, capture: false, throttleForced: blockForced },
            );
        }
        // groupEnd is structural (throttle-exempt); close iff the block printed.
        this.emit({ kind: 'groupEnd' }, { print: printed, capture: false });
    }

    private createOpLogger(op: AsyncOp): VittraOpLogger {
        return {
            tf: (...values: unknown[]) => this.bufferLog(op, 'log', values),
            tfc: (...values: unknown[]) => this.bufferLog(op, 'clean', values),
            tfw: (...values: unknown[]) => this.bufferLog(op, 'warn', values),
            tfe: (...values: unknown[]) => this.bufferLog(op, 'error', values),
            tft: (data: Record<string, unknown> | Array<unknown>, properties?: string[]) => {
                const print = this.logLevel >= 2;
                if (!print && !this.blackBox) return;
                if (op.status === 'pending') {
                    // Buffer keeps the LIVE object for the replay console.table;
                    // the ring copy is snapshotted so a later mutation of the
                    // object can't rewrite what dump()/onEntry report.
                    op.buffer.push({ kind: 'table', data, properties });
                    // Chronological truth: capture at buffer time, not at replay.
                    // printed reflects the level now (false under a silent blackBox).
                    this.capture(
                        { kind: 'table', data: this.snapshotTableData(data), properties },
                        print,
                    );
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
        const print = this.logLevel >= requiredLevel;
        // Disabled path: drop before any work unless black-boxing buffers silently
        if (!print && !this.blackBox) return;
        // Live fallbacks: an operation already replayed can't buffer anymore, and
        // a warning/error admitted below level 2 must print NOW, exactly like its
        // instance-level counterpart — the completion block never prints at this
        // level, so buffering it would swallow what level 1 promises to show.
        if (op.status !== 'pending' || (print && this.logLevel < 2)) {
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
        const snapshotted = this.snapshot(values);
        op.buffer.push({
            kind: 'log',
            level,
            values: snapshotted,
            delta: performance.now() - op.start,
        });
        // Chronological truth: capture at buffer time, not at the later replay.
        // printed reflects the level now: a live level-2 buffer captures
        // printed: true, a silent blackBox buffer printed: false.
        this.capture({ kind: 'log', level, values: snapshotted }, print);
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

    /**
     * Bound the pending-ops map against a tfia whose tfoa never arrives. Such an
     * op would otherwise linger until reset(); once the pending manual count
     * passes the cap the oldest is dropped, so a later tfoa for it hits the
     * normal "no matching tfia" path. Managed tfa operations are never counted
     * or evicted here.
     */
    private evictOrphanedManualOps(): void {
        let pendingManual = 0;
        let oldest: AsyncOp | undefined;
        for (const op of this.asyncOps.values()) {
            if (!op.manual || op.status !== 'pending') continue;
            pendingManual++;
            if (oldest === undefined) {
                oldest = op;
            }
        }
        if (pendingManual > MANUAL_OPS_LIMIT && oldest !== undefined) {
            // The evicted op will never measure — drop its stranded start mark
            if (this.perfMarks) {
                this.clearOpStartMark(oldest.id);
            }
            this.asyncOps.delete(oldest.id);
            this.tfw(
                `Warning: evicting orphaned async operation ${oldest.func} #${oldest.id} after ${MANUAL_OPS_LIMIT} pending manual operations without a matching tfoa`,
            );
        }
    }

    private opStyle(opId: number): string {
        return `font-weight: bold; color: ${OP_COLORS[opId % OP_COLORS.length]}`;
    }

    /**
     * Scoped logger for operations the machinery is not tracking (below level 2
     * without blackBox). Every call falls back to the instance's live,
     * level-gated logging: trace content stays dropped below level 2, while
     * warnings and errors keep printing at level 1 exactly as instance-level
     * tfw/tfe do. Nested tfa calls still run (untracked, parentless).
     */
    private untrackedOpLogger: VittraOpLogger = {
        tf: (...values: unknown[]) => this.logToConsole('tf', values),
        tfc: (...values: unknown[]) => this.logToConsole('tfc', values),
        tfw: (...values: unknown[]) => this.logToConsole('tfw', values),
        tfe: (...values: unknown[]) => this.logToConsole('tfe', values),
        tft: (data: Record<string, unknown> | Array<unknown>, properties?: string[]) =>
            this.tft(data, properties),
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
        const print = this.logLevel >= 2;
        if (!print && !this.blackBox) return;

        // A per-call unique mark name keeps recursive/same-name frames distinct.
        let markName: string | undefined;
        if (this.perfMarks) {
            markName = `vittra-fn-${++this.perfMarkCounter}`;
        }

        // Track the frame even while black-boxing so tfo still pairs correctly.
        // printedGroup records whether this frame's console.group actually
        // printed, so tfo/reset can close exactly the groups that opened.
        const frame: FunctionFrame = { func, printedGroup: print, markName };
        this.functionStack.push(frame);

        if (this.logTime === true) {
            this.timers.push(performance.now());
        }

        // emit returns whether the group actually printed. A throttle-suppressed
        // funcEntry never opened its console.group, so record that as the frame's
        // printedGroup: the matching tfo/reset then closes exactly the groups
        // that opened, and a suppressed entry's group is naturally never closed.
        frame.printedGroup = this.emit(
            { kind: 'funcEntry', func, values: this.snapshot(callerArgs), markName },
            { print },
        );
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
        const print = this.logLevel >= 2;
        // Fast disabled path: nothing to print or capture AND no frames to close.
        // A non-empty stack (frames opened before the level dropped) still needs
        // its groups closed, so only bail when the stack is also empty.
        if (!print && !this.blackBox && this.functionStack.length === 0) return;

        if (!this.functionStack.some((frame) => frame.func === func)) {
            this.tfw(`Warning: tfo called for '${func}' but no matching tfi found`);
            return;
        }

        // Close functions left open above this one (e.g. early returns without a tfo)
        // so one missing tfo does not skew the indentation of everything after it
        if (this.functionStack[this.functionStack.length - 1].func !== func) {
            const orphanedFunctions: string[] = [];
            while (this.functionStack[this.functionStack.length - 1].func !== func) {
                const orphan = this.functionStack.pop();
                if (orphan === undefined) {
                    break;
                }
                orphanedFunctions.push(orphan.func);
                if (this.logTime === true && this.timers.length > 0) {
                    this.timers.pop();
                }
                // Auto-closed frames get no measure — discard their start mark
                if (this.perfMarks && orphan.markName !== undefined) {
                    try {
                        performance.clearMarks(orphan.markName);
                    } catch {
                        // Perf integration is best-effort
                    }
                }
                // Close the orphan's group only if it actually opened one, and
                // never capture — auto-close is presentation-only
                this.emit({ kind: 'groupEnd' }, { print: orphan.printedGroup, capture: false });
            }
            this.tfw(
                `Warning: Unexpected tfo call for '${func}'. Auto-closed unclosed functions: ${orphanedFunctions.join(', ')}`,
            );
        }

        const frame = this.functionStack.pop();
        // some() above guarantees a matching frame; this guard satisfies the type
        if (frame === undefined) return;

        // Close this frame's group iff it actually opened one: a printed group
        // must close even at level 0 (else it leaks and the console stays
        // indented), and a black-boxed frame that never opened one must not emit
        // a stray groupEnd after an escalation (it could close the host's group).
        this.emit({ kind: 'groupEnd' }, { print: frame.printedGroup, capture: false });

        let duration: number | undefined;
        if (this.logTime === true && this.timers.length > 0) {
            const startTime = this.timers.pop();
            if (typeof startTime === 'number') {
                duration = performance.now() - startTime;
            }
        }

        // The exit LINE follows the current level (and black-box) gate — unlike
        // the group close above, which follows the frame's own printedGroup.
        this.emit(
            {
                kind: 'funcExit',
                func,
                values: this.snapshot(returnValues),
                duration,
                markName: frame.markName,
            },
            { print, capture: print || this.blackBox },
        );
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
        const print = this.logLevel >= 2;
        if (!print && !this.blackBox) return;
        // console.table keeps the LIVE object so it stays expandable in devtools;
        // the ring/hook copy is snapshotted so a later mutation of the object
        // can't rewrite what dump() and onEntry report. Tables carry no perf
        // span, so bypassing emit() here (like the buffered-tft path in
        // createOpLogger) loses nothing.
        if (this.bufferSize > 0 || this.onEntry !== undefined) {
            this.capture(
                { kind: 'table', data: this.snapshotTableData(tabularData), properties },
                print,
            );
        }
        if (print) {
            this.printEntry({ kind: 'table', data: tabularData, properties });
        }
    }

    /**
     * Reset all tracing state: closes any console groups left open by
     * unmatched tfi calls, empties the capture ring, and clears function,
     * timer, and async-operation tracking. Use to recover when a trace has
     * gone out of sync.
     */
    reset(): void {
        // Close exactly the groups that actually opened: a frame whose group
        // never printed (black-boxed, or opened below level 2) must not emit a
        // spurious groupEnd that could close one of the host app's own groups.
        for (const frame of this.functionStack) {
            this.emit({ kind: 'groupEnd' }, { print: frame.printedGroup, capture: false });
        }
        // Drop the start marks of every frame and op left open, so a reset does
        // not leak stranded marks into the User Timing buffer
        if (this.perfMarks) {
            for (const frame of this.functionStack) {
                if (frame.markName !== undefined) {
                    try {
                        performance.clearMarks(frame.markName);
                    } catch {
                        // Perf integration is best-effort
                    }
                }
            }
            for (const opId of this.asyncOps.keys()) {
                this.clearOpStartMark(opId);
            }
        }
        this.functionStack = [];
        this.timers = [];
        this.asyncOps.clear();
        this.completedOps = [];
        this.currentOpStack = [];
        this.buffer = this.bufferSize > 0 ? new Array(this.bufferSize) : [];
        this.bufferWriteIndex = 0;
        this.bufferCount = 0;
        // Start a fresh throttle window so a resumed trace is not suppressed by
        // a stale count, and drop any pending suppression tally silently.
        this.throttleWindowStart = -Infinity;
        this.throttlePrinted = 0;
        this.throttleSuppressed = 0;
    }

    /**
     * Export the ring buffer's contents, oldest → newest — the recent trace
     * even at log levels that print nothing. This is the point of buffering:
     * it works at any level.
     * @param options.format 'text' (default) renders one readable line per
     *   entry (ISO time, a console-mirroring marker, func name, safely
     *   stringified values); 'json' returns the raw entry array (Error values
     *   become {name, message, stack}, circular/unstringifiable values become
     *   String(value)).
     * @param options.download true also writes the string to a file the
     *   browser downloads (vittra-log-&lt;ISO&gt;.txt/.json). Best-effort — the
     *   returned string is always the reliable path.
     * @returns The formatted buffer contents.
     */
    dump(options: { format?: 'text' | 'json'; download?: boolean } = {}): string {
        const format = options.format ?? 'text';
        const entries = this.orderedBuffer();
        const content = format === 'json' ? this.dumpJson(entries) : this.dumpText(entries);
        if (options.download === true) {
            this.downloadDump(content, format);
        }
        return content;
    }

    /** Render captured entries as one flat, human-readable line each */
    private dumpText(entries: VittraLogEntry[]): string {
        const lines: string[] = [];
        for (const entry of entries) {
            lines.push(this.dumpTextLine(entry));
        }
        return lines.join('\n');
    }

    /** One text line for an entry: ISO time, console-mirroring marker, values */
    private dumpTextLine(entry: VittraLogEntry): string {
        const time = new Date(entry.timestamp).toISOString();
        switch (entry.kind) {
            case 'log': {
                const tag =
                    entry.level === 'warn' ? ' WARN' : entry.level === 'error' ? ' ERROR' : '';
                const values = entry.values.map((value) => this.stringifyValue(value)).join(' ');
                // Clean logs print bare in the console, so mirror that here (no
                // '+'); every other level carries the '+' marker.
                const marker = entry.level === 'clean' ? '' : `+${tag} `;
                return `${time} ${marker}${values}`;
            }
            case 'table':
                return `${time} table ${this.stringifyValue(entry.data)}`;
            case 'funcEntry': {
                const args = entry.values.map((value) => this.stringifyValue(value)).join(', ');
                return `${time} --> ${entry.func}(${args})`;
            }
            case 'funcExit': {
                const values = entry.values.map((value) => this.stringifyValue(value)).join(', ');
                const runtime =
                    entry.duration !== undefined ? ` [${this.formatTime(entry.duration)}]` : '';
                return values
                    ? `${time} <-- ${entry.func}${runtime} = ${values}`
                    : `${time} <-- ${entry.func}${runtime}`;
            }
            case 'asyncStart': {
                const args = entry.args
                    ? entry.args.map((value) => this.stringifyValue(value)).join(', ')
                    : '';
                return `${time} ⟳ ${entry.func} #${entry.opId}${args ? ` (${args})` : ''}`;
            }
            case 'asyncEnd': {
                const values = entry.values.map((value) => this.stringifyValue(value)).join(', ');
                const runtime =
                    entry.duration !== undefined ? ` [${this.formatTime(entry.duration)}]` : '';
                return values
                    ? `${time} ✓ ${entry.func} #${entry.opId}${runtime} = ${values}`
                    : `${time} ✓ ${entry.func} #${entry.opId}${runtime}`;
            }
            case 'asyncComplete': {
                const mark = entry.status === 'failed' ? '✗' : '✓';
                const values = entry.values.map((value) => this.stringifyValue(value)).join(', ');
                const runtime =
                    entry.duration !== undefined ? ` [${this.formatTime(entry.duration)}]` : '';
                let line = `${time} ${mark} ${entry.func} #${entry.opId}${runtime}`;
                if (values) {
                    line += ` = ${values}`;
                }
                if (entry.error !== undefined) {
                    line += ` — ${this.stringifyValue(entry.error)}`;
                }
                return line;
            }
            default:
                // asyncPending, groupEnd and opError are never captured; safe fallback
                return `${time} ${entry.kind}`;
        }
    }

    /**
     * JSON.stringify a single value for the text dump. Errors collapse to
     * "Error: <message>"; anything JSON refuses (functions, symbols, circular
     * refs) falls back to String(value), and anything String() also refuses (a
     * null-prototype object with no toString) to '[unstringifiable]'. A dump
     * must never throw.
     */
    private stringifyValue(value: unknown): string {
        if (value instanceof Error) {
            return `Error: ${value.message}`;
        }
        try {
            const json = JSON.stringify(value);
            if (json !== undefined) {
                return json;
            }
        } catch {
            // Circular or otherwise unserializable — fall through to String()
        }
        try {
            return String(value);
        } catch {
            // A null-prototype object with no toString defeats String() too
            return '[unstringifiable]';
        }
    }

    /**
     * Serialize the entry array as JSON. A depth-first walk sanitizes each entry
     * so JSON.stringify runs cleanly: Errors become {name, message, stack}, a
     * genuine ancestor cycle becomes '[Circular]' (a repeated *sibling* is not a
     * cycle and serializes in full each time), and any value that defeats
     * serialization collapses to a placeholder. The call never throws and one
     * poison value never loses the whole dump.
     */
    private dumpJson(entries: VittraLogEntry[]): string {
        try {
            const sanitized = entries.map((entry) => this.sanitizeForJson(entry, new Set()));
            return JSON.stringify(sanitized, null, 2);
        } catch {
            // Every value is already sanitized; a final belt-and-braces guard
            return '[]';
        }
    }

    /**
     * Depth-first copy of a value safe to JSON.stringify. `ancestors` holds the
     * objects on the *current path* (not every object ever seen), so only a true
     * ancestor — a real cycle — is replaced with '[Circular]'; shared siblings
     * are serialized in full each time. Errors and unstringifiable primitives
     * are normalized in the same pass so no path can throw.
     */
    private sanitizeForJson(value: unknown, ancestors: Set<object>): unknown {
        if (value instanceof Error) {
            return { name: value.name, message: value.message, stack: value.stack };
        }
        if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
            try {
                return String(value);
            } catch {
                return '[unstringifiable]';
            }
        }
        if (value === null || typeof value !== 'object') {
            return value;
        }
        if (ancestors.has(value)) {
            return '[Circular]';
        }
        ancestors.add(value);
        let result: unknown;
        try {
            if (Array.isArray(value)) {
                const array: unknown[] = [];
                for (const item of value) {
                    array.push(this.sanitizeForJson(item, ancestors));
                }
                result = array;
            } else {
                const object: Record<string, unknown> = {};
                const source = value as Record<string, unknown>;
                for (const key of Object.keys(source)) {
                    object[key] = this.sanitizeForJson(source[key], ancestors);
                }
                result = object;
            }
        } catch {
            // A throwing getter or exotic object — don't let it break the dump
            result = '[unstringifiable]';
        }
        ancestors.delete(value);
        return result;
    }

    /**
     * Trigger a browser download of the dump string. Everything here can be
     * absent (SSR, jsdom lacks URL.createObjectURL), so it is fully guarded and
     * silent on failure — the returned dump string is the reliable path.
     */
    private downloadDump(content: string, format: 'text' | 'json'): void {
        try {
            if (
                typeof globalThis.Blob !== 'function' ||
                typeof globalThis.URL?.createObjectURL !== 'function' ||
                typeof globalThis.document === 'undefined'
            ) {
                return;
            }
            const extension = format === 'json' ? 'json' : 'txt';
            const mimeType = format === 'json' ? 'application/json' : 'text/plain';
            const stamp = new Date().toISOString().replace(/:/g, '-');
            const blob = new globalThis.Blob([content], { type: mimeType });
            const url = globalThis.URL.createObjectURL(blob);
            const anchor = globalThis.document.createElement('a');
            anchor.href = url;
            anchor.download = `vittra-log-${stamp}.${extension}`;
            globalThis.document.body.appendChild(anchor);
            anchor.click();
            globalThis.document.body.removeChild(anchor);
            // Defer revocation: some browsers (historically Firefox/Safari) drop
            // an in-flight download when its object URL is revoked synchronously
            // right after click().
            setTimeout(() => {
                try {
                    globalThis.URL.revokeObjectURL(url);
                } catch {
                    // Revocation is best-effort
                }
            }, 1000);
        } catch {
            // Download is best-effort; the string return path is the reliable one
        }
    }

    /**
     * Register global error listeners for dumpOnError. Guarded so SSR or a
     * restricted environment without addEventListener silently does nothing.
     */
    private registerErrorListeners(): void {
        try {
            if (typeof globalThis.addEventListener !== 'function') return;
            const handler = (): void => this.printErrorDump();
            globalThis.addEventListener('error', handler);
            globalThis.addEventListener('unhandledrejection', handler);
        } catch {
            // No global event target — nothing to hook
        }
    }

    /**
     * Print the buffered entries as flat text lines under a winged-badge group
     * when an uncaught error escapes. Bypasses printEntry deliberately: routing
     * buffered funcEntry groups through it would corrupt live group nesting.
     */
    private printErrorDump(): void {
        const entries = this.orderedBuffer();
        if (entries.length === 0) return;
        console.group(
            `%c🪽 vittra — last ${entries.length} entries before uncaught error`,
            BANNER_STYLE,
        );
        for (const entry of entries) {
            console.log(this.dumpTextLine(entry));
        }
        console.groupEnd();
    }

    /**
     * Check for any unclosed functions (missing tfo calls)
     * This should be called at points where all functions should be properly closed
     * @returns true if there are unclosed functions
     */
    checkUnclosedFunctions(): boolean {
        if (this.functionStack.length > 0) {
            const unclosed = this.functionStack.map((frame) => frame.func).join(', ');
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
