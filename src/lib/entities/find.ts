import { Instance } from "../core/engine";
import type {
    BaseModelEntity,
    C4,
    CSGrenadeProjectileBase,
    CSHostage,
    CSPlantedC4,
    CSPlayerController,
    CSPlayerPawn,
    CSWeaponBase,
    CustomHudLayout,
    Entity,
    PointTemplate,
    Vector,
} from "cs_script/point_script";
import { distanceSqr } from "../math/vector";
import { castEntity, EntityError, type EntityClass } from "./cast";

/**
 * Hammer classname -> the cs_script class you get back. Used by {@link findByClass} and
 * {@link findAllByClass} to return precise types. Add your own entries with declaration merging:
 *
 * ```ts
 * declare module "./lib/entities/find" {
 *     interface EntityClassMap { func_tracktrain: CFuncTrackTrain }
 * }
 * ```
 */
export interface EntityClassMap {
    player: CSPlayerPawn;
    cs_player_controller: CSPlayerController;
    point_template: PointTemplate;
    custom_hud_layout: CustomHudLayout;
    planted_c4: CSPlantedC4;
    weapon_c4: C4;
    hostage_entity: CSHostage;
    hegrenade_projectile: CSGrenadeProjectileBase;
    flashbang_projectile: CSGrenadeProjectileBase;
    smokegrenade_projectile: CSGrenadeProjectileBase;
    molotov_projectile: CSGrenadeProjectileBase;
    decoy_projectile: CSGrenadeProjectileBase;
    prop_dynamic: BaseModelEntity;
    prop_physics: BaseModelEntity;
    prop_physics_multiplayer: BaseModelEntity;
    prop_physics_override: BaseModelEntity;
    [weapon: `weapon_${string}`]: CSWeaponBase;
}

type ClassResult<K extends string> = K extends keyof EntityClassMap ? EntityClassMap[K] : Entity;

/** First entity with this targetname. `*` wildcards are supported by the engine. */
export function findByName(name: string): Entity | undefined;
/** First entity with this targetname, cast to `Cls` (see {@link castEntity}). */
export function findByName<T extends Entity>(name: string, Cls: EntityClass<T>): T | undefined;
export function findByName<T extends Entity>(name: string, Cls?: EntityClass<T>): Entity | T | undefined {
    const e = Instance.FindEntityByName(name);
    if (!e || !Cls) return e;
    return castEntity(e, Cls);
}

/** All entities matching a targetname (wildcards allowed: `"tower_*"`). */
export function findAllByName(pattern: string): Entity[];
export function findAllByName<T extends Entity>(pattern: string, Cls: EntityClass<T>): T[];
export function findAllByName<T extends Entity>(pattern: string, Cls?: EntityClass<T>): Array<Entity | T> {
    const list = Instance.FindEntitiesByName(pattern);
    return Cls ? list.map((e) => castEntity(e, Cls)) : list;
}

/**
 * Like {@link findByName} but throws an {@link EntityError} naming the missing entity.
 * Good for map setup code, where a missing entity is a mapping mistake you want to see right away.
 */
export function requireByName(name: string): Entity;
export function requireByName<T extends Entity>(name: string, Cls: EntityClass<T>): T;
export function requireByName<T extends Entity>(name: string, Cls?: EntityClass<T>): Entity | T {
    const e = Instance.FindEntityByName(name);
    if (!e) throw new EntityError(`Required entity "${name}" was not found in the map`);
    return Cls ? castEntity(e, Cls) : e;
}

/** First entity of a classname, typed via {@link EntityClassMap}. */
export function findByClass<K extends string>(className: K): ClassResult<K> | undefined {
    return Instance.FindEntityByClass(className) as ClassResult<K> | undefined;
}

/** All entities of a classname, typed via {@link EntityClassMap}. */
export function findAllByClass<K extends string>(className: K): ClassResult<K>[] {
    return Instance.FindEntitiesByClass(className) as ClassResult<K>[];
}

/** Where to look for entities in spatial queries. */
export type EntitySource<T extends Entity = Entity> =
    | readonly T[]
    | { className: string; name?: undefined }
    | { name: string; className?: undefined };

function resolveSource<T extends Entity>(source: EntitySource<T>): T[] {
    if (Array.isArray(source)) return source as T[];
    const s = source as { className?: string; name?: string };
    if (s.className !== undefined) return Instance.FindEntitiesByClass(s.className) as T[];
    if (s.name !== undefined) return Instance.FindEntitiesByName(s.name) as T[];
    return [];
}

/**
 * Entities within `radius` of `center`, nearest first. There is no "all entities" query in
 * cs_script, so say where to look: an array, `{ className }` or `{ name }`.
 *
 * ```ts
 * const nearbyPlayers = findInRadius(origin, 256, { className: "player" });
 * ```
 */
export function findInRadius<T extends Entity>(
    center: Vector,
    radius: number,
    source: EntitySource<T>,
    filter?: (entity: T) => boolean,
): T[] {
    const r2 = radius * radius;
    return resolveSource(source)
        .filter((e) => e.IsValid() && (!filter || filter(e)))
        .map((e) => ({ e, d: distanceSqr(e.GetAbsOrigin(), center) }))
        .filter((x) => x.d <= r2)
        .sort((a, b) => a.d - b.d)
        .map((x) => x.e);
}

/** The nearest entity to `center`, optionally within `maxDistance`. */
export function findNearest<T extends Entity>(
    center: Vector,
    source: EntitySource<T>,
    options: { maxDistance?: number; filter?: (entity: T) => boolean } = {},
): T | undefined {
    const max2 = options.maxDistance === undefined ? Infinity : options.maxDistance ** 2;
    let best: T | undefined;
    let bestD = max2;
    for (const e of resolveSource(source)) {
        if (!e.IsValid() || (options.filter && !options.filter(e))) continue;
        const d = distanceSqr(e.GetAbsOrigin(), center);
        if (d <= bestD) {
            best = e;
            bestD = d;
        }
    }
    return best;
}

/** Short description for logs: `prop_physics "crate_1"`. */
export function describeEntity(entity: Entity | undefined): string {
    if (!entity) return "<none>";
    if (!entity.IsValid()) return "<invalid entity>";
    const name = entity.GetEntityName();
    return name ? `${entity.GetClassName()} "${name}"` : entity.GetClassName();
}
