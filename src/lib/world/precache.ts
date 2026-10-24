import { Instance } from "../core/engine";
import type { CSPrecache } from "cs_script/point_script";
import { waitUntil } from "../core/scheduler";

/** Start loading resources (.vmdl, .vpcf, .vmat, .vsnd) on the server and clients. Experimental Valve API. */
export function precache(resources: readonly string[]): CSPrecache | undefined {
    return Instance.Precache({ resources: [...resources] });
}

/**
 * Precache and wait until every connected client has the resources loaded.
 * Resolves `true` when loaded, `false` on timeout (default 30 s) or if precaching failed.
 * Call `.Release()` on the returned handle (via `onHandle`) when you no longer need the resources.
 */
export async function precacheAndWait(
    resources: readonly string[],
    options: { timeout?: number; onHandle?: (handle: CSPrecache) => void } = {},
): Promise<boolean> {
    const handle = precache(resources);
    if (!handle) return false;
    options.onHandle?.(handle);
    return waitUntil(() => handle.IsLoadedForAll(), { timeout: options.timeout ?? 30, interval: 0.1 });
}
