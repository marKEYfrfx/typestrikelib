import { Instance } from "../core/engine";
import type { Entity } from "cs_script/point_script";
import { inspect, libLog } from "../core/log";

/*
 * "Casting" an entity: swapping its prototype for one of your classes, so the native methods and
 * your helper methods are both available on the same object. This is the pattern used by
 * `HammerEntities` (e.g. `CFuncTrackTrain extends Entity`).
 *
 * Rules for wrapper classes:
 * - Extend the native class the entity really is (`Entity`, `BaseModelEntity`, ...). Casting a
 *   player pawn to a `BaseModelEntity` subclass hides the pawn's own methods.
 * - The constructor never runs, so field initialisers (`private speed = 0`) never happen.
 *   Keep wrappers stateless, or store state lazily on `this`.
 * - Set `static classNames` so `castEntity` can reject the wrong kind of entity.
 */

/** A class usable with {@link castEntity}. */
export interface EntityClass<T extends Entity> {
    readonly prototype: T;
    readonly name: string;
    /** Hammer classnames this wrapper is meant for, e.g. `["func_tracktrain"]`. */
    readonly classNames?: readonly string[];
}

export interface CastOptions {
    /** Check the entity's classname against `Cls.classNames` (when set). Default `true`. */
    checkClassName?: boolean;
}

/** Thrown when an entity can't be cast or found. */
export class EntityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EntityError";
    }
}

/**
 * Give `entity` the prototype of `Cls` and return it typed as `T`.
 * Entity objects are stable, so the cast sticks: fetching the same entity again returns the
 * cast object. Casting again after a tools-mode reload updates it to the new class code.
 */
export function castEntity<T extends Entity>(entity: Entity, Cls: EntityClass<T>, options: CastOptions = {}): T {
    if (!entity || !entity.IsValid()) throw new EntityError(`Cannot cast ${inspect(entity)} to ${Cls.name}: entity is not valid`);
    if (options.checkClassName !== false && Cls.classNames && Cls.classNames.length > 0) {
        const cls = entity.GetClassName();
        if (!Cls.classNames.includes(cls)) {
            throw new EntityError(`Cannot cast ${inspect(entity)} to ${Cls.name}: expected classname ${Cls.classNames.join(" | ")}`);
        }
    }
    if (Object.getPrototypeOf(entity) !== Cls.prototype) Object.setPrototypeOf(entity, Cls.prototype);
    return entity as T;
}

/** Like {@link castEntity} but returns `undefined` instead of throwing. */
export function tryCastEntity<T extends Entity>(entity: Entity | undefined, Cls: EntityClass<T>, options?: CastOptions): T | undefined {
    if (!entity) return undefined;
    try {
        return castEntity(entity, Cls, options);
    } catch {
        return undefined;
    }
}

/**
 * A handle to a named entity that survives the entity being removed and respawned (e.g. on round
 * restart) and tools-mode reloads. `get()` returns the cached entity while it's valid and looks it
 * up by name again otherwise.
 *
 * ```ts
 * const train = new EntityRef("train_main", CFuncTrackTrain);
 * train.get()?.startForward();
 * ```
 */
export class EntityRef<T extends Entity = Entity> {
    private cached: T | undefined;

    constructor(
        readonly name: string,
        private readonly Cls?: EntityClass<T>,
    ) {}

    private warned = false;

    /**
     * The entity, or `undefined` if nothing with this name exists right now.
     * If the entity exists but is the wrong class for `Cls`, this logs a warning (once) and
     * returns `undefined`; use {@link require} to get the error instead.
     */
    get(): T | undefined {
        if (this.cached && this.cached.IsValid()) return this.cached;
        try {
            return this.resolve();
        } catch (err) {
            if (!this.warned) {
                this.warned = true;
                libLog.warn(err instanceof Error ? err.message : err);
            }
            return undefined;
        }
    }

    /** The entity, or throw an {@link EntityError}. */
    require(): T {
        if (this.cached && this.cached.IsValid()) return this.cached;
        const e = this.resolve();
        if (!e) throw new EntityError(`Entity "${this.name}" not found`);
        return e;
    }

    private resolve(): T | undefined {
        const found = Instance.FindEntityByName(this.name);
        this.cached = found ? (this.Cls ? castEntity(found, this.Cls) : (found as T)) : undefined;
        return this.cached;
    }

    get exists(): boolean {
        return this.get() !== undefined;
    }

    /** Forget the cached entity so the next `get()` searches again. */
    invalidate(): void {
        this.cached = undefined;
    }
}
