import { Instance } from "../core/engine";
import type { Entity, InputValue } from "cs_script/point_script";
import type { Unsubscribe } from "../core/events";
import { libLog } from "../core/log";
import { Timers } from "../core/scheduler";

/** Extra settings for {@link fire}. */
export interface FireOptions {
    /** Seconds to wait before the input is delivered. */
    delay?: number;
    activator?: Entity;
    caller?: Entity;
}

/** What an output passes to its listener. */
export interface OutputData {
    value?: InputValue;
    caller?: Entity;
    activator?: Entity;
}

/**
 * Fire an input on an entity, or on every entity matching a targetname (wildcards allowed).
 *
 * ```ts
 * fire("door_main", "Open");
 * fire(train, "SetSpeedReal", 300, { delay: 2 });
 * ```
 */
export function fire(target: Entity | string, input: string, value?: InputValue, options: FireOptions = {}): void {
    const config: { input: string; value?: InputValue; delay?: number; activator?: Entity; caller?: Entity } = { input };
    if (value !== undefined) config.value = value;
    if (options.delay !== undefined) config.delay = options.delay;
    if (options.activator !== undefined) config.activator = options.activator;
    if (options.caller !== undefined) config.caller = options.caller;
    if (typeof target === "string") Instance.EntFireAtName({ name: target, ...config });
    else Instance.EntFireAtTarget({ target, ...config });
}

/** Fire the same input on several targets. */
export function fireAll(targets: Iterable<Entity | string>, input: string, value?: InputValue, options?: FireOptions): void {
    for (const t of targets) fire(t, input, value, options);
}

export const enable = (target: Entity | string, options?: FireOptions) => fire(target, "Enable", undefined, options);
export const disable = (target: Entity | string, options?: FireOptions) => fire(target, "Disable", undefined, options);
export const toggle = (target: Entity | string, options?: FireOptions) => fire(target, "Toggle", undefined, options);
export const trigger = (target: Entity | string, options?: FireOptions) => fire(target, "Trigger", undefined, options);
/** Fire `Kill`. Works on names and wildcards; for an entity you hold, `entity.Remove()` is direct. */
export const killByName = (name: string, options?: FireOptions) => fire(name, "Kill", undefined, options);

/**
 * Run `callback` whenever `target` fires `output`. Returns a function that disconnects it.
 *
 * ```ts
 * const off = onOutput(button, "OnPressed", ({ activator }) => log.info(activator, "pressed it"));
 * ```
 */
export function onOutput(target: Entity, output: string, callback: (data: OutputData) => void): Unsubscribe {
    const id = Instance.ConnectOutput(target, output, (data) => {
        try {
            callback(data);
        } catch (err) {
            libLog.error(`Uncaught error in ${output} output listener:`, err);
        }
    });
    if (id === undefined) {
        libLog.warn(`ConnectOutput failed for output "${output}"`);
        return () => {};
    }
    let connected = true;
    return () => {
        if (!connected) return;
        connected = false;
        Instance.DisconnectOutput(id);
    };
}

/** Like {@link onOutput} but disconnects after the first time the output fires. */
export function onceOutput(target: Entity, output: string, callback: (data: OutputData) => void): Unsubscribe {
    let off: Unsubscribe = () => {};
    let fired = false;
    off = onOutput(target, output, (data) => {
        if (fired) return;
        fired = true;
        off();
        callback(data);
    });
    if (fired) off();
    return off;
}

/** Connect `output` on every entity matching a targetname (wildcards allowed). One function disconnects them all. */
export function onOutputByName(pattern: string, output: string, callback: (data: OutputData) => void): Unsubscribe {
    const offs = Instance.FindEntitiesByName(pattern).map((e) => onOutput(e, output, callback));
    return () => offs.forEach((off) => off());
}

/**
 * Resolve the next time `target` fires `output`, or with `undefined` after `timeout` seconds.
 *
 * ```ts
 * await waitForOutput(door, "OnFullyOpen");
 * ```
 */
export function waitForOutput(target: Entity, output: string, timeout?: number): Promise<OutputData | undefined> {
    return new Promise((resolve) => {
        const timer = timeout !== undefined ? Timers.after(timeout, () => (off(), resolve(undefined))) : undefined;
        const off = onceOutput(target, output, (data) => {
            timer?.cancel();
            resolve(data);
        });
    });
}
