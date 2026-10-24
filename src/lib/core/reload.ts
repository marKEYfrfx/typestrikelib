import { Instance } from "./engine";
import { libLog } from "./log";

/*
 * Tools-mode hot reload helpers.
 *
 * When you save a script in tools mode, CS2 clears every registered callback and re-runs the
 * script's top level. Module variables start fresh. Plain globals (`globalThis`) and properties
 * you attached to entity objects survive.
 */

interface ReloadHooks {
    before?: () => unknown;
    after?: (memory: unknown) => void;
}

const hooks = new Map<string, ReloadHooks>();
let installed = false;

function install(): void {
    if (installed) return;
    installed = true;
    Instance.OnScriptReload({
        before: () => {
            const memory: Record<string, unknown> = {};
            for (const [key, h] of hooks) {
                if (!h.before) continue;
                try {
                    memory[key] = h.before();
                } catch (err) {
                    libLog.error(`onReload("${key}") before hook threw:`, err);
                }
            }
            return memory;
        },
        after: (memory: Record<string, unknown> | undefined) => {
            for (const [key, h] of hooks) {
                if (!h.after) continue;
                try {
                    h.after(memory?.[key]);
                } catch (err) {
                    libLog.error(`onReload("${key}") after hook threw:`, err);
                }
            }
        },
    });
}

/**
 * Keep state across tools-mode reloads under a key. `before` runs in the old script and returns
 * what to keep; `after` runs in the new script, after its top level has run, and receives that
 * value (or `undefined` if the old script had no hook with this key).
 *
 * ```ts
 * let score = 0;
 * onReload("score", { before: () => score, after: (saved) => (score = saved ?? 0) });
 * ```
 */
export function onReload<T>(key: string, h: { before?: () => T; after?: (memory: T | undefined) => void }): void {
    hooks.set(key, h as ReloadHooks);
    install();
}

const STATE_KEY = "__typestrike_state__";

/**
 * A plain object stored on `globalThis` that survives tools-mode reloads and is available
 * straight away at top level (unlike {@link onReload}, whose `after` runs later).
 *
 * Only keep data here: numbers, strings, plain objects, entity references. A function or class
 * instance kept here still runs the old version of your code after a reload.
 *
 * ```ts
 * const state = persistentState("round", () => ({ wave: 1 }));
 * state.wave++;
 * ```
 */
export function persistentState<T extends object>(key: string, create: () => T): T {
    const g = globalThis as unknown as Record<string, Record<string, unknown> | undefined>;
    const store = (g[STATE_KEY] ??= {});
    if (!(key in store)) store[key] = create();
    return store[key] as T;
}

/** Delete one persistent state entry (or all of them). */
export function clearPersistentState(key?: string): void {
    const g = globalThis as unknown as Record<string, Record<string, unknown> | undefined>;
    const store = g[STATE_KEY];
    if (!store) return;
    if (key === undefined) g[STATE_KEY] = {};
    else delete store[key];
}
