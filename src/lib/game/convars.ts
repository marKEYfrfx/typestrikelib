import { Console } from "../core/engine";
import type { Color, ColorArg, QAngle, Vector } from "cs_script/point_script";
import { libLog } from "../core/log";

/** Any value `Console.SetConvar` accepts. */
export type ConvarValue = boolean | number | string | Vector | QAngle | ColorArg;

/** Saved convar values, returned by {@link Convars.apply} and accepted by {@link Convars.restore}. */
export type ConvarSnapshot = ReadonlyArray<readonly [name: string, value: ConvarValue]>;

function isAngle(v: object): v is QAngle {
    return "pitch" in v;
}
function isColor(v: object): v is ColorArg {
    return "r" in v;
}

function readLike(name: string, like: ConvarValue): ConvarValue | undefined {
    switch (typeof like) {
        case "number":
            return Console.GetConvarNumber(name);
        case "boolean":
            return Console.GetConvarBoolean(name);
        case "string":
            return Console.GetConvarString(name);
        default:
            if (isAngle(like)) return Console.GetConvarQAngle(name);
            if (isColor(like)) return Console.GetConvarColor(name);
            return Console.GetConvarVector(name);
    }
}

/** Typed console variable access. Uses `Console.SetConvar`, so values never pass through a command string. */
export const Convars = {
    number(name: string, fallback: number): number {
        return Console.GetConvarNumber(name) ?? fallback;
    },
    bool(name: string, fallback: boolean): boolean {
        return Console.GetConvarBoolean(name) ?? fallback;
    },
    string(name: string, fallback = ""): string {
        return Console.GetConvarString(name) ?? fallback;
    },
    vector(name: string): Vector | undefined {
        return Console.GetConvarVector(name);
    },
    angle(name: string): QAngle | undefined {
        return Console.GetConvarQAngle(name);
    },
    color(name: string): Color | undefined {
        return Console.GetConvarColor(name);
    },

    /** `true` if the convar exists. */
    exists(name: string): boolean {
        return Console.GetConvarString(name) !== undefined;
    },

    set(name: string, value: ConvarValue): void {
        Console.SetConvar(name, value);
    },

    /**
     * Set several convars and return their previous values so they can be put back.
     *
     * ```ts
     * const saved = Convars.apply(ConvarPresets.kz);
     * // later
     * Convars.restore(saved);
     * ```
     */
    apply(values: Readonly<Record<string, ConvarValue>>): ConvarSnapshot {
        const snapshot: Array<readonly [string, ConvarValue]> = [];
        for (const [name, value] of Object.entries(values)) {
            const previous = readLike(name, value);
            if (previous === undefined) {
                libLog.warn(`Convar "${name}" does not exist; skipped.`);
                continue;
            }
            snapshot.push([name, previous]);
            Console.SetConvar(name, value);
        }
        return snapshot;
    },

    /** Put back values saved by {@link Convars.apply}. */
    restore(snapshot: ConvarSnapshot): void {
        for (const [name, value] of snapshot) Console.SetConvar(name, value);
    },
};

/** Ready-made convar sets. Apply with `Convars.apply(ConvarPresets.kz)`. */
export const ConvarPresets = {
    /** KZ / movement-map settings (from GlobalDefensive's CKZExec). */
    kz: {
        sv_airaccelerate: 100,
        sv_enablebunnyhopping: true,
        sv_autobunnyhopping: false,
        sv_falldamage_scale: 0,
        sv_staminajumpcost: 0,
        sv_staminalandcost: 0,
        sv_timebetweenducks: 0,
        sv_staminarecoveryrate: 60,
        sv_staminamax: 0,
        sv_ladder_scale_speed: 1,
        sv_jump_impulse: 301.993378,
        sv_friction: 5,
        sv_accelerate_use_weapon_speed: false,
        sv_accelerate: 6.5,
        sv_maxvelocity: 2000,
        sv_air_max_wishspeed: 30,
        sv_gravity: 800,
        sv_standable_normal: 0.7,
        sv_wateraccelerate: 10,
        sv_disable_radar: 1,
    },
    /** Endless offline warmup for building and testing (from GlobalDefensive's index.ts). */
    sandbox: {
        mp_warmup_offline_enabled: 1,
        mp_warmup_pausetimer: 1,
        bot_stop: 1,
        mp_buy_anywhere: 1,
    },
} as const satisfies Record<string, Record<string, ConvarValue>>;
