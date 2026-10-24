/**
 * Copy of `obj` without keys whose value is `undefined`.
 * Used before handing config objects to the engine, so optional fields are left out
 * rather than passed as `undefined`.
 */
export function compact<T extends object>(obj: T): T {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
    return out as T;
}
