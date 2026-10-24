import { Instance } from "../core/engine";
import type { ColorArg, QAngle, TraceResult, Vector } from "cs_script/point_script";
import { basis } from "../math/angles";
import { Colors } from "../math/color";
import { add, addScaled, cross, length, normalize, scale, sub, vec } from "../math/vector";

/*
 * Debug drawing on top of Instance.DebugLine / DebugSphere / DebugBox / DebugScreenText.
 * These only show up in dev environments (tools mode / local listen server).
 * `duration` is in seconds; when redrawing every think, use the think interval.
 */

const DEFAULT_DURATION = 1;

export const Draw = {
    line(start: Vector, end: Vector, color: ColorArg = Colors.WHITE, duration = DEFAULT_DURATION): void {
        Instance.DebugLine({ start, end, color, duration });
    },

    /** A line with an arrowhead at `end`. */
    arrow(start: Vector, end: Vector, color: ColorArg = Colors.YELLOW, duration = DEFAULT_DURATION, headSize?: number): void {
        Instance.DebugLine({ start, end, color, duration });
        const dir = sub(end, start);
        const len = length(dir);
        if (len === 0) return;
        const f = scale(dir, 1 / len);
        const size = headSize ?? Math.min(16, len * 0.25);
        // Any vector not parallel to f gives a perpendicular via the cross product.
        const helper = Math.abs(f.z) < 0.99 ? vec(0, 0, 1) : vec(1, 0, 0);
        const side = normalize(cross(f, helper));
        const back = addScaled(end, f, -size);
        Instance.DebugLine({ start: end, end: addScaled(back, side, size * 0.5), color, duration });
        Instance.DebugLine({ start: end, end: addScaled(back, side, -size * 0.5), color, duration });
    },

    /** A small 3D cross marking a point. */
    point(position: Vector, size = 8, color: ColorArg = Colors.CYAN, duration = DEFAULT_DURATION): void {
        const h = size / 2;
        for (const axis of [vec(h, 0, 0), vec(0, h, 0), vec(0, 0, h)]) {
            Instance.DebugLine({ start: sub(position, axis), end: add(position, axis), color, duration });
        }
    },

    /** Forward (red), left (green) and up (blue) axes of an orientation. */
    axes(origin: Vector, angles: QAngle, size = 32, duration = DEFAULT_DURATION): void {
        const b = basis(angles);
        Instance.DebugLine({ start: origin, end: addScaled(origin, b.forward, size), color: Colors.RED, duration });
        Instance.DebugLine({ start: origin, end: addScaled(origin, b.right, -size), color: Colors.GREEN, duration });
        Instance.DebugLine({ start: origin, end: addScaled(origin, b.up, size), color: Colors.BLUE, duration });
    },

    box(mins: Vector, maxs: Vector, color: ColorArg = Colors.ORANGE, duration = DEFAULT_DURATION): void {
        Instance.DebugBox({ mins, maxs, color, duration });
    },

    /** Box from a center and half-size. */
    boxAt(center: Vector, halfExtents: Vector, color: ColorArg = Colors.ORANGE, duration = DEFAULT_DURATION): void {
        Instance.DebugBox({ mins: sub(center, halfExtents), maxs: add(center, halfExtents), color, duration });
    },

    sphere(center: Vector, radius: number, color: ColorArg = Colors.MAGENTA, duration = DEFAULT_DURATION): void {
        Instance.DebugSphere({ center, radius, color, duration });
    },

    /** Visualise a trace: the path (green if clear, red if it hit), the hit point and the surface normal. */
    trace(start: Vector, result: TraceResult, duration = DEFAULT_DURATION): void {
        const color = result.didHit ? Colors.RED : Colors.GREEN;
        Instance.DebugLine({ start, end: result.end, color, duration });
        if (result.didHit) {
            Instance.DebugSphere({ center: result.end, radius: 2, color, duration });
            Draw.arrow(result.end, addScaled(result.end, result.normal, 16), Colors.YELLOW, duration, 4);
        }
    },

    /** Text on screen at pixel position `x`, `y` from the top-left. Multi-line strings work. */
    text(text: string, x = 20, y = 100, color: ColorArg = Colors.WHITE, duration = DEFAULT_DURATION): void {
        Instance.DebugScreenText({ text, x, y, color, duration });
    },
};
