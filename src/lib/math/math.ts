/** Scalar helpers. */

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

export function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
    return clamp(value, 0, 1);
}

/** Linear interpolation: `t = 0` gives `a`, `t = 1` gives `b`. `t` is not clamped. */
export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Where `value` falls between `a` and `b`, as a fraction (the inverse of {@link lerp}). */
export function inverseLerp(a: number, b: number, value: number): number {
    return a === b ? 0 : (value - a) / (b - a);
}

/** Map `value` from the range `[inMin, inMax]` to `[outMin, outMax]`. Pass `clampResult` to stay inside the output range. */
export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number, clampResult = false): number {
    const t = inverseLerp(inMin, inMax, value);
    return lerp(outMin, outMax, clampResult ? clamp01(t) : t);
}

/** Move `current` toward `target` by at most `maxDelta`, without overshooting. */
export function approach(current: number, target: number, maxDelta: number): number {
    if (current < target) return Math.min(current + maxDelta, target);
    return Math.max(current - maxDelta, target);
}

export function degToRad(degrees: number): number {
    return degrees * DEG_TO_RAD;
}

export function radToDeg(radians: number): number {
    return radians * RAD_TO_DEG;
}

export function approxEqual(a: number, b: number, epsilon = 1e-4): boolean {
    return Math.abs(a - b) <= epsilon;
}

/** Round to a number of decimal places. */
export function roundTo(value: number, decimals = 0): number {
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
}

/** Wrap `value` into `[min, max)`. */
export function wrap(value: number, min: number, max: number): number {
    const range = max - min;
    if (range <= 0) return min;
    return ((((value - min) % range) + range) % range) + min;
}

/** Smooth Hermite interpolation between 0 and 1 as `x` goes from `edge0` to `edge1`. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = clamp01(inverseLerp(edge0, edge1, x));
    return t * t * (3 - 2 * t);
}

/** Sign of `value` as -1, 0 or 1. */
export function sign(value: number): -1 | 0 | 1 {
    return value > 0 ? 1 : value < 0 ? -1 : 0;
}
