import { CSMoveType } from "../core/engine";
import type { CSPlayerPawn, Entity, QAngle, Vector } from "cs_script/point_script";
import { fromDirection, forward } from "../math/angles";
import { length, length2D, sub } from "../math/vector";

/** Add health, capped at `max` (default: the pawn's max health). Returns the new health. */
export function heal(pawn: CSPlayerPawn, amount: number, max = pawn.GetMaxHealth()): number {
    const hp = Math.min(max, pawn.GetHealth() + amount);
    pawn.SetHealth(hp);
    return hp;
}

/** Set armor (0-100 by default) and optionally give or take a helmet. */
export function setArmor(pawn: CSPlayerPawn, armor: number, helmet?: boolean): void {
    pawn.SetArmor(Math.max(0, armor));
    if (helmet !== undefined) pawn.SetHasHelmet(helmet);
}

/** Full health and armor with helmet. */
export function restore(pawn: CSPlayerPawn, options: { armor?: number; helmet?: boolean } = {}): void {
    pawn.SetHealth(pawn.GetMaxHealth());
    setArmor(pawn, options.armor ?? 100, options.helmet ?? true);
}

const PREV_MOVE_TYPE = "__typestrike_prevMoveType";

/** Stop an entity from moving by setting its move type to NONE. {@link unfreeze} restores the previous move type. */
export function freeze(entity: Entity): void {
    const store = entity as unknown as Record<string, unknown>;
    const current = entity.GetMoveType();
    if (current !== CSMoveType.NONE && store[PREV_MOVE_TYPE] === undefined) store[PREV_MOVE_TYPE] = current;
    entity.SetMoveType(CSMoveType.NONE);
    entity.Teleport({ velocity: { x: 0, y: 0, z: 0 } });
}

export function unfreeze(entity: Entity): void {
    const store = entity as unknown as Record<string, unknown>;
    const prev = store[PREV_MOVE_TYPE] as CSMoveType | undefined;
    entity.SetMoveType(prev ?? CSMoveType.WALK);
    store[PREV_MOVE_TYPE] = undefined;
}

export function isFrozen(entity: Entity): boolean {
    return entity.GetMoveType() === CSMoveType.NONE;
}

/** Toggle noclip. Returns the new state. */
export function setNoclip(pawn: CSPlayerPawn, enabled = !pawn.IsNoclipping()): boolean {
    pawn.SetMoveType(enabled ? CSMoveType.NOCLIP : CSMoveType.WALK);
    return enabled;
}

/** Teleport with named options. `angles` on a player pawn turns the view (via `SetEyeAngles`). */
export function teleport(entity: Entity, to: { position?: Vector; angles?: QAngle; velocity?: Vector; stop?: boolean }): void {
    const values: { position?: Vector; angles?: QAngle; velocity?: Vector } = {};
    if (to.position) values.position = to.position;
    if (to.angles) values.angles = to.angles;
    if (to.velocity) values.velocity = to.velocity;
    else if (to.stop) values.velocity = { x: 0, y: 0, z: 0 };
    entity.Teleport(values);
    if (to.angles && "SetEyeAngles" in entity) (entity as CSPlayerPawn).SetEyeAngles(to.angles);
}

/** Add to (or, with `replace`, set) an entity's velocity. */
export function push(entity: Entity, velocity: Vector, replace = false): void {
    const v = replace ? velocity : { ...velocity };
    if (!replace) {
        const cur = entity.GetAbsVelocity();
        v.x += cur.x;
        v.y += cur.y;
        v.z += cur.z;
    }
    entity.Teleport({ velocity: v });
}

/** Turn a player's view to look at a point. */
export function lookAt(pawn: CSPlayerPawn, point: Vector): void {
    pawn.SetEyeAngles(fromDirection(sub(point, pawn.GetEyePosition())));
}

/** Unit vector of where an entity is looking. */
export function aimDirection(entity: Entity): Vector {
    return forward(entity.GetEyeAngles());
}

/** Speed in units/second. */
export function speed(entity: Entity): number {
    return length(entity.GetAbsVelocity());
}

/** Horizontal speed in units/second, the number movement maps usually show. */
export function speed2D(entity: Entity): number {
    return length2D(entity.GetAbsVelocity());
}

/** `true` if the entity is standing on something. */
export function isOnGround(entity: Entity): boolean {
    return entity.GetGroundEntity() !== undefined;
}
