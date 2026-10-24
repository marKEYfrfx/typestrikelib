import { Instance } from "../core/engine";
import type { CSPlayerController, CustomHudLayout } from "cs_script/point_script";
import { Events, type Unsubscribe } from "../core/events";
import { EntityError } from "../entities/cast";
import { isCustomHudLayout } from "../entities/guards";
import { getSlot, type PlayerLike } from "../players/players";

/*
 * Wrapper for Valve's experimental custom_hud_layout entity: Panorama layouts with dialog
 * variables (text), CSS classes (show/hide/style) and clickable buttons.
 */

function slotOf(player: PlayerLike): number {
    const slot = getSlot(player);
    if (slot === undefined) throw new Error("HudLayout: could not resolve player slot");
    return slot;
}

/**
 * ```ts
 * const hud = HudLayout.require("welcome_layout");
 * hud.setText("dialog", "title", "Welcome!");
 * hud.setText("dialog", "money", `$${money}`, player); // just for this player
 * hud.show("dialog");                                  // removes the "Hidden" class
 * hud.onClick("btn_close", (player) => hud.hide("dialog", player));
 * ```
 */
export class HudLayout {
    /** Class added by {@link hide} and removed by {@link show}. Style it in your CSS (e.g. `visibility: collapse`). */
    static hiddenClass = "Hidden";

    constructor(readonly entity: CustomHudLayout) {}

    /** Find a custom_hud_layout by targetname. */
    static find(name: string): HudLayout | undefined {
        const e = Instance.FindEntityByName(name);
        return e && isCustomHudLayout(e) ? new HudLayout(e) : undefined;
    }

    /** Find a custom_hud_layout by targetname, or throw. */
    static require(name: string): HudLayout {
        const hud = HudLayout.find(name);
        if (!hud) throw new EntityError(`custom_hud_layout "${name}" was not found`);
        return hud;
    }

    /** Set a dialog variable (`{s:variable}` in the layout), for everyone or one player. */
    setText(panelId: string, variable: string, value: string | number, player?: PlayerLike): void {
        if (player === undefined) this.entity.SetDialogVariableString(panelId, variable, String(value));
        else this.entity.SetDialogVariableStringForPlayer(slotOf(player), panelId, variable, String(value));
    }

    /**
     * Set a label whose dialog variable is named like its id (`<Label id="score" text="{s:score}" />`),
     * the convention typestrike's layouts use.
     */
    setLabel(labelId: string, value: string | number, player?: PlayerLike): void {
        this.setText(labelId, labelId, value, player);
    }

    /** Remove a player's override so they see the all-players value again. */
    clearTextFor(player: PlayerLike, panelId: string, variable: string): void {
        this.entity.SetDialogVariableStringForPlayer(slotOf(player), panelId, variable);
    }

    /**
     * Add (`true`) or remove (`false`) a CSS class on a panel, for everyone or one player.
     * Pass `undefined` to go back to the default (or to the all-players value, for one player).
     */
    setClass(panelId: string, className: string, has: boolean | undefined, player?: PlayerLike): void {
        if (player === undefined) this.entity.SetHasClass(panelId, className, has);
        else this.entity.SetHasClassForPlayer(slotOf(player), panelId, className, has);
    }

    show(panelId: string, player?: PlayerLike): void {
        this.setClass(panelId, HudLayout.hiddenClass, false, player);
    }

    hide(panelId: string, player?: PlayerLike): void {
        this.setClass(panelId, HudLayout.hiddenClass, true, player);
    }

    /** Give a player a mouse cursor and let them click this layout's buttons. */
    captureInput(player: PlayerLike, enabled: boolean): void {
        this.entity.SetInputCaptureEnabled(slotOf(player), enabled);
    }

    isCapturingInput(player: PlayerLike): boolean {
        return this.entity.IsInputCaptureEnabled(slotOf(player));
    }

    /** Listen for clicks on a button in this layout (`"*"` for any button). */
    onClick(buttonId: string, callback: (player: CSPlayerController, buttonId: string) => void): Unsubscribe {
        return Events.on("CustomHudClicked", ({ player, layout, buttonId: clicked }) => {
            if (layout !== this.entity) return;
            if (buttonId !== "*" && clicked !== buttonId) return;
            callback(player, clicked);
        });
    }

    /** Back to the layout's original state, for everyone or one player. */
    reset(player?: PlayerLike): void {
        if (player === undefined) this.entity.Reset();
        else this.entity.ResetForPlayer(slotOf(player));
    }
}
