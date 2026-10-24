import { CSDamageFlags, CSDamageTypes, CSHitGroup } from "../core/engine";
import type { CSPlayerPawn, ModifyPlayerDamageEvent, PlayerDamageEvent } from "cs_script/point_script";
import { Events, type Unsubscribe } from "../core/events";
import { playerFromEntity } from "../players/players";

/** `true` if every bit of `flag` is set in `bits`. Works for CSDamageTypes, CSDamageFlags and CSInputs. */
export function hasFlag(bits: number, flag: number): boolean {
    return (bits & flag) === flag;
}

/** Hit in the head (by hit group or the HEADSHOT damage type). */
export function isHeadshot(event: ModifyPlayerDamageEvent | PlayerDamageEvent): boolean {
    return event.hitGroup === CSHitGroup.HEAD || hasFlag(event.damageTypes, CSDamageTypes.HEADSHOT);
}

/** The attacker hurt themselves (e.g. their own grenade). */
export function isSelfDamage(event: ModifyPlayerDamageEvent | PlayerDamageEvent): boolean {
    const attacker = playerFromEntity(event.attacker);
    return attacker !== undefined && attacker === playerFromEntity(event.player);
}

/** Fall damage. */
export function isFallDamage(event: ModifyPlayerDamageEvent | PlayerDamageEvent): boolean {
    return hasFlag(event.damageTypes, CSDamageTypes.FALL);
}

/**
 * Cancel all damage to players that `isProtected` returns true for (god mode, spawn protection,
 * safe zones). Returns a function that turns it off.
 *
 * ```ts
 * const protectedUntil = new PlayerData(() => 0);
 * preventDamage((pawn) => Timers.now() < protectedUntil.get(pawn));
 * ```
 */
export function preventDamage(isProtected: (pawn: CSPlayerPawn, event: ModifyPlayerDamageEvent) => boolean): Unsubscribe {
    return Events.on("ModifyPlayerDamage", (e) => (isProtected(e.player, e) ? { abort: true } : undefined));
}

/** Multiply incoming player damage by whatever `getMultiplier` returns (1 = unchanged). */
export function scaleDamage(getMultiplier: (event: ModifyPlayerDamageEvent) => number): Unsubscribe {
    return Events.on("ModifyPlayerDamage", (e) => {
        const m = getMultiplier(e);
        return m === 1 ? undefined : { damage: e.damage * m };
    });
}

/** Make matching damage ignore armor. */
export function pierceArmor(predicate: (event: ModifyPlayerDamageEvent) => boolean = () => true): Unsubscribe {
    return Events.on("ModifyPlayerDamage", (e) => (predicate(e) ? { damageFlags: e.damageFlags | CSDamageFlags.IGNORE_ARMOR } : undefined));
}

/** Readable hit group names for logs and HUDs. */
export function hitGroupName(hitGroup: CSHitGroup | undefined): string {
    switch (hitGroup) {
        case CSHitGroup.HEAD:
            return "head";
        case CSHitGroup.NECK:
            return "neck";
        case CSHitGroup.CHEST:
            return "chest";
        case CSHitGroup.STOMACH:
            return "stomach";
        case CSHitGroup.LEFTARM:
            return "left arm";
        case CSHitGroup.RIGHTARM:
            return "right arm";
        case CSHitGroup.LEFTLEG:
            return "left leg";
        case CSHitGroup.RIGHTLEG:
            return "right leg";
        case CSHitGroup.GENERIC:
            return "body";
        default:
            return "unknown";
    }
}
