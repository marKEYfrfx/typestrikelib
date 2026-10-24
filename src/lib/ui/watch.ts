import { Instance } from "../core/engine";
import type { ColorArg } from "cs_script/point_script";
import { inspect } from "../core/log";
import { Timers, type TimerHandle } from "../core/scheduler";
import { Colors } from "../math/color";

/*
 * Live values on screen while you develop: `Watch.set("speed", speed2D(pawn))` anywhere, and the
 * latest value of each key is drawn as a list. Uses DebugScreenText, so dev environments only;
 * for something players can see in a real match, use DebugMenu.watch().
 */

const values = new Map<string, unknown>();
let timer: TimerHandle | undefined;
/** `x`/`y` are pixels from the top-left of the screen. */
let settings = { x: 20, y: 300, interval: 0.1, color: Colors.WHITE as ColorArg, title: "watch" };

function render(): void {
    if (values.size === 0) return;
    const lines = [`[${settings.title}]`];
    for (const [k, v] of values) lines.push(`${k}: ${inspect(v, 1)}`);
    Instance.DebugScreenText({
        text: lines.join("\n"),
        x: settings.x,
        y: settings.y,
        duration: settings.interval,
        color: settings.color,
    });
}

export const Watch = {
    /** Show `value` under `key`. Starts the display automatically. */
    set(key: string, value: unknown): void {
        values.set(key, value);
        if (!timer) Watch.start();
    },
    delete(key: string): void {
        values.delete(key);
    },
    clear(): void {
        values.clear();
    },
    /** Start drawing (optionally with a position, refresh interval, color and title). */
    start(options: Partial<typeof settings> = {}): void {
        settings = { ...settings, ...options };
        timer?.cancel();
        timer = Timers.every(settings.interval, render, { immediate: true });
    },
    stop(): void {
        timer?.cancel();
        timer = undefined;
    },
};
