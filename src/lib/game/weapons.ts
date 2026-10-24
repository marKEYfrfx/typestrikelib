import { CSGearSlot, Instance } from "../core/engine";
import type { CSGrenadeProjectileBase, CSGrenadeType, CSPlayerPawn, CSWeaponBase, CSWeaponType } from "cs_script/point_script";
import { Events, type Unsubscribe } from "../core/events";

/** Give several items, e.g. `["weapon_ak47", "weapon_deagle", "item_assaultsuit"]`. The last one is deployed when `autoDeploy`. */
export function giveItems(pawn: CSPlayerPawn, items: readonly string[], autoDeploy = false): void {
    items.forEach((item, i) => pawn.GiveNamedItem(item, autoDeploy && i === items.length - 1));
}

export const getPrimary = (pawn: CSPlayerPawn) => pawn.FindWeaponBySlot(CSGearSlot.RIFLE);
export const getSecondary = (pawn: CSPlayerPawn) => pawn.FindWeaponBySlot(CSGearSlot.PISTOL);
export const getKnife = (pawn: CSPlayerPawn) => pawn.FindWeaponBySlot(CSGearSlot.KNIFE);

/** The weapon's name from its data, e.g. `"weapon_ak47"`. */
export function weaponName(weapon: CSWeaponBase): string {
    return weapon.GetData().GetName();
}

export function isWeaponType(weapon: CSWeaponBase | undefined, type: CSWeaponType): boolean {
    return weapon !== undefined && weapon.GetData().GetType() === type;
}

/**
 * Remove a player's weapons. By default the knife is kept.
 * `keep` lists weapon names to leave alone (as returned by {@link weaponName}).
 */
export function stripWeapons(pawn: CSPlayerPawn, options: { keepKnife?: boolean; keep?: readonly string[] } = {}): void {
    const keepKnife = options.keepKnife ?? true;
    if (!keepKnife && !options.keep?.length) {
        pawn.DestroyWeapons();
        return;
    }
    const keep = new Set(options.keep ?? []);
    const slots = [CSGearSlot.RIFLE, CSGearSlot.PISTOL, CSGearSlot.GRENADES, CSGearSlot.C4, CSGearSlot.BOOSTS];
    if (!keepKnife) slots.push(CSGearSlot.KNIFE);
    for (const slot of slots) {
        // FindWeaponBySlot returns one weapon at a time; a slot can hold several (grenades).
        for (let guard = 0; guard < 16; guard++) {
            const w = pawn.FindWeaponBySlot(slot);
            if (!w || keep.has(weaponName(w))) break;
            pawn.DestroyWeapon(w);
        }
    }
}

/** Fill a weapon's clip and/or reserve to the maximum from its weapon data. */
export function refillAmmo(weapon: CSWeaponBase, options: { clip?: boolean; reserve?: boolean } = {}): void {
    const data = weapon.GetData();
    if (options.clip !== false && data.GetMaxClipAmmo() > 0) weapon.SetClipAmmo(data.GetMaxClipAmmo());
    if (options.reserve !== false && data.GetMaxReserveAmmo() > 0) weapon.SetReserveAmmo(data.GetMaxReserveAmmo());
}

/** Refill the primary and secondary weapons. */
export function refillAllAmmo(pawn: CSPlayerPawn): void {
    for (const w of [getPrimary(pawn), getSecondary(pawn)]) if (w) refillAmmo(w);
}

/**
 * Infinite ammo. `"clip"` keeps the magazine full (no reloading); `"reserve"` keeps the reserve
 * full so reloads never run out. Pass `filter` to limit it to some players. Returns a function
 * that turns it off.
 */
export function enableInfiniteAmmo(mode: "clip" | "reserve" = "reserve", filter?: (pawn: CSPlayerPawn) => boolean): Unsubscribe {
    return Events.on("GunFire", ({ weapon }) => {
        const owner = weapon.GetOwner();
        if (!owner || (filter && !filter(owner))) return;
        // Refill after the engine has finished processing this shot.
        Instance.QueueAfterThinks(() => {
            if (!weapon.IsValid()) return;
            refillAmmo(weapon, { clip: mode === "clip", reserve: mode === "reserve" });
        });
    });
}

/** Spawn a live grenade as if `pawn` threw it. `strength` is 0-1. */
export function throwGrenade(pawn: CSPlayerPawn, type: CSGrenadeType, strength = 1): CSGrenadeProjectileBase {
    return Instance.SpawnGrenadeProjectile({ type, thrower: pawn, throwStrength: strength });
}
