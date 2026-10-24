import type { Vector } from "cs_script/point_script";
import { DEG_TO_RAD } from "./math";
import { vec } from "./vector";

/** A function returning a float in `[0, 1)`, like `Math.random`. */
export type RandomSource = () => number;

/**
 * A small seeded random generator (mulberry32). The same seed always gives the same sequence,
 * which is handy for reproducible wave layouts or procedural maps.
 */
export function seededRandom(seed: number): RandomSource {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Float in `[min, max)`. */
export function randomFloat(min: number, max: number, rng: RandomSource = Math.random): number {
    return min + (max - min) * rng();
}

/** Integer in `[min, max]`, both inclusive. */
export function randomInt(min: number, max: number, rng: RandomSource = Math.random): number {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return lo + Math.floor(rng() * (hi - lo + 1));
}

/** `true` with probability `p` (0-1). */
export function chance(p: number, rng: RandomSource = Math.random): boolean {
    return rng() < p;
}

/** A random element, or `undefined` for an empty array. */
export function pick<T>(items: readonly T[], rng: RandomSource = Math.random): T | undefined {
    return items.length === 0 ? undefined : items[Math.floor(rng() * items.length)];
}

/** Shuffle a copy of the array (Fisher-Yates). */
export function shuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

/** Pick an element with probability proportional to `weight(item)`. */
export function weightedPick<T>(items: readonly T[], weight: (item: T) => number, rng: RandomSource = Math.random): T | undefined {
    let total = 0;
    for (const item of items) total += Math.max(0, weight(item));
    if (total <= 0) return undefined;
    let r = rng() * total;
    for (const item of items) {
        r -= Math.max(0, weight(item));
        if (r < 0) return item;
    }
    return items[items.length - 1];
}

/** Random direction of length 1. */
export function randomDirection(rng: RandomSource = Math.random): Vector {
    const z = rng() * 2 - 1;
    const t = rng() * 2 * Math.PI;
    const r = Math.sqrt(1 - z * z);
    return vec(r * Math.cos(t), r * Math.sin(t), z);
}

/** Random point inside a sphere, uniformly distributed. */
export function randomInSphere(center: Vector, radius: number, rng: RandomSource = Math.random): Vector {
    const d = randomDirection(rng);
    const r = radius * Math.cbrt(rng());
    return vec(center.x + d.x * r, center.y + d.y * r, center.z + d.z * r);
}

/** Random point on a horizontal disc around `center` (same Z). */
export function randomInCircle(center: Vector, radius: number, rng: RandomSource = Math.random): Vector {
    const a = rng() * 360 * DEG_TO_RAD;
    const r = radius * Math.sqrt(rng());
    return vec(center.x + Math.cos(a) * r, center.y + Math.sin(a) * r, center.z);
}

/** Random point inside an axis-aligned box. */
export function randomInBox(mins: Vector, maxs: Vector, rng: RandomSource = Math.random): Vector {
    return vec(randomFloat(mins.x, maxs.x, rng), randomFloat(mins.y, maxs.y, rng), randomFloat(mins.z, maxs.z, rng));
}
