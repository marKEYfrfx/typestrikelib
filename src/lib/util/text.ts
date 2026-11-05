/**
 * Compare two strings for sorting, ignoring case: `names.sort(compareText)`.
 *
 * Use this instead of `String.prototype.localeCompare`. cs_script's V8 is built without ICU, so
 * `localeCompare` throws "RangeError: Internal error. Icu error." in game (seen Nov 3, 2026).
 * The order here is by UTF-16 code unit, so it is stable but not language-aware.
 */
export function compareText(a: string, b: string): number {
    const la = a.toLowerCase();
    const lb = b.toLowerCase();
    if (la !== lb) return la < lb ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
}
