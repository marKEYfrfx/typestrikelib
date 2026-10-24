import { Instance } from "./engine";
import type { Entity, IPointScript, ModfiyPlayerDamageResult, ModifyPlayerDamageEvent } from "cs_script/point_script";
import { libLog } from "./log";

/*
 * cs_script exposes one `Instance.OnXxx(callback)` per event. This module registers each of
 * those exactly once, on first use, and fans the event out to any number of listeners.
 * Listeners can unsubscribe, a throwing listener doesn't stop the others, and
 * `ModifyPlayerDamage` results from several listeners are combined.
 */

type OnMethod = Extract<keyof IPointScript, `On${string}`>;
/** Events with a different shape (or deprecated ones) that get their own helpers. */
type SpecialEvent = "OnScriptInput" | "OnScriptReload" | "OnBeforePlayerDamage" | "OnBeforeReload" | "OnReload";
type StripOn<K> = K extends `On${infer N}` ? N : never;

/** Event name -> the callback type Valve declares for `Instance.On<Name>`. Built from `point_script.d.ts`. */
export type GameEventListenerMap = {
    [K in Exclude<OnMethod, SpecialEvent> as StripOn<K>]: Parameters<IPointScript[K]>[0];
};

/** Every event name: `"PlayerJump"`, `"RoundStart"`, `"ModifyPlayerDamage"`, ... */
export type GameEventName = keyof GameEventListenerMap;

/** The callback type Valve declares for `Instance.On<N>`. */
export type GameEventListener<N extends GameEventName> = GameEventListenerMap[N];

/** The event object passed to listeners of `N` (`void` for events without a payload). */
export type GameEventPayload<N extends GameEventName> =
    Parameters<GameEventListener<N>> extends [infer E, ...unknown[]] ? E : void;

/** Call to remove the listener / connection / timer that returned it. Safe to call more than once. */
export type Unsubscribe = () => void;

interface ListenerEntry {
    fn: (...args: any[]) => unknown;
    once: boolean;
    removed: boolean;
}

const listeners = new Map<string, ListenerEntry[]>();
const registered = new Set<string>();
const scriptInputListeners = new Map<string, ListenerEntry[]>();

function addEntry(map: Map<string, ListenerEntry[]>, key: string, entry: ListenerEntry): Unsubscribe {
    let list = map.get(key);
    if (!list) map.set(key, (list = []));
    list.push(entry);
    return () => removeEntry(map, key, entry);
}

function removeEntry(map: Map<string, ListenerEntry[]>, key: string, entry: ListenerEntry): void {
    if (entry.removed) return;
    entry.removed = true;
    const list = map.get(key);
    if (!list) return;
    const i = list.indexOf(entry);
    if (i !== -1) list.splice(i, 1);
}

function runList(map: Map<string, ListenerEntry[]>, key: string, label: string, args: unknown[]): void {
    const list = map.get(key);
    if (!list || list.length === 0) return;
    for (const entry of list.slice()) {
        if (entry.removed) continue;
        if (entry.once) removeEntry(map, key, entry);
        try {
            entry.fn(...args);
        } catch (err) {
            libLog.error(`Uncaught error in ${label} listener:`, err);
        }
    }
}

function dispatchModifyDamage(event: ModifyPlayerDamageEvent): ModfiyPlayerDamageResult | undefined {
    const list = listeners.get("ModifyPlayerDamage");
    if (!list || list.length === 0) return undefined;
    // Each listener sees the damage as changed by the listeners before it.
    const working: ModifyPlayerDamageEvent = {
        player: event.player,
        damage: event.damage,
        damageTypes: event.damageTypes,
        damageFlags: event.damageFlags,
        hitGroup: event.hitGroup,
        inflictor: event.inflictor,
        attacker: event.attacker,
        weapon: event.weapon,
    };
    const result: ModfiyPlayerDamageResult = {};
    let changed = false;
    for (const entry of list.slice()) {
        if (entry.removed) continue;
        if (entry.once) removeEntry(listeners, "ModifyPlayerDamage", entry);
        let r: ModfiyPlayerDamageResult | void;
        try {
            r = entry.fn(working) as ModfiyPlayerDamageResult | void;
        } catch (err) {
            libLog.error("Uncaught error in ModifyPlayerDamage listener:", err);
            continue;
        }
        if (!r) continue;
        if (r.abort) return { abort: true };
        // Only fields a listener actually set are returned to the engine.
        if (r.damage !== undefined) {
            working.damage = result.damage = r.damage;
            changed = true;
        }
        if (r.damageTypes !== undefined) {
            working.damageTypes = result.damageTypes = r.damageTypes;
            changed = true;
        }
        if (r.damageFlags !== undefined) {
            working.damageFlags = result.damageFlags = r.damageFlags;
            changed = true;
        }
    }
    return changed ? result : undefined;
}

function ensureRegistered(name: GameEventName): void {
    if (registered.has(name)) return;
    registered.add(name);
    const method = (Instance as unknown as Record<string, unknown>)[`On${name}`];
    if (typeof method !== "function") {
        libLog.warn(`Instance.On${name} does not exist in this version of cs_script; listeners for "${name}" will never fire.`);
        return;
    }
    const dispatcher =
        name === "ModifyPlayerDamage"
            ? (e: ModifyPlayerDamageEvent) => dispatchModifyDamage(e)
            : (...args: unknown[]) => runList(listeners, name, name, args);
    (method as (cb: unknown) => void).call(Instance, dispatcher);
}

/** Data passed to `RunScriptInput` listeners. */
export interface ScriptInputData {
    caller?: Entity;
    activator?: Entity;
}

/**
 * Multi-listener game events.
 *
 * ```ts
 * const stop = Events.on("PlayerJump", ({ player }) => log.info(player, "jumped"));
 * Events.once("RoundStart", () => log.info("first round started"));
 * Events.on("ModifyPlayerDamage", (e) => (e.hitGroup === CSHitGroup.HEAD ? { damage: e.damage * 2 } : undefined));
 * stop(); // unsubscribe
 * ```
 *
 * Use this instead of calling `Instance.OnXxx` yourself. Valve's API has one callback slot per
 * event, so mixing the two can replace the library's dispatcher.
 */
export const Events = {
    /** Listen to a game event. Returns a function that removes the listener. */
    on<N extends GameEventName>(name: N, listener: GameEventListener<N>): Unsubscribe {
        ensureRegistered(name);
        return addEntry(listeners, name, { fn: listener as ListenerEntry["fn"], once: false, removed: false });
    },

    /** Listen to the next occurrence of an event only. */
    once<N extends GameEventName>(name: N, listener: GameEventListener<N>): Unsubscribe {
        ensureRegistered(name);
        return addEntry(listeners, name, { fn: listener as ListenerEntry["fn"], once: true, removed: false });
    },

    /** Remove a listener added with `on`/`once`. */
    off<N extends GameEventName>(name: N, listener: GameEventListener<N>): void {
        const list = listeners.get(name);
        const entry = list?.find((e) => e.fn === listener);
        if (entry) removeEntry(listeners, name, entry);
    },

    /** Resolve with the payload of the next occurrence of `name`. */
    next<N extends GameEventName>(name: N): Promise<GameEventPayload<N>> {
        return new Promise((resolve) => {
            Events.once(name, ((payload: GameEventPayload<N>) => resolve(payload)) as unknown as GameEventListener<N>);
        });
    },

    /** Listen for `RunScriptInput` on this point_script with a matching parameter value. */
    onScriptInput(inputName: string, listener: (data: ScriptInputData) => void): Unsubscribe {
        if (!scriptInputListeners.has(inputName)) {
            scriptInputListeners.set(inputName, []);
            Instance.OnScriptInput(inputName, (data) => runList(scriptInputListeners, inputName, `ScriptInput "${inputName}"`, [data]));
        }
        return addEntry(scriptInputListeners, inputName, { fn: listener, once: false, removed: false });
    },

    /** Number of active listeners for an event. */
    listenerCount(name: GameEventName): number {
        return listeners.get(name)?.length ?? 0;
    },

    /** Remove all listeners for one event, or for every event. The engine-side registration stays (it's a no-op without listeners). */
    clear(name?: GameEventName): void {
        if (name) {
            for (const e of listeners.get(name) ?? []) e.removed = true;
            listeners.delete(name);
        } else {
            for (const list of listeners.values()) for (const e of list) e.removed = true;
            listeners.clear();
        }
    },
};
