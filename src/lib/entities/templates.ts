import { Instance } from "../core/engine";
import type { Entity, PointTemplate, QAngle, Vector } from "cs_script/point_script";
import { castEntity, EntityError, type EntityClass } from "./cast";
import { isPointTemplate } from "./guards";

/** The entities produced by one {@link spawnTemplate} call. */
export class SpawnedGroup {
    constructor(readonly entities: readonly Entity[]) {}

    /** First entity whose targetname starts with `prefix` (e.g. `"train."`), or matches `predicate`. */
    find(prefix: string): Entity | undefined;
    find<T extends Entity>(prefix: string, Cls: EntityClass<T>): T | undefined;
    find(predicate: (entity: Entity) => boolean): Entity | undefined;
    find<T extends Entity>(match: string | ((entity: Entity) => boolean), Cls?: EntityClass<T>): Entity | T | undefined {
        const test = typeof match === "string" ? (e: Entity) => e.GetEntityName().startsWith(match) : match;
        const e = this.entities.find((x) => x.IsValid() && test(x));
        return e && Cls ? castEntity(e, Cls) : e;
    }

    /** Like {@link find} but throws if nothing matches. */
    require<T extends Entity>(prefix: string, Cls?: EntityClass<T>): T {
        const e = Cls ? this.find(prefix, Cls) : (this.find(prefix) as T | undefined);
        if (!e) throw new EntityError(`Spawned template has no entity whose name starts with "${prefix}"`);
        return e;
    }

    /** Entities that still exist. */
    get alive(): Entity[] {
        return this.entities.filter((e) => e.IsValid());
    }

    /** Remove every entity in the group that still exists. */
    removeAll(): void {
        for (const e of this.entities) if (e.IsValid()) e.Remove();
    }
}

/**
 * Spawn a point_template (by entity or targetname), optionally at a position and rotation.
 * Returns `undefined` if the template spawned nothing.
 *
 * ```ts
 * const troop = spawnTemplate("template.troop.door", { origin: spawnPoint });
 * const train = troop?.require("train.", CFuncTrackTrain);
 * ```
 */
export function spawnTemplate(template: PointTemplate | string, options: { origin?: Vector; angles?: QAngle } = {}): SpawnedGroup | undefined {
    let t: PointTemplate;
    if (typeof template === "string") {
        const found = Instance.FindEntityByName(template);
        if (!found) throw new EntityError(`point_template "${template}" was not found`);
        if (!isPointTemplate(found)) throw new EntityError(`"${template}" is a ${found.GetClassName()}, not a point_template`);
        t = found;
    } else {
        t = template;
    }
    const spawned = t.ForceSpawn(options.origin, options.angles);
    if (!spawned || spawned.length === 0) return undefined;
    return new SpawnedGroup(spawned);
}
