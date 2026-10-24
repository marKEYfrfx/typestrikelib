import type { Color, ColorArg } from "cs_script/point_script";
import { clamp } from "./math";

export type { Color, ColorArg };

/** Build a color. Components are 0-255; alpha defaults to 255. */
export function rgb(r: number, g: number, b: number, a = 255): Color {
    return { r, g, b, a };
}

/** Common colors for debug drawing, glows and HUD tinting. Team colors are approximations of the in-game HUD colors. */
export const Colors = {
    WHITE: rgb(255, 255, 255),
    BLACK: rgb(0, 0, 0),
    GRAY: rgb(128, 128, 128),
    RED: rgb(255, 64, 64),
    GREEN: rgb(64, 255, 96),
    BLUE: rgb(64, 128, 255),
    YELLOW: rgb(255, 230, 64),
    ORANGE: rgb(255, 150, 40),
    CYAN: rgb(64, 230, 255),
    MAGENTA: rgb(255, 64, 230),
    PURPLE: rgb(160, 90, 255),
    CT: rgb(94, 152, 217),
    T: rgb(234, 190, 84),
} as const satisfies Record<string, Color>;

/** Parse `#rgb`, `#rrggbb` or `#rrggbbaa` (the `#` is optional). Returns `undefined` for invalid input. */
export function hex(text: string): Color | undefined {
    let h = text.trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return undefined;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return rgb(n(0), n(2), n(4), h.length === 8 ? n(6) : 255);
}

/** Format as `#rrggbb` (or `#rrggbbaa` when `includeAlpha`). */
export function toHex(c: ColorArg, includeAlpha = false): string {
    const h = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
    return `#${h(c.r)}${h(c.g)}${h(c.b)}${includeAlpha ? h(c.a ?? 255) : ""}`;
}

/** HSV to RGB. `h` in degrees (0-360), `s` and `v` in 0-1. */
export function hsv(h: number, s: number, v: number, a = 255): Color {
    const hh = (((h % 360) + 360) % 360) / 60;
    const c = v * s;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    const m = v - c;
    const [r, g, b] =
        hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
    return rgb(Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255), a);
}

/** Blend between two colors. */
export function lerpColor(a: ColorArg, b: ColorArg, t: number): Color {
    const l = (x: number, y: number) => Math.round(x + (y - x) * t);
    return rgb(l(a.r, b.r), l(a.g, b.g), l(a.b, b.b), l(a.a ?? 255, b.a ?? 255));
}

export function withAlpha(c: ColorArg, a: number): Color {
    return rgb(c.r, c.g, c.b, a);
}

/** Red-to-green health-bar color: `fraction` 0 is red, 1 is green. */
export function healthColor(fraction: number): Color {
    return hsv(clamp(fraction, 0, 1) * 120, 0.85, 1);
}

/** The space-separated form color inputs use, e.g. `"255 0 0"`. */
export function colorToInputString(c: ColorArg): string {
    return c.a === undefined ? `${c.r} ${c.g} ${c.b}` : `${c.r} ${c.g} ${c.b} ${c.a}`;
}
