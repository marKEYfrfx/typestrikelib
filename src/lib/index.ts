/**
 * typestrike: helper library for CS2 cs_script (point_script) written in TypeScript.
 *
 * Import what you need from here and bundle with esbuild (see package.json):
 *
 * ```ts
 * import { Events, Timers, ChatCommands, Vec, Logger } from "./lib";
 * ```
 *
 * Built against Valve's `point_script.d.ts`. Import Valve's types from "cs_script/point_script";
 * for Valve's values (Instance, Console, GameRules, enums) prefer the re-exports below.
 */

// core
/*
 * Valve's runtime values, re-exported through a namespace import (see core/engine.ts), so
 * importing them from here can never stop your script from loading. Import types from
 * "cs_script/point_script" as usual.
 */
export {
    Instance,
    Console,
    GameRules,
    CSInputs,
    CSMoveType,
    CSGearSlot,
    CSRoundEndReason,
    CSTeamMoneyReason,
    CSDamageFlags,
    CSDamageTypes,
    CSHitGroup,
    CustomCameraMode,
    missingEngineExports,
} from "./core/engine";
export { Events } from "./core/events";
export type { GameEventName, GameEventListener, GameEventListenerMap, GameEventPayload, ScriptInputData, Unsubscribe } from "./core/events";
export { Timers, TICK_INTERVAL, wait, waitTicks, waitUntil, afterThinks } from "./core/scheduler";
export type { TimerHandle, TimerCallback, RepeatOptions } from "./core/scheduler";
export { onReload, persistentState, clearPersistentState } from "./core/reload";
export { Signal, Scope } from "./core/signal";
export type { Disposable } from "./core/signal";
export { Logger, LogLevel, inspect, formatArgs } from "./core/log";

// math
export * as Vec from "./math/vector";
export * as Ang from "./math/angles";
export * as Random from "./math/random";
export {
    clamp,
    clamp01,
    lerp,
    inverseLerp,
    remap,
    approach,
    degToRad,
    radToDeg,
    approxEqual,
    roundTo,
    wrap,
    smoothstep,
    sign,
    DEG_TO_RAD,
    RAD_TO_DEG,
} from "./math/math";
export { Colors, rgb, hex, toHex, hsv, lerpColor, withAlpha, healthColor, colorToInputString } from "./math/color";

// entities
export { castEntity, tryCastEntity, EntityRef, EntityError } from "./entities/cast";
export type { EntityClass, CastOptions } from "./entities/cast";
export {
    findByName,
    findAllByName,
    requireByName,
    findByClass,
    findAllByClass,
    findInRadius,
    findNearest,
    describeEntity,
} from "./entities/find";
export type { EntityClassMap, EntitySource } from "./entities/find";
export * from "./entities/guards";
export { fire, fireAll, enable, disable, toggle, trigger, killByName, onOutput, onceOutput, onOutputByName, waitForOutput } from "./entities/io";
export type { FireOptions, OutputData } from "./entities/io";
export * from "./entities/hammer";
export { spawnTemplate, SpawnedGroup } from "./entities/templates";

// players
export {
    getController,
    getPawn,
    getSlot,
    getPlayerName,
    playerFromEntity,
    getPlayers,
    getPawns,
    forEachPlayer,
    countPlayers,
    findPlayer,
} from "./players/players";
export type { PlayerLike, PlayerFilter } from "./players/players";
export * as Pawn from "./players/pawn";
export { PlayerData } from "./players/playerData";
export type { PlayerDataOptions } from "./players/playerData";
export { Input } from "./players/input";
export type { InputCallback } from "./players/input";
export { ChatCommands, CommandRouter, tokenize } from "./players/commands";
export type { CommandContext, CommandDefinition, ReplyHandler } from "./players/commands";
export { Chat, sanitizeCommandText, MAX_CHAT_LENGTH } from "./players/chat";

// game
export { Team, PLAYING_TEAMS, MAX_PLAYER_SLOTS, teamName, teamShortName, otherTeam, isPlayingTeam, parseTeam } from "./game/constants";
export type { TeamNumber } from "./game/constants";
export { Round } from "./game/round";
export { Convars, ConvarPresets } from "./game/convars";
export type { ConvarValue, ConvarSnapshot } from "./game/convars";
export * as Weapons from "./game/weapons";
export * as Damage from "./game/damage";

// world
export {
    traceLine,
    traceRay,
    traceSphere,
    traceBox,
    traceFromEyes,
    getAimTarget,
    hasLineOfSight,
    findGround,
    canPlayerFit,
    traceBulletFromEyes,
} from "./world/trace";
export type { TraceOptions } from "./world/trace";
export { Camera } from "./world/camera";
export type { ThirdPersonOptions } from "./world/camera";
export { precache, precacheAndWait } from "./world/precache";

// ui
export { HudLayout } from "./ui/hud";
export { Draw } from "./ui/draw";
export { Watch } from "./ui/watch";
export { HudSync, ALL_PLAYERS } from "./ui/hudSync";
export * from "./ui/debugMenu";

// util
export { SaveStore } from "./util/save";
export type { SaveStoreOptions } from "./util/save";
export { Stopwatch, Cooldown, formatTime, gameTime } from "./util/time";
export { compact } from "./util/object";
