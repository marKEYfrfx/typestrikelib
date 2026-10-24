/*
 * A fake "cs_script/point_script" for running library code under Node.
 * test/run.mjs swaps it in for the real module when bundling tests. It models only what the
 * tests use: game time and thinks, event registration, entities, controllers, convars, save data.
 */

type Vector = { x: number; y: number; z: number };
type QAngle = { pitch: number; yaw: number; roll: number };

const TICK = 1 / 64;

export const mock = {
    time: 0,
    think: undefined as (() => void) | undefined,
    nextThink: undefined as number | undefined,
    setNextThinkCalls: 0,
    handlers: new Map<string, (...args: any[]) => any>(),
    scriptInputs: new Map<string, (data: any) => void>(),
    reload: undefined as { before?: () => unknown; after?: (m: unknown) => void } | undefined,
    logs: [] as string[],
    serverCommands: [] as string[],
    convars: new Map<string, boolean | number | string | object>(),
    saveData: "",
    saveWrites: 0,
    entities: [] as Entity[],
    controllers: [] as CSPlayerController[],
    fired: [] as Array<{ target: string; input: string; value?: unknown; delay?: number }>,
    outputs: new Map<number, { target: Entity; output: string; cb: (d: any) => void }>(),
    nextOutputId: 1,
    afterThinks: [] as Array<() => void>,
    cheatCommands: new Map<string, (args: string) => void>(),

    /** Advance game time tick by tick, running the think when due. */
    advance(seconds: number): void {
        const end = mock.time + seconds;
        while (mock.time + TICK / 2 < end) {
            mock.time += TICK;
            if (mock.nextThink !== undefined && mock.time >= mock.nextThink - TICK / 2) {
                mock.nextThink = undefined;
                mock.think?.();
            }
            const queued = mock.afterThinks.splice(0);
            for (const cb of queued) cb();
        }
    },
    /** Call a registered Instance.OnXxx handler. */
    emit(name: string, payload?: unknown): any {
        return mock.handlers.get(`On${name}`)?.(payload);
    },
    fireOutput(target: object, output: string, data: unknown = {}): void {
        for (const o of [...mock.outputs.values()]) if (o.target === target && o.output === output) o.cb(data);
    },
};

// ---------------------------------------------------------------- enums (values from point_script.d.ts)

export enum CSMoveType { INVALID = -1, NONE, WALK, FLYGRAVITY, VPHYSICS, NOCLIP, OBSERVER, LADDER, CUSTOM }
export enum CSRoundEndReason { UNKNOWN = -1, IN_PROGRESS, GAME_COMMENCING, DRAW, TARGET_BOMBED, TARGET_SAVED, BOMB_DEFUSED, HOSTAGES_RESCUED, HOSTAGES_NOT_RESCUED, CTS_WIN, TERRORISTS_WIN, CTS_SURRENDER, TERRORISTS_SURRENDER }
export enum CSTeamMoneyReason { NONE }
export enum CSGearSlot { INVALID = -1, RIFLE, PISTOL, KNIFE, GRENADES, C4, BOOSTS }
export enum CSHitGroup { INVALID = -1, GENERIC, HEAD, CHEST, STOMACH, LEFTARM, RIGHTARM, LEFTLEG, RIGHTLEG, NECK }
export enum CSDamageTypes { GENERIC = 0, FALL = 1 << 5, HEADSHOT = 1 << 13 }
export enum CSDamageFlags { NONE = 0, IGNORE_ARMOR = 1 << 6 }
export enum CSInputs { NONE = 0, FORWARD = 1 << 0, USE = 1 << 7, ATTACK = 1 << 8, LOOK_AT_WEAPON = 1 << 12 }
export enum CustomCameraMode { DISABLED = 0, CONTROLLED = 1, CONTROLLED_POSITION = 2, FOLLOW_POSITION = 3 }

// ---------------------------------------------------------------- entities

export class Entity {
    name = "";
    className = "info_target";
    valid = true;
    origin: Vector = { x: 0, y: 0, z: 0 };
    angles: QAngle = { pitch: 0, yaw: 0, roll: 0 };
    velocity: Vector = { x: 0, y: 0, z: 0 };
    eyeOffset = 64;
    health = 100;
    maxHealth = 100;
    team = 0;
    moveType = CSMoveType.WALK;
    owner: Entity | undefined;
    ground: Entity | undefined;

    IsValid() { return this.valid; }
    GetAbsOrigin() { return { ...this.origin }; }
    GetAbsAngles() { return { ...this.angles }; }
    GetAbsVelocity() { return { ...this.velocity }; }
    GetEyeAngles() { return { ...this.angles }; }
    GetEyePosition() { return { x: this.origin.x, y: this.origin.y, z: this.origin.z + this.eyeOffset }; }
    Teleport(v: { position?: Vector; angles?: QAngle; velocity?: Vector }) {
        if (v.position) this.origin = { ...v.position };
        if (v.angles) this.angles = { ...v.angles };
        if (v.velocity) this.velocity = { ...v.velocity };
    }
    GetMoveType() { return this.moveType; }
    SetMoveType(m: CSMoveType) { this.moveType = m; }
    GetClassName() { return this.className; }
    GetEntityName() { return this.name; }
    SetEntityName(n: string) { this.name = n; }
    GetOwner() { return this.owner; }
    GetTeamNumber() { return this.team; }
    GetHealth() { return this.health; }
    SetHealth(h: number) { this.health = h; }
    GetMaxHealth() { return this.maxHealth; }
    IsAlive() { return this.health > 0; }
    IsWorld() { return this.className === "worldent"; }
    GetGroundEntity() { return this.ground; }
    Remove() { this.valid = false; }
    Kill() { this.health = 0; }
}

export class BaseModelEntity extends Entity {
    model = "";
    glowing = false;
    SetModel(m: string) { this.model = m; }
    Glow() { this.glowing = true; }
    Unglow() { this.glowing = false; }
    IsGlowing() { return this.glowing; }
}

export class CSPlayerPawn extends BaseModelEntity {
    controller: CSPlayerController | undefined;
    pressed = 0;
    justPressed = 0;
    justReleased = 0;
    noclip = false;
    eyeAngles: QAngle | undefined;
    constructor() { super(); this.className = "player"; }
    GetPlayerController() { return this.controller; }
    GetOriginalPlayerController() { return this.controller!; }
    IsInputPressed(i: number) { return (this.pressed & i) === i; }
    WasInputJustPressed(i: number) { return (this.justPressed & i) === i; }
    WasInputJustReleased(i: number) { return (this.justReleased & i) === i; }
    armor = 0;
    helmet = false;
    SetEyeAngles(a: QAngle) { this.eyeAngles = a; }
    IsNoclipping() { return this.moveType === CSMoveType.NOCLIP; }
    GetArmor() { return this.armor; }
    SetArmor(a: number) { this.armor = a; }
    SetHasHelmet(h: boolean) { this.helmet = h; }
    FindWeaponBySlot() { return undefined; }
    GetActiveWeapon() { return undefined; }
}

export class CSPlayerController extends Entity {
    slot = 0;
    playerName = "";
    pawn: CSPlayerPawn | undefined;
    connected = true;
    bot = false;
    constructor() { super(); this.className = "cs_player_controller"; }
    GetPlayerSlot() { return this.slot; }
    GetPlayerName() { return this.playerName; }
    GetPlayerPawn() { return this.pawn; }
    IsConnected() { return this.connected; }
    IsBot() { return this.bot; }
    GetTeamNumber() { return this.team; }
}

export class PointTemplate extends Entity {
    spawns: () => Entity[] = () => [];
    ForceSpawn() { return this.spawns(); }
}

/**
 * Models what each player sees: a per-player value overrides the all-players value, which
 * overrides the layout's original classes (loaded with `loadLayout(xml)`).
 */
export class CustomHudLayout extends Entity {
    calls: unknown[][] = [];
    defaults = new Map<string, Set<string>>();
    allClasses = new Map<string, boolean>();
    playerClasses = new Map<number, Map<string, boolean>>();
    allText = new Map<string, string>();
    playerText = new Map<number, Map<string, string>>();
    capture = new Map<number, boolean>();
    resets = 0;
    playerResets: number[] = [];

    constructor() { super(); this.className = "custom_hud_layout"; }

    /** Read the original classes of every panel from layout XML. */
    loadLayout(xml: string) {
        for (const m of xml.matchAll(/<\w+ id="([^"]+)" class="([^"]*)"/g)) this.defaults.set(m[1], new Set(m[2].split(/\s+/).filter(Boolean)));
    }
    /** The class as `slot` sees it. */
    hasClass(slot: number, panelId: string, className: string): boolean {
        const key = `${panelId}|${className}`;
        const own = this.playerClasses.get(slot)?.get(key);
        if (own !== undefined) return own;
        const all = this.allClasses.get(key);
        if (all !== undefined) return all;
        return this.defaults.get(panelId)?.has(className) ?? false;
    }
    /** A dialog variable as `slot` sees it. */
    text(slot: number, panelId: string, variable = panelId): string {
        const key = `${panelId}|${variable}`;
        return this.playerText.get(slot)?.get(key) ?? this.allText.get(key) ?? "";
    }

    SetDialogVariableString(panelId: string, variable: string, value: string) {
        this.calls.push(["text", panelId, variable, value]);
        this.allText.set(`${panelId}|${variable}`, value);
    }
    SetDialogVariableStringForPlayer(slot: number, panelId: string, variable: string, value?: string) {
        this.calls.push(value === undefined ? ["textFor", slot, panelId, variable] : ["textFor", slot, panelId, variable, value]);
        const m = this.playerText.get(slot) ?? new Map<string, string>();
        this.playerText.set(slot, m);
        if (value === undefined) m.delete(`${panelId}|${variable}`);
        else m.set(`${panelId}|${variable}`, value);
    }
    SetHasClass(panelId: string, className: string, has?: boolean) {
        this.calls.push(has === undefined ? ["class", panelId, className] : ["class", panelId, className, has]);
        if (has === undefined) this.allClasses.delete(`${panelId}|${className}`);
        else this.allClasses.set(`${panelId}|${className}`, has);
    }
    SetHasClassForPlayer(slot: number, panelId: string, className: string, has?: boolean) {
        this.calls.push(has === undefined ? ["classFor", slot, panelId, className] : ["classFor", slot, panelId, className, has]);
        const m = this.playerClasses.get(slot) ?? new Map<string, boolean>();
        this.playerClasses.set(slot, m);
        if (has === undefined) m.delete(`${panelId}|${className}`);
        else m.set(`${panelId}|${className}`, has);
    }
    SetInputCaptureEnabled(slot: number, enabled: boolean) { this.calls.push(["capture", slot, enabled]); this.capture.set(slot, enabled); }
    IsInputCaptureEnabled(slot: number) { return this.capture.get(slot) ?? false; }
    Reset() {
        this.resets++;
        this.allClasses.clear();
        this.playerClasses.clear();
        this.allText.clear();
        this.playerText.clear();
    }
    ResetForPlayer(slot: number) {
        this.playerResets.push(slot);
        this.playerClasses.delete(slot);
        this.playerText.delete(slot);
    }
}

// ---------------------------------------------------------------- helpers to build a world

/*
 * Tests import Valve's classes and enums from "cs_script/point_script" (typed by the real
 * point_script.d.ts, provided at runtime by this file). The helpers below return `any` so tests
 * can poke at mock-only fields (origin, health, justPressed, ...) without type errors.
 */

/** Register an entity with a targetname (and optionally a classname). */
export function addEntity(entity: object, name: string, className?: string): any {
    const e = entity as Entity;
    e.name = name;
    if (className) e.className = className;
    mock.entities.push(e);
    return e;
}

/** View any object as its mock implementation. */
export function asMock(value: unknown): any {
    return value;
}

/** Add a connected player with a pawn. Returns the mock controller (pawn at `.pawn`). */
export function addPlayer(slot: number, name: string, team = 2, options: { alive?: boolean; bot?: boolean } = {}): any {
    const c = new CSPlayerController();
    c.slot = slot;
    c.playerName = name;
    c.team = team;
    c.bot = options.bot ?? false;
    const p = new CSPlayerPawn();
    p.controller = c;
    p.team = team;
    p.health = options.alive === false ? 0 : 100;
    c.pawn = p;
    mock.controllers.push(c);
    return c;
}

function wildcard(pattern: string): RegExp {
    return new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
}

// ---------------------------------------------------------------- Instance / Console / GameRules

const instanceImpl: Record<string, unknown> = {
    GetGameTime: () => mock.time,
    SetThink: (cb: () => void) => { mock.think = cb; },
    SetNextThink: (t: number) => { mock.nextThink = t; mock.setNextThinkCalls++; },
    Delay: (s: number) => new Promise<void>((resolve) => {
        const at = mock.time + s;
        const check = () => (mock.time >= at - TICK / 2 ? resolve() : mock.afterThinks.push(check));
        mock.afterThinks.push(check);
    }),
    QueueAfterThinks: (cb: () => void) => { mock.afterThinks.push(cb); },
    OnScriptInput: (name: string, cb: (d: unknown) => void) => { mock.scriptInputs.set(name, cb); },
    OnScriptReload: (cfg: { before?: () => unknown; after?: (m: unknown) => void }) => { mock.reload = cfg; },
    FindEntityByName: (n: string) => mock.entities.find((e) => e.valid && wildcard(n).test(e.name)),
    FindEntitiesByName: (n: string) => mock.entities.filter((e) => e.valid && wildcard(n).test(e.name)),
    FindEntityByClass: (c: string) => mock.entities.find((e) => e.valid && e.className === c),
    FindEntitiesByClass: (c: string) => mock.entities.filter((e) => e.valid && e.className === c),
    GetPlayerController: (slot: number) => mock.controllers.find((c) => c.slot === slot),
    GetAllPlayerControllers: () => [...mock.controllers],
    EntFireAtName: (c: { name: string; input: string; value?: unknown; delay?: number }) => { mock.fired.push({ target: c.name, input: c.input, value: c.value, delay: c.delay }); },
    EntFireAtTarget: (c: { target: Entity; input: string; value?: unknown; delay?: number }) => { mock.fired.push({ target: c.target.name, input: c.input, value: c.value, delay: c.delay }); },
    ConnectOutput: (target: Entity, output: string, cb: (d: unknown) => void) => {
        const id = mock.nextOutputId++;
        mock.outputs.set(id, { target, output, cb });
        return id;
    },
    DisconnectOutput: (id: number) => { mock.outputs.delete(id); },
    GetSaveData: () => mock.saveData,
    SetSaveData: (d: string) => { mock.saveData = d; mock.saveWrites++; },
    TraceLine: (cfg: { start: Vector; end: Vector }) => ({ fraction: 1, end: cfg.end, didHit: false, startedInSolid: false, normal: { x: 0, y: 0, z: 1 } }),
    TracePlayer: (cfg: { start: Vector; end?: Vector }) => ({ fraction: 1, end: cfg.end ?? cfg.start, didHit: false, startedInSolid: false, normal: { x: 0, y: 0, z: 1 } }),
    GetMapName: () => "mock_map",
    DebugScreenText: () => {},
    DebugLine: () => {},
    DebugSphere: () => {},
    DebugBox: () => {},
};

/** Any Instance.OnXxx(callback) not defined above just records the handler. */
export const Instance: any = new Proxy(instanceImpl, {
    get(target, prop: string) {
        if (prop in target) return target[prop];
        if (prop.startsWith("On")) return (cb: (...a: any[]) => any) => { mock.handlers.set(prop, cb); };
        return undefined;
    },
});

export const Console = {
    Log: (text: unknown) => { mock.logs.push(String(text)); },
    ServerCommand: (cmd: string) => { mock.serverCommands.push(cmd); },
    ClientCommand: () => {},
    GetConvarNumber: (n: string) => (typeof mock.convars.get(n) === "number" ? (mock.convars.get(n) as number) : undefined),
    GetConvarBoolean: (n: string) => (typeof mock.convars.get(n) === "boolean" ? (mock.convars.get(n) as boolean) : undefined),
    GetConvarString: (n: string) => (mock.convars.has(n) ? String(mock.convars.get(n)) : undefined),
    GetConvarVector: () => undefined,
    GetConvarQAngle: () => undefined,
    GetConvarColor: () => undefined,
    SetConvar: (n: string, v: boolean | number | string | object) => { mock.convars.set(n, v); },
    RegisterCheatCommand: (name: string, cb: (args: string) => void) => { mock.cheatCommands.set(name, cb); },
};

export const GameRules = {
    scores: { 2: 0, 3: 0 } as Record<number, number>,
    terminated: [] as Array<[number, number | undefined]>,
    remaining: 100,
    IsWarmupPeriod: () => false,
    IsFreezePeriod: () => false,
    IsTeamIntroPeriod: () => false,
    GetRoundsPlayed: () => 0,
    GetRoundRemainingTime: () => GameRules.remaining,
    SetRoundRemainingTime: (t: number) => { GameRules.remaining = t; },
    GetTeamScore: (t: number) => GameRules.scores[t] ?? 0,
    AddTeamScore: (t: number, s: number) => { GameRules.scores[t] = (GameRules.scores[t] ?? 0) + s; },
    TerminateRound: (reason: number, delay?: number) => { GameRules.terminated.push([reason, delay]); },
    StartWarmup: () => {},
    EndWarmup: () => {},
    AddTeamMoney: () => {},
};
