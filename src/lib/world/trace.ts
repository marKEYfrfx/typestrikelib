import { Instance } from "../core/engine";
import type { BaseTraceConfig, CSPlayerPawn, Entity, TraceResult, Vector } from "cs_script/point_script";
import { forward } from "../math/angles";
import { addScaled, vec } from "../math/vector";
import { compact } from "../util/object";

/** Simpler trace options. */
export interface TraceOptions {
    /** Entities to pass through. */
    ignore?: Entity | Entity[];
    /** Pass through all players. */
    ignorePlayers?: boolean;
    /** Hit player hitboxes instead of their larger collision box. Needed to get `hitGroup`. */
    hitboxes?: boolean;
}

function config(start: Vector, end: Vector, o: TraceOptions = {}): BaseTraceConfig {
    const c: BaseTraceConfig = { start, end };
    if (o.ignore !== undefined) c.ignoreEntity = o.ignore;
    if (o.ignorePlayers !== undefined) c.ignorePlayers = o.ignorePlayers;
    if (o.hitboxes !== undefined) c.traceHitboxes = o.hitboxes;
    return c;
}

function withIgnored(o: TraceOptions, ...extra: Entity[]): TraceOptions {
    const current = o.ignore === undefined ? [] : Array.isArray(o.ignore) ? o.ignore : [o.ignore];
    return { ...o, ignore: [...current, ...extra] };
}

/** Trace a line from `start` to `end`. */
export function traceLine(start: Vector, end: Vector, options?: TraceOptions): TraceResult {
    return Instance.TraceLine(config(start, end, options));
}

/** Trace from `start` along `direction` for `distance` units. */
export function traceRay(start: Vector, direction: Vector, distance: number, options?: TraceOptions): TraceResult {
    return Instance.TraceLine(config(start, addScaled(start, direction, distance), options));
}

/** Trace a sphere (a "thick" line) from `start` to `end`. */
export function traceSphere(start: Vector, end: Vector, radius: number, options?: TraceOptions): TraceResult {
    return Instance.TraceSphere({ radius, ...config(start, end, options) });
}

/** Trace an axis-aligned box from `start` to `end`. */
export function traceBox(start: Vector, end: Vector, mins: Vector, maxs: Vector, options?: TraceOptions): TraceResult {
    return Instance.TraceBox({ mins, maxs, ...config(start, end, options) });
}

/**
 * Trace from an entity's eyes along its view direction, ignoring the entity itself.
 * For a player this is what's under their crosshair.
 */
export function traceFromEyes(entity: Entity, distance = 8192, options: TraceOptions = {}): TraceResult {
    const start = entity.GetEyePosition();
    return traceRay(start, forward(entity.GetEyeAngles()), distance, withIgnored(options, entity));
}

/** The entity under a player's crosshair, if any (world hits return `undefined`). */
export function getAimTarget(pawn: CSPlayerPawn, distance = 8192, options: TraceOptions = {}): Entity | undefined {
    const tr = traceFromEyes(pawn, distance, { hitboxes: true, ...options });
    return tr.didHit && tr.hitEntity && !tr.hitEntity.IsWorld() ? tr.hitEntity : undefined;
}

function eyesOrPoint(x: Entity | Vector): Vector {
    return "GetEyePosition" in x ? x.GetEyePosition() : x;
}

/**
 * Can `from` see `to`? Entities are measured from their eyes; both are ignored by the trace.
 * The trace is a plain line, so a gap any wider than a point counts as visible.
 */
export function hasLineOfSight(from: Entity | Vector, to: Entity | Vector, options: TraceOptions = {}): boolean {
    const ignore: Entity[] = [];
    if ("IsValid" in from) ignore.push(from);
    if ("IsValid" in to) ignore.push(to);
    const tr = traceLine(eyesOrPoint(from), eyesOrPoint(to), withIgnored(options, ...ignore));
    return !tr.didHit;
}

/** The floor below `position` (within `maxDistance`), or `undefined` if there is none. */
export function findGround(position: Vector, maxDistance = 4096, options?: TraceOptions): Vector | undefined {
    const tr = traceLine(position, vec(position.x, position.y, position.z - maxDistance), options);
    return tr.didHit && !tr.startedInSolid ? tr.end : undefined;
}

/** `true` if `pawn` would fit at `position` without being stuck (optionally as a crouched player). */
export function canPlayerFit(pawn: CSPlayerPawn, position: Vector, ducked?: boolean): boolean {
    const tr = Instance.TracePlayer(compact({ start: position, player: pawn, isDucked: ducked }));
    return !tr.startedInSolid && !tr.didHit;
}

/**
 * Trace as a bullet fired from a player's eyes along their view. Returns every hit, with damage
 * after distance falloff and penetration. Damage values default to the player's active weapon.
 */
export function traceBulletFromEyes(pawn: CSPlayerPawn, options: { distance?: number; damage?: number; rangeModifier?: number; penetration?: number } = {}) {
    const data = pawn.GetActiveWeapon()?.GetData();
    const start = pawn.GetEyePosition();
    const end = addScaled(start, forward(pawn.GetEyeAngles()), options.distance ?? data?.GetRange() ?? 8192);
    return Instance.TraceBullet(
        compact({
            start,
            end,
            shooter: pawn,
            damage: options.damage ?? data?.GetDamage(),
            rangeModifier: options.rangeModifier ?? data?.GetRangeModifier(),
            penetration: options.penetration ?? data?.GetPenetration(),
        }),
    );
}
