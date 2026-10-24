import type {
    BaseModelEntity,
    C4,
    CSGrenadeProjectileBase,
    CSHostage,
    CSObserverPawn,
    CSPlantedC4,
    CSPlayerController,
    CSPlayerPawn,
    CSWeaponBase,
    CustomHudLayout,
    Entity,
    PointTemplate,
} from "cs_script/point_script";

/*
 * Type guards for narrowing an `Entity` (e.g. `attacker`, `activator`, `hitEntity`) to a
 * specific class. They check for a method unique to each class rather than using `instanceof`.
 */

function has(e: unknown, method: string): boolean {
    return typeof e === "object" && e !== null && typeof (e as Record<string, unknown>)[method] === "function";
}

/** Not `undefined`, and `IsValid()` (not deleted). */
export function isValid<T extends Entity>(e: T | undefined | null): e is T {
    return e !== undefined && e !== null && e.IsValid();
}

export function isPlayerPawn(e: Entity | undefined | null): e is CSPlayerPawn {
    return has(e, "IsInputPressed");
}

export function isPlayerController(e: Entity | undefined | null): e is CSPlayerController {
    return has(e, "GetPlayerSlot");
}

export function isObserverPawn(e: Entity | undefined | null): e is CSObserverPawn {
    return has(e, "GetObserverMode");
}

export function isModelEntity(e: Entity | undefined | null): e is BaseModelEntity {
    return has(e, "SetModel");
}

export function isWeapon(e: Entity | undefined | null): e is CSWeaponBase {
    return has(e, "GetClipAmmo");
}

export function isC4(e: Entity | undefined | null): e is C4 {
    return has(e, "AbortPlant");
}

export function isPlantedC4(e: Entity | undefined | null): e is CSPlantedC4 {
    return has(e, "IsBombsiteA");
}

export function isHostage(e: Entity | undefined | null): e is CSHostage {
    return has(e, "IsBeingCarried");
}

export function isGrenadeProjectile(e: Entity | undefined | null): e is CSGrenadeProjectileBase {
    return has(e, "GetGrenadeType");
}

export function isPointTemplate(e: Entity | undefined | null): e is PointTemplate {
    return has(e, "ForceSpawn");
}

export function isCustomHudLayout(e: Entity | undefined | null): e is CustomHudLayout {
    return has(e, "SetDialogVariableString");
}
