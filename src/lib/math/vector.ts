import type { Vector } from "cs_script/point_script";
import { DEG_TO_RAD, RAD_TO_DEG, clamp } from "./math";

/*
 * Vector helpers for the plain `{ x, y, z }` objects cs_script uses everywhere.
 * Every function returns a new object; inputs are never modified.
 * Source 2 axes: +X forward, +Y left, +Z up. Units are Hammer units (inches).
 */

export type { Vector };

/** Shorthand for creating a vector. */
export function vec(x = 0, y = 0, z = 0): Vector {
    return { x, y, z };
}

export const ZERO: Readonly<Vector> = Object.freeze(vec(0, 0, 0));
export const ONE: Readonly<Vector> = Object.freeze(vec(1, 1, 1));
export const UP: Readonly<Vector> = Object.freeze(vec(0, 0, 1));
export const DOWN: Readonly<Vector> = Object.freeze(vec(0, 0, -1));
export const FORWARD: Readonly<Vector> = Object.freeze(vec(1, 0, 0));
export const LEFT: Readonly<Vector> = Object.freeze(vec(0, 1, 0));

export function copy(v: Vector): Vector {
    return { x: v.x, y: v.y, z: v.z };
}

export function add(a: Vector, b: Vector): Vector {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vector, b: Vector): Vector {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

/** Component-wise multiply. */
export function mul(a: Vector, b: Vector): Vector {
    return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

export function scale(v: Vector, s: number): Vector {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/** `a + b * s` without allocating an intermediate vector. */
export function addScaled(a: Vector, b: Vector, s: number): Vector {
    return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}

export function negate(v: Vector): Vector {
    return { x: -v.x, y: -v.y, z: -v.z };
}

export function dot(a: Vector, b: Vector): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vector, b: Vector): Vector {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

export function lengthSqr(v: Vector): number {
    return v.x * v.x + v.y * v.y + v.z * v.z;
}

export function length(v: Vector): number {
    return Math.sqrt(lengthSqr(v));
}

/** Length ignoring Z, e.g. a player's horizontal speed. */
export function length2D(v: Vector): number {
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function distance(a: Vector, b: Vector): number {
    return length(sub(a, b));
}

export function distanceSqr(a: Vector, b: Vector): number {
    return lengthSqr(sub(a, b));
}

export function distance2D(a: Vector, b: Vector): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Unit vector in the same direction. Returns the zero vector for zero-length input. */
export function normalize(v: Vector): Vector {
    const len = length(v);
    return len > 0 ? scale(v, 1 / len) : vec();
}

/** Same direction, given length. */
export function withLength(v: Vector, len: number): Vector {
    return scale(normalize(v), len);
}

/** Shorten `v` to at most `maxLength`. */
export function clampLength(v: Vector, maxLength: number): Vector {
    const len = length(v);
    return len > maxLength && len > 0 ? scale(v, maxLength / len) : copy(v);
}

export function lerp(a: Vector, b: Vector, t: number): Vector {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export function midpoint(a: Vector, b: Vector): Vector {
    return lerp(a, b, 0.5);
}

/** Move `current` toward `target` by at most `maxDistance`. */
export function moveTowards(current: Vector, target: Vector, maxDistance: number): Vector {
    const delta = sub(target, current);
    const dist = length(delta);
    if (dist <= maxDistance || dist === 0) return copy(target);
    return addScaled(current, delta, maxDistance / dist);
}

export function equals(a: Vector, b: Vector, epsilon = 1e-4): boolean {
    return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon && Math.abs(a.z - b.z) <= epsilon;
}

export function isZero(v: Vector, epsilon = 1e-6): boolean {
    return lengthSqr(v) <= epsilon * epsilon;
}

/** Component of `v` along `onto`. */
export function project(v: Vector, onto: Vector): Vector {
    const d = lengthSqr(onto);
    return d === 0 ? vec() : scale(onto, dot(v, onto) / d);
}

/** Remove the component of `v` along `normal`, leaving the part that lies on the plane. */
export function projectOnPlane(v: Vector, normal: Vector): Vector {
    return sub(v, project(v, normal));
}

/** Reflect `v` off a surface with unit normal `normal`. */
export function reflect(v: Vector, normal: Vector): Vector {
    return addScaled(v, normal, -2 * dot(v, normal));
}

/** Copy with Z set to 0 (or a given value). */
export function flatten(v: Vector, z = 0): Vector {
    return { x: v.x, y: v.y, z };
}

export function min(a: Vector, b: Vector): Vector {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) };
}

export function max(a: Vector, b: Vector): Vector {
    return { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) };
}

export function abs(v: Vector): Vector {
    return { x: Math.abs(v.x), y: Math.abs(v.y), z: Math.abs(v.z) };
}

export function round(v: Vector, decimals = 0): Vector {
    const f = 10 ** decimals;
    return { x: Math.round(v.x * f) / f, y: Math.round(v.y * f) / f, z: Math.round(v.z * f) / f };
}

/** Angle between two vectors in degrees. */
export function angleBetween(a: Vector, b: Vector): number {
    const d = length(a) * length(b);
    if (d === 0) return 0;
    return Math.acos(clamp(dot(a, b) / d, -1, 1)) * RAD_TO_DEG;
}

/** Rotate around the Z axis by `degrees` (positive turns left, matching yaw). */
export function rotateZ(v: Vector, degrees: number): Vector {
    const r = degrees * DEG_TO_RAD;
    const c = Math.cos(r);
    const s = Math.sin(r);
    return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

/** Is `p` inside the axis-aligned box `mins`..`maxs` (inclusive)? */
export function inBox(p: Vector, mins: Vector, maxs: Vector): boolean {
    return p.x >= mins.x && p.x <= maxs.x && p.y >= mins.y && p.y <= maxs.y && p.z >= mins.z && p.z <= maxs.z;
}

/** Box corners from a center and half-size. */
export function boxFromCenter(center: Vector, halfExtents: Vector): { mins: Vector; maxs: Vector } {
    return { mins: sub(center, halfExtents), maxs: add(center, halfExtents) };
}

/** Closest point to `p` on the segment `a`..`b`. */
export function closestPointOnSegment(p: Vector, a: Vector, b: Vector): Vector {
    const ab = sub(b, a);
    const d = lengthSqr(ab);
    if (d === 0) return copy(a);
    return addScaled(a, ab, clamp(dot(sub(p, a), ab) / d, 0, 1));
}

/** Readable form, e.g. `(12.0, -4.5, 64.0)`. */
export function format(v: Vector, digits = 1): string {
    return `(${v.x.toFixed(digits)}, ${v.y.toFixed(digits)}, ${v.z.toFixed(digits)})`;
}

/** The space-separated form entity inputs and keyvalues use, e.g. `"12 -4.5 64"`. */
export function toInputString(v: Vector): string {
    return `${v.x} ${v.y} ${v.z}`;
}

/** Parse `"x y z"` or `"x, y, z"` into a vector. Returns `undefined` if it isn't three numbers. */
export function parse(text: string): Vector | undefined {
    const parts = text.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return undefined;
    return vec(parts[0], parts[1], parts[2]);
}

/** Is this value a `{ x, y, z }` vector? */
export function isVector(value: unknown): value is Vector {
    if (typeof value !== "object" || value === null) return false;
    const v = value as Record<string, unknown>;
    return typeof v.x === "number" && typeof v.y === "number" && typeof v.z === "number";
}
