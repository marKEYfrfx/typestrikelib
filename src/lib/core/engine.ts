/*
 * The one place the library reads values from "cs_script/point_script".
 *
 * Named imports (`import { GameRules } from "cs_script/point_script"`) are checked when the
 * script loads: if this CS2 build doesn't export one of them, the whole script fails to load and
 * nothing runs. A namespace import never fails that way. A missing export is just `undefined`,
 * only the feature that uses it breaks, and the check below says which names are missing.
 *
 * Library code imports values from here and types from "cs_script/point_script".
 */
import * as PS from "cs_script/point_script";

export const Instance = PS.Instance;
export type Instance = typeof PS.Instance;
export const Console = PS.Console;
export type Console = typeof PS.Console;
export const GameRules = PS.GameRules;
export type GameRules = typeof PS.GameRules;

export const Entity = PS.Entity;
export type Entity = PS.Entity;
export const BaseModelEntity = PS.BaseModelEntity;
export type BaseModelEntity = PS.BaseModelEntity;

export const CSInputs = PS.CSInputs;
export type CSInputs = PS.CSInputs;
export const CSMoveType = PS.CSMoveType;
export type CSMoveType = PS.CSMoveType;
export const CSGearSlot = PS.CSGearSlot;
export type CSGearSlot = PS.CSGearSlot;
export const CSRoundEndReason = PS.CSRoundEndReason;
export type CSRoundEndReason = PS.CSRoundEndReason;
export const CSTeamMoneyReason = PS.CSTeamMoneyReason;
export type CSTeamMoneyReason = PS.CSTeamMoneyReason;
export const CSDamageFlags = PS.CSDamageFlags;
export type CSDamageFlags = PS.CSDamageFlags;
export const CSDamageTypes = PS.CSDamageTypes;
export type CSDamageTypes = PS.CSDamageTypes;
export const CSHitGroup = PS.CSHitGroup;
export type CSHitGroup = PS.CSHitGroup;
export const CustomCameraMode = PS.CustomCameraMode;
export type CustomCameraMode = PS.CustomCameraMode;

/** Every value the library uses from the engine. */
export const ENGINE_EXPORTS = [
    "Instance",
    "Console",
    "GameRules",
    "Entity",
    "BaseModelEntity",
    "CSInputs",
    "CSMoveType",
    "CSGearSlot",
    "CSRoundEndReason",
    "CSTeamMoneyReason",
    "CSDamageFlags",
    "CSDamageTypes",
    "CSHitGroup",
    "CustomCameraMode",
] as const;

/** Names in {@link ENGINE_EXPORTS} that `module` (default: the real engine module) doesn't have. */
export function missingEngineExports(module: object = PS): string[] {
    const m = module as Record<string, unknown>;
    return ENGINE_EXPORTS.filter((name) => m[name] === undefined);
}

/**
 * Write a line to the game console. Uses `Console.Log`, or `Instance.Msg` on older CS2 builds
 * that don't have `Console` yet.
 */
export function consoleLog(line: string): void {
    if (Console && typeof Console.Log === "function") Console.Log(line);
    else (Instance as unknown as { Msg?: (t: string) => void }).Msg?.(line);
}

// Say once, at load, if this CS2 build is missing anything the library uses.
const missing = missingEngineExports();
if (missing.length > 0) {
    consoleLog(
        `[typestrike] WARN: this CS2 build's cs_script/point_script has no ${missing.join(", ")}. ` +
            "Features that use them won't work; everything else will.",
    );
}
