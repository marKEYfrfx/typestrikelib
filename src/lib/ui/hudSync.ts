import type { CustomHudLayout } from "cs_script/point_script";

/** Pass as `slot` to write the all-players value. */
export const ALL_PLAYERS = -1;

/**
 * Writes dialog variables and classes to a custom_hud_layout, skipping writes whose value is
 * already what was last sent. A HUD that is redrawn several times a second then only sends
 * what actually changed.
 *
 * The cache only knows what this object wrote. Call {@link forget} when the engine side is
 * reset (`ResetForPlayer`, a player leaving) so the next write goes through.
 */
export class HudSync {
    private readonly sent = new Map<number, Map<string, string | boolean>>();
    /** Writes sent to the engine. */
    writes = 0;
    /** Writes skipped because nothing changed. */
    skipped = 0;

    constructor(public layout: CustomHudLayout) {}

    /**
     * Set a label's text. By the usual convention the label id is also the dialog variable name
     * (`<Label id="score" text="{s:score}" />`); pass `variable` if yours differ.
     */
    text(labelId: string, value: string, slot = ALL_PLAYERS, variable = labelId): void {
        if (!this.changed(slot, `t:${labelId}:${variable}`, value)) return;
        if (slot === ALL_PLAYERS) this.layout.SetDialogVariableString(labelId, variable, value);
        else this.layout.SetDialogVariableStringForPlayer(slot, labelId, variable, value);
    }

    /** Add or remove a class on a panel. */
    cls(panelId: string, className: string, has: boolean, slot = ALL_PLAYERS): void {
        if (!this.changed(slot, `c:${panelId}:${className}`, has)) return;
        if (slot === ALL_PLAYERS) this.layout.SetHasClass(panelId, className, has);
        else this.layout.SetHasClassForPlayer(slot, panelId, className, has);
    }

    /** Make exactly one class of a group present, e.g. `oneOf("table", ["cols-1", "cols-2"], "cols-2")`. */
    oneOf(panelId: string, classNames: readonly string[], active: string | undefined, slot = ALL_PLAYERS): void {
        for (const c of classNames) this.cls(panelId, c, c === active, slot);
    }

    /** Forget what was sent to one player (or to everyone, with no argument). */
    forget(slot?: number): void {
        if (slot === undefined) this.sent.clear();
        else this.sent.delete(slot);
    }

    private changed(slot: number, key: string, value: string | boolean): boolean {
        let m = this.sent.get(slot);
        if (!m) this.sent.set(slot, (m = new Map()));
        if (m.get(key) === value) {
            this.skipped++;
            return false;
        }
        m.set(key, value);
        this.writes++;
        return true;
    }
}
