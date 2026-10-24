import { Instance } from "../core/engine";

/** Current game time in seconds. */
export function gameTime(): number {
    return Instance.GetGameTime();
}

/**
 * Format seconds as a run timer: `"0:07.250"`, `"1:05.000"`, `"1:02:03.004"`.
 * Pass `decimals: 0` for a clock-style `"1:05"`.
 */
export function formatTime(seconds: number, decimals = 3): string {
    const negative = seconds < 0;
    let s = Math.abs(seconds);
    const factor = 10 ** decimals;
    s = Math.round(s * factor) / factor;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const secText = decimals > 0 ? sec.toFixed(decimals).padStart(decimals + 3, "0") : String(Math.floor(sec)).padStart(2, "0");
    const body = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${secText}` : `${m}:${secText}`;
    return negative ? `-${body}` : body;
}

/**
 * Measures elapsed game time, e.g. for a speedrun or KZ timer.
 *
 * ```ts
 * const run = new Stopwatch();
 * run.start();
 * // ...
 * log.info(`Finished in ${formatTime(run.stop())}`);
 * ```
 */
export class Stopwatch {
    private startedAt: number | undefined;
    private accumulated = 0;

    /** Start (or resume) timing. */
    start(): this {
        if (this.startedAt === undefined) this.startedAt = Instance.GetGameTime();
        return this;
    }

    /** Pause and return the elapsed time. */
    stop(): number {
        if (this.startedAt !== undefined) {
            this.accumulated += Instance.GetGameTime() - this.startedAt;
            this.startedAt = undefined;
        }
        return this.accumulated;
    }

    /** Stop and zero. */
    reset(): this {
        this.startedAt = undefined;
        this.accumulated = 0;
        return this;
    }

    /** Zero and start again. */
    restart(): this {
        return this.reset().start();
    }

    get running(): boolean {
        return this.startedAt !== undefined;
    }

    /** Seconds elapsed so far. */
    get elapsed(): number {
        return this.accumulated + (this.startedAt !== undefined ? Instance.GetGameTime() - this.startedAt : 0);
    }
}

/**
 * Per-key cooldowns measured in game time. Keys are usually player slots.
 *
 * ```ts
 * const spawnCooldown = new Cooldown(5);
 * if (!spawnCooldown.tryUse(slot)) return reply(`Wait ${spawnCooldown.remaining(slot).toFixed(1)}s`);
 * ```
 */
export class Cooldown<K = number> {
    private readonly readyAt = new Map<K, number>();

    constructor(public seconds: number) {}

    /** `true` if `key` is not cooling down. */
    ready(key: K): boolean {
        return this.remaining(key) <= 0;
    }

    /** Seconds until `key` is ready again (0 if ready). */
    remaining(key: K): number {
        const at = this.readyAt.get(key);
        return at === undefined ? 0 : Math.max(0, at - Instance.GetGameTime());
    }

    /** Start the cooldown for `key` (optionally with a different length). */
    trigger(key: K, seconds = this.seconds): void {
        this.readyAt.set(key, Instance.GetGameTime() + seconds);
    }

    /** If ready, start the cooldown and return `true`; otherwise return `false`. */
    tryUse(key: K): boolean {
        if (!this.ready(key)) return false;
        this.trigger(key);
        return true;
    }

    /** Clear one key, or every key. */
    reset(key?: K): void {
        if (key === undefined) this.readyAt.clear();
        else this.readyAt.delete(key);
    }
}
