import { Events, type Unsubscribe } from "../core/events";
import { getSlot, type PlayerLike } from "./players";

export interface PlayerDataOptions {
    /** Drop a player's data when they disconnect. Default `true`. */
    resetOnDisconnect?: boolean;
    /** Drop a slot's data when someone new connects into it. Default `true`. */
    resetOnConnect?: boolean;
}

/**
 * Per-player state keyed by slot, created on first access and dropped on disconnect.
 *
 * ```ts
 * const kills = new PlayerData(() => ({ count: 0 }));
 * Events.on("PlayerKill", ({ attacker }) => {
 *     const killer = playerFromEntity(attacker);
 *     if (killer) kills.get(killer).count++;
 * });
 * ```
 */
export class PlayerData<T> {
    private readonly data = new Map<number, T>();
    private readonly listeners: Unsubscribe[] = [];

    constructor(
        private readonly create: (slot: number) => T,
        options: PlayerDataOptions = {},
    ) {
        if (options.resetOnDisconnect !== false) this.listeners.push(Events.on("PlayerDisconnect", ({ playerSlot }) => this.data.delete(playerSlot)));
        if (options.resetOnConnect !== false) {
            this.listeners.push(
                Events.on("PlayerConnect", ({ player }) => {
                    const slot = player?.GetPlayerSlot();
                    if (slot !== undefined) this.data.delete(slot);
                }),
            );
        }
    }

    /** Stop listening for connects/disconnects and drop all data. */
    dispose(): void {
        for (const off of this.listeners.splice(0)) off();
        this.data.clear();
    }

    /** The player's data, creating it if needed. */
    get(player: PlayerLike): T {
        const slot = this.slotOf(player);
        let value = this.data.get(slot);
        if (value === undefined) {
            value = this.create(slot);
            this.data.set(slot, value);
        }
        return value;
    }

    /** The player's data if it exists, without creating it. */
    peek(player: PlayerLike): T | undefined {
        const slot = getSlot(player);
        return slot === undefined ? undefined : this.data.get(slot);
    }

    set(player: PlayerLike, value: T): void {
        this.data.set(this.slotOf(player), value);
    }

    has(player: PlayerLike): boolean {
        const slot = getSlot(player);
        return slot !== undefined && this.data.has(slot);
    }

    delete(player: PlayerLike): boolean {
        const slot = getSlot(player);
        return slot !== undefined && this.data.delete(slot);
    }

    clear(): void {
        this.data.clear();
    }

    /** `[slot, value]` pairs. */
    entries(): IterableIterator<[number, T]> {
        return this.data.entries();
    }

    get size(): number {
        return this.data.size;
    }

    private slotOf(player: PlayerLike): number {
        const slot = getSlot(player);
        if (slot === undefined) throw new Error("PlayerData: could not resolve a player slot");
        return slot;
    }
}
