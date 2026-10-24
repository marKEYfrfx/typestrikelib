import { consoleLog } from "./engine";

/** Severity levels for {@link Logger}. Messages below {@link Logger.level} are dropped. */
export enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
    Silent = 4,
}

const LEVEL_LABEL: Record<LogLevel, string> = {
    [LogLevel.Debug]: "DEBUG",
    [LogLevel.Info]: "INFO",
    [LogLevel.Warn]: "WARN",
    [LogLevel.Error]: "ERROR",
    [LogLevel.Silent]: "",
};

function isEntityLike(value: object): value is { GetClassName(): string; GetEntityName(): string; IsValid(): boolean } {
    const v = value as Record<string, unknown>;
    return typeof v.GetClassName === "function" && typeof v.IsValid === "function";
}

function isVectorLike(value: object): value is { x: number; y: number; z: number } {
    const v = value as Record<string, unknown>;
    return typeof v.x === "number" && typeof v.y === "number" && typeof v.z === "number";
}

function isAngleLike(value: object): value is { pitch: number; yaw: number; roll: number } {
    const v = value as Record<string, unknown>;
    return typeof v.pitch === "number" && typeof v.yaw === "number" && typeof v.roll === "number";
}

/** No own keys other than `allowed` (engine objects may expose fields as getters, with no own keys at all). */
function onlyKeys(value: object, ...allowed: string[]): boolean {
    return Object.keys(value).every((k) => allowed.includes(k));
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/**
 * Turn any value into a readable string for logging.
 * Entities print as `classname "targetname"`, vectors as `(x, y, z)`, angles as `[p, y, r]`.
 * Objects and arrays are expanded up to `depth` levels, cycles print as `[Circular]`.
 */
export function inspect(value: unknown, depth = 3, seen: Set<object> = new Set()): string {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    switch (typeof value) {
        case "string":
            return value;
        case "number":
        case "boolean":
        case "bigint":
            return String(value);
        case "symbol":
            return value.toString();
        case "function":
            return `[Function ${value.name || "anonymous"}]`;
    }
    const obj = value as object;
    if (obj instanceof Error) return `${obj.name}: ${obj.message}${obj.stack ? `\n${obj.stack}` : ""}`;
    if (isEntityLike(obj)) {
        try {
            if (!obj.IsValid()) return "<invalid entity>";
            const name = obj.GetEntityName();
            return name ? `${obj.GetClassName()} "${name}"` : obj.GetClassName();
        } catch {
            return "<entity>";
        }
    }
    if (isVectorLike(obj) && onlyKeys(obj, "x", "y", "z")) return `(${fmt(obj.x)}, ${fmt(obj.y)}, ${fmt(obj.z)})`;
    if (isAngleLike(obj) && onlyKeys(obj, "pitch", "yaw", "roll")) return `[${fmt(obj.pitch)}, ${fmt(obj.yaw)}, ${fmt(obj.roll)}]`;
    if (seen.has(obj)) return "[Circular]";
    if (depth <= 0) return Array.isArray(obj) ? "[...]" : "{...}";
    seen.add(obj);
    try {
        if (Array.isArray(obj)) return `[${obj.map((v) => inspectNested(v, depth - 1, seen)).join(", ")}]`;
        if (obj instanceof Map) {
            const parts = [...obj].map(([k, v]) => `${inspectNested(k, depth - 1, seen)} => ${inspectNested(v, depth - 1, seen)}`);
            return `Map(${obj.size}) {${parts.join(", ")}}`;
        }
        if (obj instanceof Set) return `Set(${obj.size}) {${[...obj].map((v) => inspectNested(v, depth - 1, seen)).join(", ")}}`;
        const entries = Object.entries(obj).map(([k, v]) => `${k}: ${inspectNested(v, depth - 1, seen)}`);
        return `{ ${entries.join(", ")} }`;
    } finally {
        seen.delete(obj);
    }
}

function inspectNested(value: unknown, depth: number, seen: Set<object>): string {
    return typeof value === "string" ? JSON.stringify(value) : inspect(value, depth, seen);
}

/** Join log arguments the way `console.log` would. */
export function formatArgs(args: readonly unknown[]): string {
    return args.map((a) => inspect(a)).join(" ");
}

/**
 * Prefixed, levelled logging on top of `Console.Log`.
 *
 * ```ts
 * const log = new Logger("towers");
 * log.info("spawned", tower, "at", tower.GetAbsOrigin());
 * // [towers] spawned prop_dynamic "tower_1" at (12, 40, 0)
 * ```
 */
export class Logger {
    /** Global minimum level for every logger. */
    static level: LogLevel = LogLevel.Info;

    /** Where formatted lines go. Replace it to redirect output (e.g. in tests). */
    static sink: (line: string) => void = (line) => consoleLog(line);

    constructor(public readonly prefix?: string) {}

    /** Create a logger whose prefix is `parent:child`. */
    child(prefix: string): Logger {
        return new Logger(this.prefix ? `${this.prefix}:${prefix}` : prefix);
    }

    log(level: LogLevel, ...args: unknown[]): void {
        if (level < Logger.level || level >= LogLevel.Silent) return;
        const tag = level === LogLevel.Info ? "" : `${LEVEL_LABEL[level]}: `;
        const prefix = this.prefix ? `[${this.prefix}] ` : "";
        Logger.sink(`${prefix}${tag}${formatArgs(args)}`);
    }

    debug(...args: unknown[]): void {
        this.log(LogLevel.Debug, ...args);
    }
    info(...args: unknown[]): void {
        this.log(LogLevel.Info, ...args);
    }
    warn(...args: unknown[]): void {
        this.log(LogLevel.Warn, ...args);
    }
    error(...args: unknown[]): void {
        this.log(LogLevel.Error, ...args);
    }
}

/** The library's own logger. Scripts usually make their own with `new Logger("mymap")`. */
export const libLog = new Logger("typestrike");
