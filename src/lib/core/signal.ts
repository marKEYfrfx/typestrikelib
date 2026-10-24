import { libLog } from "./log";
import type { Unsubscribe } from "./events";

/**
 * A small typed event emitter for your own events.
 *
 * ```ts
 * const onTroopDied = new Signal<CTroop>();
 * onTroopDied.connect((troop) => log.info(troop, "died"));
 * onTroopDied.emit(troop);
 * ```
 */
export class Signal<T = void> {
    private handlers: Array<{ fn: (value: T) => void; once: boolean }> = [];

    /** Add a handler. Returns a function that removes it. */
    connect(fn: (value: T) => void): Unsubscribe {
        const entry = { fn, once: false };
        this.handlers.push(entry);
        return () => this.remove(entry);
    }

    /** Add a handler that runs once. */
    once(fn: (value: T) => void): Unsubscribe {
        const entry = { fn, once: true };
        this.handlers.push(entry);
        return () => this.remove(entry);
    }

    /** Call every handler with `value`. Errors are logged; the remaining handlers still run. */
    emit(value: T): void {
        for (const entry of this.handlers.slice()) {
            if (entry.once) this.remove(entry);
            try {
                entry.fn(value);
            } catch (err) {
                libLog.error("Uncaught error in Signal handler:", err);
            }
        }
    }

    /** Resolve with the next emitted value. */
    next(): Promise<T> {
        return new Promise((resolve) => this.once(resolve));
    }

    clear(): void {
        this.handlers = [];
    }

    get size(): number {
        return this.handlers.length;
    }

    private remove(entry: { fn: (value: T) => void; once: boolean }): void {
        const i = this.handlers.indexOf(entry);
        if (i !== -1) this.handlers.splice(i, 1);
    }
}

/** Anything a {@link Scope} knows how to clean up. */
export type Disposable = (() => void) | { cancel(): void } | { dispose(): void };

/**
 * Collects listeners, timers and output connections so they can be removed together,
 * e.g. when a game mode or a round-specific system shuts down.
 *
 * ```ts
 * const round = new Scope();
 * round.add(Events.on("PlayerJump", onJump));
 * round.add(Timers.every(1, tick));
 * Events.once("RoundEnd", () => round.dispose());
 * ```
 */
export class Scope {
    private items: Disposable[] = [];

    add<D extends Disposable>(item: D): D {
        this.items.push(item);
        return item;
    }

    dispose(): void {
        const items = this.items;
        this.items = [];
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            try {
                if (typeof item === "function") item();
                else if ("dispose" in item) item.dispose();
                else item.cancel();
            } catch (err) {
                libLog.error("Error while disposing scope item:", err);
            }
        }
    }

    get size(): number {
        return this.items.length;
    }
}
