import type { QAngle, Vector } from "cs_script/point_script";
import { DEG_TO_RAD, RAD_TO_DEG } from "./math";
import { add, dot, scale, sub, vec } from "./vector";

/*
 * QAngle helpers, using Source conventions:
 * - pitch: positive looks DOWN, -90..90
 * - yaw:   positive turns LEFT (counter-clockwise seen from above), 0 = +X
 * - roll:  positive tilts right
 */

export type { QAngle };

export function ang(pitch = 0, yaw = 0, roll = 0): QAngle {
    return { pitch, yaw, roll };
}

export const ZERO_ANGLE: Readonly<QAngle> = Object.freeze(ang());

export function copyAngle(a: QAngle): QAngle {
    return { pitch: a.pitch, yaw: a.yaw, roll: a.roll };
}

/** Wrap an angle in degrees into `(-180, 180]`. */
export function normalizeDegrees(degrees: number): number {
    let d = degrees % 360;
    if (d > 180) d -= 360;
    else if (d <= -180) d += 360;
    return d;
}

/** Wrap every component into `(-180, 180]`. */
export function normalize(a: QAngle): QAngle {
    return { pitch: normalizeDegrees(a.pitch), yaw: normalizeDegrees(a.yaw), roll: normalizeDegrees(a.roll) };
}

/** Shortest signed difference `to - from`, in `(-180, 180]`. */
export function angleDiff(from: number, to: number): number {
    return normalizeDegrees(to - from);
}

/** Interpolate one angle in degrees along the shortest path. */
export function lerpDegrees(from: number, to: number, t: number): number {
    return normalizeDegrees(from + angleDiff(from, to) * t);
}

/** Interpolate each component along the shortest path. */
export function lerpAngles(a: QAngle, b: QAngle, t: number): QAngle {
    return { pitch: lerpDegrees(a.pitch, b.pitch, t), yaw: lerpDegrees(a.yaw, b.yaw, t), roll: lerpDegrees(a.roll, b.roll, t) };
}

export function anglesEqual(a: QAngle, b: QAngle, epsilon = 1e-3): boolean {
    return (
        Math.abs(angleDiff(a.pitch, b.pitch)) <= epsilon &&
        Math.abs(angleDiff(a.yaw, b.yaw)) <= epsilon &&
        Math.abs(angleDiff(a.roll, b.roll)) <= epsilon
    );
}

/** Forward, right and up unit vectors for an orientation (Source's `AngleVectors`). */
export function basis(a: QAngle): { forward: Vector; right: Vector; up: Vector } {
    const p = a.pitch * DEG_TO_RAD;
    const y = a.yaw * DEG_TO_RAD;
    const r = a.roll * DEG_TO_RAD;
    const sp = Math.sin(p), cp = Math.cos(p);
    const sy = Math.sin(y), cy = Math.cos(y);
    const sr = Math.sin(r), cr = Math.cos(r);
    return {
        forward: vec(cp * cy, cp * sy, -sp),
        right: vec(-sr * sp * cy + cr * sy, -sr * sp * sy - cr * cy, -sr * cp),
        up: vec(cr * sp * cy + sr * sy, cr * sp * sy - sr * cy, cr * cp),
    };
}

/** Unit vector pointing where the angles face. */
export function forward(a: QAngle): Vector {
    const p = a.pitch * DEG_TO_RAD;
    const y = a.yaw * DEG_TO_RAD;
    const cp = Math.cos(p);
    return vec(cp * Math.cos(y), cp * Math.sin(y), -Math.sin(p));
}

export function right(a: QAngle): Vector {
    return basis(a).right;
}

export function up(a: QAngle): Vector {
    return basis(a).up;
}

/** Angles that face along `direction` (roll is 0). Pitch is in -90..90, yaw in (-180, 180]. */
export function fromDirection(direction: Vector): QAngle {
    const yaw = direction.x === 0 && direction.y === 0 ? 0 : Math.atan2(direction.y, direction.x) * RAD_TO_DEG;
    const pitch = Math.atan2(-direction.z, Math.sqrt(direction.x * direction.x + direction.y * direction.y)) * RAD_TO_DEG;
    return { pitch, yaw: normalizeDegrees(yaw), roll: 0 };
}

/** Angles at `from` that look toward `to`. */
export function lookAt(from: Vector, to: Vector): QAngle {
    return fromDirection(sub(to, from));
}

/**
 * Convert an offset in an entity's local space to a world position.
 * Local axes match Source: x forward, y left, z up (the same as `CameraFollowConfig.cameraOffset`).
 */
export function localToWorld(origin: Vector, angles: QAngle, local: Vector): Vector {
    const b = basis(angles);
    return add(origin, add(add(scale(b.forward, local.x), scale(b.right, -local.y)), scale(b.up, local.z)));
}

/** Inverse of {@link localToWorld}. */
export function worldToLocal(origin: Vector, angles: QAngle, world: Vector): Vector {
    const b = basis(angles);
    const d = sub(world, origin);
    return vec(dot(d, b.forward), -dot(d, b.right), dot(d, b.up));
}

/** Readable form, e.g. `[10.0, 90.0, 0.0]`. */
export function formatAngles(a: QAngle, digits = 1): string {
    return `[${a.pitch.toFixed(digits)}, ${a.yaw.toFixed(digits)}, ${a.roll.toFixed(digits)}]`;
}

/** The space-separated form entity inputs use, e.g. `"0 90 0"`. */
export function anglesToInputString(a: QAngle): string {
    return `${a.pitch} ${a.yaw} ${a.roll}`;
}

/** Is this value a `{ pitch, yaw, roll }` angle? */
export function isQAngle(value: unknown): value is QAngle {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return typeof v.pitch === "number" && typeof v.yaw === "number" && typeof v.roll === "number";
}
