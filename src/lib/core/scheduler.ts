import { Instance } from "./engine";
import { libLog } from "./log";

/*
 * cs_script gives each point_script a single think callback (`Instance.SetThink`) and a single
 * "next think" time. This scheduler takes over that slot and runs any number of timers from it,
 * asking the engine to think only when the earliest timer is due.
 *
 * If you use `Timers`, don't call `Instance.SetThink` / `Instance.SetNextThink` yourself; doing so
 * replaces the scheduler's think function.
 */

/** CS2 servers run at 64 ticks per second. */
export const TICK_INTERVAL = 1 / 64;

/**
 * Think times land on the nearest tick, which may be slightly early. A timer counts as due if it is
 * within half a tick of the current time.
 */
const DUE_TOLERANCE = TICK_INTERVAL / 2;

/** A scheduled callback. */
export interface TimerHandle {
    /** Stop the timer. Safe to call more than once, including from inside its own callback. */
    cancel(): void;
    /** `false` once the timer has finished or been cancelled. */
    readonly active: boolean;
    /** Game time at which the timer will next fire. */
    readonly nextRun: number;
}

/** Return `false` from a repeating timer to stop it. */
export type TimerCallback = (timer: TimerHandle) => void | boolean;

export interface RepeatOptions {
    /** Also run once right away (on the next tick) instead of waiting one interval. Default `false`. */
    immediate?: boolean;
    /** Stop after running this many times. Default: forever. */
    times?: number;
}

class Timer implements TimerHandle {
    active = true;
    constructor(
        public nextRun: number,
        readonly interval: number | undefined,
        readonly callback: TimerCallback,
        public remaining: number,
    ) {}
    cancel(): void {
        this.active = false;
    }
}

let queue: Timer[] = [];
let thinkInstalled = false;
let requestedThinkAt = Infinity;
let inThink = false;

function insert(timer: Timer): void {
    // Binary search keeps the queue sorted by nextRun; equal times run in insertion order.
    let lo = 0;
    let hi = queue.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (queue[mid].nextRun <= timer.nextRun) lo = mid + 1;
        else hi = mid;
    }
    queue.splice(lo, 0, timer);
}

function requestThink(at: number): void {
    if (!thinkInstalled) {
        Instance.SetThink(onThink);
        thinkInstalled = true;
    }
    if (inThink) return; // onThink schedules the next think when it finishes
    // A requested think that is well in the past never ran (e.g. the think was reset); forget it.
    if (requestedThinkAt < Instance.GetGameTime() - 2 * TICK_INTERVAL) requestedThinkAt = Infinity;
    if (at < requestedThinkAt) {
        requestedThinkAt = at;
        Instance.SetNextThink(at);
    }
}

function onThink(): void {
    inThink = true;
    requestedThinkAt = Infinity;
    const now = Instance.GetGameTime();
    const due: Timer[] = [];
    while (queue.length > 0 && queue[0].nextRun <= now + DUE_TOLERANCE) due.push(queue.shift()!);

    for (const timer of due) {
        if (!timer.active) continue;
        let result: void | boolean = undefined;
        try {
            result = timer.callback(timer);
        } catch (err) {
            libLog.error("Uncaught error in timer callback:", err);
        }
        const repeat = timer.interval !== undefined && result !== false && timer.active && --timer.remaining > 0;
        if (repeat) {
            timer.nextRun += timer.interval!;
            // Fell behind (or interval 0): run again next tick instead of catching up in a burst.
            if (timer.nextRun < now) timer.nextRun = now + timer.interval!;
            insert(timer);
        } else {
            timer.active = false;
        }
    }

    while (queue.length > 0 && !queue[0].active) queue.shift();
    inThink = false;
    if (queue.length > 0) {
        requestedThinkAt = queue[0].nextRun;
        Instance.SetNextThink(queue[0].nextRun);
    }
}

function schedule(at: number, interval: number | undefined, callback: TimerCallback, times: number): TimerHandle {
    const timer = new Timer(at, interval, callback, times);
    insert(timer);
    requestThink(at);
    return timer;
}

/**
 * Timers that run from the point_script's think function.
 *
 * ```ts
 * Timers.after(3, () => log.info("3 seconds later"));
 * const hud = Timers.every(0.25, () => updateHud());
 * Timers.everyTick(() => checkPlayers());
 * hud.cancel();
 * ```
 */
export const Timers = {
    /** Current game time in seconds. */
    now(): number {
        return Instance.GetGameTime();
    },

    /** Run once after `seconds`. */
    after(seconds: number, callback: TimerCallback): TimerHandle {
        return schedule(Instance.GetGameTime() + Math.max(0, seconds), undefined, callback, 1);
    },

    /** Run once at an absolute game time. Times in the past run on the next tick. */
    at(gameTime: number, callback: TimerCallback): TimerHandle {
        return schedule(gameTime, undefined, callback, 1);
    },

    /** Run every `seconds`. Return `false` from the callback to stop. */
    every(seconds: number, callback: TimerCallback, options: RepeatOptions = {}): TimerHandle {
        const interval = Math.max(0, seconds);
        const now = Instance.GetGameTime();
        return schedule(options.immediate ? now : now + interval, interval, callback, options.times ?? Infinity);
    },

    /** Run once on the next tick. */
    nextTick(callback: TimerCallback): TimerHandle {
        return schedule(Instance.GetGameTime(), undefined, callback, 1);
    },

    /** Run every tick, starting next tick. Return `false` to stop. */
    everyTick(callback: TimerCallback): TimerHandle {
        return schedule(Instance.GetGameTime(), 0, callback, Infinity);
    },

    /** Cancel every pending timer. */
    cancelAll(): void {
        for (const t of queue) t.active = false;
        queue = [];
    },

    /** Number of pending timers. */
    get pending(): number {
        return queue.filter((t) => t.active).length;
    },
};

/** Resolve after `seconds` of game time. Uses Valve's `Instance.Delay`, independent of `Timers`. */
export function wait(seconds: number): Promise<void> {
    return Instance.Delay(seconds);
}

/** Resolve after `ticks` server ticks (default 1). */
export function waitTicks(ticks = 1): Promise<void> {
    return new Promise((resolve) => {
        let left = Math.max(1, Math.floor(ticks));
        Timers.everyTick(() => {
            if (--left > 0) return true;
            resolve();
            return false;
        });
    });
}

/**
 * Resolve once `predicate()` returns true, checking every `interval` seconds (default: every tick).
 * Resolves `true` when the condition is met, or `false` if `timeout` seconds pass first.
 */
export function waitUntil(predicate: () => boolean, options: { timeout?: number; interval?: number } = {}): Promise<boolean> {
    const deadline = options.timeout !== undefined ? Instance.GetGameTime() + options.timeout : Infinity;
    return new Promise((resolve) => {
        const check = (): boolean => {
            let ok = false;
            try {
                ok = predicate();
            } catch (err) {
                libLog.error("waitUntil predicate threw:", err);
            }
            if (ok) {
                resolve(true);
                return false;
            }
            if (Instance.GetGameTime() >= deadline) {
                resolve(false);
                return false;
            }
            return true;
        };
        if (!check()) return;
        Timers.every(options.interval ?? 0, check);
    });
}

/** Run a callback after all entities have thought this tick (wrapper for `Instance.QueueAfterThinks`). */
export function afterThinks(callback: () => void): void {
    Instance.QueueAfterThinks(callback);
}
