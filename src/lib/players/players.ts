import { Instance } from "../core/engine";
import type { CSPlayerController, CSPlayerPawn, Entity } from "cs_script/point_script";
import { isPlayerController, isPlayerPawn } from "../entities/guards";

/** Anything that identifies a player: their controller, their pawn, or their slot number. */
export type PlayerLike = CSPlayerController | CSPlayerPawn | number;

/** The controller for a player. Pawns resolve to the controller they were spawned for. */
export function getController(player: PlayerLike | undefined): CSPlayerController | undefined {
    if (player === undefined) return undefined;
    if (typeof player === "number") return Instance.GetPlayerController(player);
    if (isPlayerController(player)) return player;
    if (isPlayerPawn(player)) return player.GetPlayerController() ?? player.GetOriginalPlayerController();
    return undefined;
}

/** The player's pawn, if they have one (spectators and players waiting to spawn may not). */
export function getPawn(player: PlayerLike | undefined): CSPlayerPawn | undefined {
    if (player === undefined) return undefined;
    if (typeof player !== "number" && isPlayerPawn(player)) return player;
    return getController(player)?.GetPlayerPawn();
}

/** The player's slot number. */
export function getSlot(player: PlayerLike | undefined): number | undefined {
    if (player === undefined) return undefined;
    if (typeof player === "number") return player;
    return getController(player)?.GetPlayerSlot();
}

/** The player's display name, or `""`. */
export function getPlayerName(player: PlayerLike | undefined): string {
    return getController(player)?.GetPlayerName() ?? "";
}

/**
 * The controller behind any entity involved in an event: a controller, a pawn, or something a
 * player owns (a weapon, a grenade projectile). Handy for `attacker`, `activator` and `inflictor`.
 */
export function playerFromEntity(entity: Entity | undefined): CSPlayerController | undefined {
    let e: Entity | undefined = entity;
    for (let depth = 0; e && depth < 4; depth++) {
        if (isPlayerController(e)) return e;
        if (isPlayerPawn(e)) return getController(e);
        e = e.GetOwner();
    }
    return undefined;
}

/** Options for {@link getPlayers} and friends. Everything is optional. */
export interface PlayerFilter {
    /** Only players on this team (or these teams). */
    team?: number | readonly number[];
    /** `true`: only players with a living pawn. `false`: only players without one. */
    alive?: boolean;
    /** Include bots. Default `true`. */
    bots?: boolean;
    /** Include disconnected controllers. Default `false`. */
    disconnected?: boolean;
    /** Any extra test. */
    where?: (controller: CSPlayerController) => boolean;
}

function matches(c: CSPlayerController, f: PlayerFilter): boolean {
    if (!c.IsValid()) return false;
    if (!f.disconnected && !c.IsConnected()) return false;
    if (f.bots === false && c.IsBot()) return false;
    if (f.team !== undefined) {
        const team = c.GetTeamNumber();
        if (typeof f.team === "number" ? team !== f.team : !f.team.includes(team)) return false;
    }
    if (f.alive !== undefined) {
        const pawn = c.GetPlayerPawn();
        const isAlive = pawn !== undefined && pawn.IsValid() && pawn.IsAlive();
        if (isAlive !== f.alive) return false;
    }
    return !f.where || f.where(c);
}

/** Connected player controllers, optionally filtered. */
export function getPlayers(filter: PlayerFilter = {}): CSPlayerController[] {
    return Instance.GetAllPlayerControllers().filter((c) => matches(c, filter));
}

/** Pawns of connected players. Defaults to living pawns only; pass `alive: false` for dead ones. */
export function getPawns(filter: PlayerFilter = {}): CSPlayerPawn[] {
    const f = { alive: true, ...filter };
    const out: CSPlayerPawn[] = [];
    for (const c of getPlayers(f)) {
        const p = c.GetPlayerPawn();
        if (p && p.IsValid()) out.push(p);
    }
    return out;
}

/** Run `fn` for each matching player. */
export function forEachPlayer(fn: (controller: CSPlayerController) => void, filter?: PlayerFilter): void {
    for (const c of getPlayers(filter)) fn(c);
}

/** Number of matching players. */
export function countPlayers(filter?: PlayerFilter): number {
    return getPlayers(filter).length;
}

/**
 * Find a connected player from text the way admin commands do:
 * `"#3"` is slot 3, otherwise an exact name (case-insensitive), then a unique partial match.
 * Returns `undefined` when nothing or more than one player matches.
 */
export function findPlayer(query: string): CSPlayerController | undefined {
    const q = query.trim();
    if (q === "") return undefined;
    if (/^#\d+$/.test(q)) {
        const c = Instance.GetPlayerController(Number(q.slice(1)));
        return c && c.IsConnected() ? c : undefined;
    }
    const players = getPlayers();
    const lower = q.toLowerCase();
    const exact = players.find((c) => c.GetPlayerName().toLowerCase() === lower);
    if (exact) return exact;
    const partial = players.filter((c) => c.GetPlayerName().toLowerCase().includes(lower));
    return partial.length === 1 ? partial[0] : undefined;
}
