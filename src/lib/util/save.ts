import { Instance } from "../core/engine";
import { libLog } from "../core/log";
import { Timers, type TimerHandle } from "../core/scheduler";

/*
 * Instance.SetSaveData / GetSaveData store one string per workshop addon. This module keeps a
 * JSON document in that string so several independent stores can share it, each with its own
 * key, defaults and version.
 */

interface SaveRoot {
    typestrike: 1;
    stores: Record<string, { v: number; d: unknown }>;
    /** Save data that wasn't ours (not valid JSON); kept so it isn't destroyed. */
    raw?: string;
}

let root: SaveRoot | undefined;

function loadRoot(): SaveRoot {
    if (root) return root;
    const text = Instance.GetSaveData();
    if (!text) return (root = { typestrike: 1, stores: {} });
    try {
        const parsed = JSON.parse(text) as Partial<SaveRoot>;
        if (parsed && parsed.typestrike === 1 && typeof parsed.stores === "object" && parsed.stores !== null) {
            return (root = { typestrike: 1, stores: parsed.stores, ...(parsed.raw !== undefined ? { raw: parsed.raw } : {}) });
        }
    } catch {
        // fall through
    }
    libLog.warn("Existing save data is not in typestrike format; it is kept under `raw` and won't be overwritten.");
    return (root = { typestrike: 1, stores: {}, raw: text });
}

function writeRoot(): void {
    Instance.SetSaveData(JSON.stringify(loadRoot()));
}

export interface SaveStoreOptions<T> {
    /** Bump when the data's shape changes; `migrate` is then called with the old data. Default 1. */
    version?: number;
    /** Convert data saved by an older version. Without it, old data is replaced by the defaults. */
    migrate?: (old: unknown, oldVersion: number) => T;
}

/**
 * Typed, persistent data for a workshop addon.
 *
 * ```ts
 * const records = new SaveStore("records", { bestTime: 0, runs: 0 });
 * records.data.runs++;
 * records.saveSoon(); // writes at most once per second
 * ```
 *
 * Saving writes to disk synchronously, so prefer `saveSoon()` for frequent changes.
 * JSON can't store `Infinity`/`NaN` (they come back as `null`) or entity references.
 */
export class SaveStore<T extends object> {
    private cache: T | undefined;
    private pending: TimerHandle | undefined;
    private readonly version: number;

    constructor(
        readonly key: string,
        private readonly defaults: T,
        private readonly options: SaveStoreOptions<T> = {},
    ) {
        this.version = options.version ?? 1;
    }

    /** The data. Loaded from disk on first access; missing top-level keys are filled from the defaults. */
    get data(): T {
        if (this.cache) return this.cache;
        const entry = loadRoot().stores[this.key];
        let value: T;
        if (!entry) {
            value = clonePlain(this.defaults);
        } else if (entry.v === this.version) {
            value = { ...clonePlain(this.defaults), ...(entry.d as object) } as T;
        } else if (this.options.migrate) {
            try {
                value = this.options.migrate(entry.d, entry.v);
            } catch (err) {
                libLog.error(`SaveStore "${this.key}": migrate from v${entry.v} failed, using defaults.`, err);
                value = clonePlain(this.defaults);
            }
        } else {
            libLog.warn(`SaveStore "${this.key}": saved data is v${entry.v}, expected v${this.version}; using defaults.`);
            value = clonePlain(this.defaults);
        }
        return (this.cache = value);
    }

    /** Replace the data (not written until you save). */
    set data(value: T) {
        this.cache = value;
    }

    /** Write now. */
    save(): void {
        this.pending?.cancel();
        this.pending = undefined;
        loadRoot().stores[this.key] = { v: this.version, d: this.data };
        writeRoot();
    }

    /** Write after `delay` seconds; further calls in that window are merged into one write. */
    saveSoon(delay = 1): void {
        if (this.pending?.active) return;
        this.pending = Timers.after(delay, () => this.save());
    }

    /** Change the data with a function, then save (immediately, or soon by default). */
    update(change: (data: T) => void, immediate = false): void {
        change(this.data);
        if (immediate) this.save();
        else this.saveSoon();
    }

    /** Back to the defaults (and save). */
    reset(): void {
        this.cache = clonePlain(this.defaults);
        this.save();
    }
}

/** Deep copy of plain data (objects, arrays, primitives). */
function clonePlain<T>(value: T): T {
    if (Array.isArray(value)) return value.map((v) => clonePlain(v)) as T;
    if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) out[k] = clonePlain(v);
        return out as T;
    }
    return value;
}

/** Forget the in-memory copy of the save file so the next access reads from disk again. Mostly for tests. */
export function _resetSaveCache(): void {
    root = undefined;
}
