import { CSInputs, Console, Instance } from "../../core/engine";
import type { CSPlayerController, CSPlayerPawn, CustomHudLayout } from "cs_script/point_script";
import { Events, type Unsubscribe } from "../../core/events";
import { inspect, libLog } from "../../core/log";
import { Timers, type TimerHandle } from "../../core/scheduler";
import { isCustomHudLayout } from "../../entities/guards";
import { ChatCommands } from "../../players/commands";
import { Input } from "../../players/input";
import { PlayerData } from "../../players/playerData";
import { getController, getPlayers, type PlayerLike } from "../../players/players";
import { formatTime } from "../../util/time";
import { HudSync } from "../hudSync";
import { DEBUG_LAYOUT, DebugClasses, DebugIds, cellCharBudget } from "./layout";

/** A value shown in a table cell. Objects (vectors, entities, ...) are formatted with `inspect`. */
export type DebugCell = string | number | boolean | object | undefined | null;

/** One table row. */
export interface DebugRow<T = unknown> {
    cells: readonly DebugCell[];
    /** Identifies the row across refreshes, so a selection survives re-sorting. Default: the first cell's text. */
    key?: string;
    /** Whatever the row stands for (an entity, a player). Passed to `onSelect` and actions. */
    data?: T;
}

/** Passed to a tab's callbacks. */
export interface DebugContext<T = unknown> {
    readonly menu: DebugMenu;
    /** The player looking at the menu. */
    readonly viewer: CSPlayerController;
    /** Their pawn, if they have one. */
    readonly pawn: CSPlayerPawn | undefined;
    /** The row they selected on this tab, if any. */
    readonly selected: DebugRow<T> | undefined;
}

/** A button under the table. */
export interface DebugAction<T = unknown> {
    label: string | ((ctx: DebugContext<T>) => string);
    /** Return a string to show it in the status line. */
    run: (ctx: DebugContext<T>) => string | void;
    /** Shows the button as switched on (for toggles). */
    active?: (ctx: DebugContext<T>) => boolean;
    /** Red label, for destructive actions. */
    danger?: boolean;
    /** Greyed out, and refuses to run, until a row is selected. */
    needsSelection?: boolean;
}

/** A page of the debug menu. */
export interface DebugTab<T = unknown> {
    title: string;
    /** Column headers, 1 to 5. */
    columns: readonly string[];
    /** The rows to show. Called every refresh while the tab is visible, once per viewer. */
    rows: (ctx: DebugContext<T>) => readonly DebugRow<T>[];
    /** Called when a row is clicked (selecting it). Return a string for the status line. */
    onSelect?: (row: DebugRow<T>, ctx: DebugContext<T>) => string | void;
    /** Up to 8 buttons. */
    actions?: readonly DebugAction<T>[];
    /** Text shown when there are no rows. */
    empty?: string;
}

export interface DebugMenuOptions {
    /** Targetname of the custom_hud_layout entity using typestrike_debug.vxml. Default `"typestrike_debug"`. */
    layout?: string;
    /** Text in the header. Default `"typestrike debug"`. */
    title?: string;
    /** Seconds between redraws while someone has the menu open. Default 0.2. */
    refreshInterval?: number;
    /** Chat command that opens the menu (`!debug`). `false` for none. Default `"debug"`. */
    command?: string | false;
    /**
     * Console command that does the same for the first human player (local testing), e.g.
     * `ts_debug`, `ts_debug mouse`. Registered as a cheat command, so it needs `sv_cheats 1`.
     * `false` for none. Default `"ts_debug"`.
     */
    consoleCommand?: string | false;
    /** A button that toggles the mouse cursor while the menu is open, e.g. `CSInputs.LOOK_AT_WEAPON` (F). */
    cursorKey?: CSInputs;
    /** Screen side. Default `"right"`. */
    position?: "right" | "left" | "center";
    /** Who may open the menu. Default: everyone. Restrict this on public servers. */
    allow?: (player: CSPlayerController) => boolean;
}

interface ViewState {
    open: boolean;
    cursor: boolean;
    tab: number;
    page: number;
    selected: string | undefined;
    status: string;
    statusUntil: number;
    /** Rows from the last render, for mapping clicks to rows. */
    rows: readonly DebugRow[];
}

const L = DEBUG_LAYOUT;
const COL_CLASSES = Array.from({ length: L.columns }, (_, i) => DebugClasses.cols(i + 1));
const POS_CLASSES = (["right", "left", "center"] as const).map(DebugClasses.position);

const KEY_NAMES: Partial<Record<string, string>> = {
    USE: "E",
    RELOAD: "R",
    LOOK_AT_WEAPON: "F",
    ATTACK2: "Mouse 2",
    WALK: "Shift",
    DUCK: "Ctrl",
    JUMP: "Space",
};

/** Cell text: formatted and cut to fit its column. */
export function formatCell(value: DebugCell, maxChars = Infinity): string {
    let text: string;
    if (value === undefined || value === null) text = "";
    else if (typeof value === "number") text = Number.isInteger(value) ? String(value) : value.toFixed(1);
    else if (typeof value === "boolean") text = value ? "yes" : "no";
    else if (typeof value === "string") text = value;
    else text = inspect(value, 1);
    text = text.replace(/[\r\n\t]+/g, " ");
    return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 2))}..` : text;
}

function rowKey(row: DebugRow): string {
    return row.key ?? formatCell(row.cells[0]);
}

/**
 * An in-game debug menu drawn with a custom_hud_layout (Panorama XML + CSS), so it works in real
 * matches, not only in dev environments. Each player has their own view: tabs with a paged table,
 * row selection and action buttons. With the mouse cursor on (header button, `cursorKey`, or
 * `!debug mouse`) everything is clickable.
 *
 * Map setup: add a custom_hud_layout entity named `typestrike_debug` whose layout is
 * `panorama/layout/custom_game/typestrike_debug.vxml`. Use one DebugMenu per HUD entity
 * (it resets the entity's state when it first finds it).
 *
 * ```ts
 * const debug = new DebugMenu({ cursorKey: CSInputs.LOOK_AT_WEAPON });
 * debug.addTab(playersTab());
 * debug.addTab(entityTab("Props", { className: "prop_physics_multiplayer" }));
 * debug.watch("speed", ({ pawn }) => pawn && Pawn.speed2D(pawn));
 * ```
 */
export class DebugMenu {
    private readonly options: Required<Omit<DebugMenuOptions, "cursorKey">> & { cursorKey?: CSInputs };
    private readonly tabList: DebugTab<any>[] = [];
    private readonly views: PlayerData<ViewState>;
    private readonly watches = new Map<string, unknown>();
    private readonly cleanups: Unsubscribe[] = [];
    private readonly clickHandlers = new Map<string, (c: CSPlayerController) => void>();
    private hud: CustomHudLayout | undefined;
    private sync: HudSync | undefined;
    private timer: TimerHandle | undefined;
    private stopKeyListener: Unsubscribe | undefined;
    private tabsDirty = true;
    private warnedMissing = false;
    private watchTabAdded = false;
    private disposed = false;

    constructor(options: DebugMenuOptions = {}) {
        this.options = {
            layout: options.layout ?? DEBUG_LAYOUT.entityName,
            title: options.title ?? "typestrike debug",
            refreshInterval: options.refreshInterval ?? 0.2,
            command: options.command ?? "debug",
            consoleCommand: options.consoleCommand ?? "ts_debug",
            position: options.position ?? "right",
            allow: options.allow ?? (() => true),
            cursorKey: options.cursorKey,
        };
        this.views = new PlayerData<ViewState>(() => ({
            open: false,
            cursor: false,
            tab: 0,
            page: 0,
            selected: undefined,
            status: "",
            statusUntil: 0,
            rows: [],
        }));
        this.buildClickHandlers();

        this.cleanups.push(
            Events.on("CustomHudClicked", ({ player, layout, buttonId }) => {
                if (!this.hud || layout !== this.hud) return;
                this.click(player, buttonId);
            }),
            Events.on("PlayerConnect", ({ player }) => this.resetSlot(player.GetPlayerSlot())),
            Events.on("PlayerDisconnect", ({ playerSlot }) => this.resetSlot(playerSlot)),
        );
        if (this.options.command) this.cleanups.push(this.registerCommand(this.options.command));
        if (this.options.consoleCommand) this.registerConsoleCommand(this.options.consoleCommand);
        // Find the HUD as soon as the map is ready, so a setup problem shows up in the console right away.
        this.cleanups.push(Events.once("Activate", () => this.announce()));
    }

    // ---------------------------------------------------------------- tabs

    /** Add a tab (at most 6). Returns a function that removes it. */
    addTab<T>(tab: DebugTab<T>): Unsubscribe {
        if (this.tabList.length >= L.tabs) {
            libLog.warn(`DebugMenu: only ${L.tabs} tabs fit in the layout; "${tab.title}" was not added.`);
            return () => {};
        }
        if (tab.columns.length > L.columns) libLog.warn(`DebugMenu: tab "${tab.title}" has ${tab.columns.length} columns; only ${L.columns} are shown.`);
        this.tabList.push(tab);
        this.tabsDirty = true;
        return () => this.removeTab(tab);
    }

    removeTab(tab: DebugTab<any> | string): void {
        const i = typeof tab === "string" ? this.tabList.findIndex((t) => t.title === tab) : this.tabList.indexOf(tab);
        if (i === -1) return;
        this.tabList.splice(i, 1);
        this.tabsDirty = true;
    }

    get tabs(): readonly DebugTab<any>[] {
        return this.tabList;
    }

    /**
     * Show a live value in the "Watch" tab (created the first time). `value` can be a function of
     * the viewer, so each player sees their own (e.g. their speed). Returns a function that removes it.
     */
    watch(key: string, value: (ctx: DebugContext) => unknown): Unsubscribe;
    watch(key: string, value: unknown): Unsubscribe;
    watch(key: string, value: unknown): Unsubscribe {
        if (!this.watchTabAdded) {
            this.watchTabAdded = true;
            this.addTab({
                title: "Watch",
                columns: ["Name", "Value"],
                empty: "Nothing watched. Use menu.watch(name, value).",
                rows: (ctx) =>
                    [...this.watches].map(([k, v]) => {
                        let shown: unknown;
                        try {
                            shown = typeof v === "function" ? (v as (c: DebugContext) => unknown)(ctx) : v;
                        } catch (err) {
                            shown = `error: ${err instanceof Error ? err.message : String(err)}`;
                        }
                        return { key: k, cells: [k, shown as DebugCell] };
                    }),
            });
        }
        this.watches.set(key, value);
        return () => {
            this.watches.delete(key);
        };
    }

    // ---------------------------------------------------------------- per-player control

    /** Open the menu for a player. Returns `false` if they aren't allowed or the HUD entity is missing. */
    open(player: PlayerLike, options: { cursor?: boolean; tab?: number | string } = {}): boolean {
        const c = getController(player);
        if (!c || !this.options.allow(c)) return false;
        const hud = this.layoutEntity();
        if (!hud) return false;
        const view = this.views.get(c);
        view.open = true;
        if (options.tab !== undefined) this.selectTab(view, options.tab);
        this.applyCursor(c, view, options.cursor ?? view.cursor);
        this.render(c);
        this.ensureTimer();
        return true;
    }

    close(player: PlayerLike): void {
        const c = getController(player);
        if (!c) return;
        const view = this.views.peek(c);
        if (!view || !view.open) return;
        view.open = false;
        this.applyCursor(c, view, false);
        this.render(c);
    }

    toggle(player: PlayerLike): boolean {
        if (this.isOpen(player)) {
            this.close(player);
            return false;
        }
        return this.open(player);
    }

    isOpen(player: PlayerLike): boolean {
        return this.views.peek(player)?.open ?? false;
    }

    hasCursor(player: PlayerLike): boolean {
        return this.views.peek(player)?.cursor ?? false;
    }

    /** Give or take the mouse cursor. Turning it on opens the menu. */
    setCursor(player: PlayerLike, enabled: boolean): void {
        const c = getController(player);
        if (!c) return;
        if (enabled && !this.isOpen(c)) {
            this.open(c, { cursor: true });
            return;
        }
        const view = this.views.peek(c);
        if (!view) return;
        this.applyCursor(c, view, enabled);
        this.render(c);
    }

    /** Switch a player's menu to a tab, by index or title (case-insensitive prefix). */
    showTab(player: PlayerLike, tab: number | string): boolean {
        const c = getController(player);
        if (!c) return false;
        const ok = this.selectTab(this.views.get(c), tab);
        if (ok) this.render(c);
        return ok;
    }

    /** Show a message in a player's status line for `seconds`. */
    setStatus(player: PlayerLike, text: string, seconds = 4): void {
        const c = getController(player);
        if (!c) return;
        const view = this.views.get(c);
        view.status = text;
        view.statusUntil = Instance.GetGameTime() + seconds;
        if (view.open) this.render(c);
    }

    /** Redraw now for one player, or for everyone who has the menu open. */
    refresh(player?: PlayerLike): void {
        if (player !== undefined) {
            const c = getController(player);
            if (c) this.render(c);
            return;
        }
        this.refreshAll();
    }

    /** Close the menu for everyone and remove all listeners, timers and the chat command. */
    dispose(): void {
        for (const [slot, view] of this.views.entries()) {
            const c = Instance.GetPlayerController(slot);
            if (c && view.open) this.close(c);
        }
        this.timer?.cancel();
        this.timer = undefined;
        this.stopKeyListener?.();
        this.stopKeyListener = undefined;
        for (const off of this.cleanups.splice(0)) off();
        this.views.dispose();
        this.disposed = true;
    }

    // ---------------------------------------------------------------- internals

    /** The custom_hud_layout entity; found (and reset) on first use, and again if it was removed. */
    private layoutEntity(): CustomHudLayout | undefined {
        if (this.hud && this.hud.IsValid()) return this.hud;
        const e = Instance.FindEntityByName(this.options.layout);
        if (!e || !isCustomHudLayout(e)) {
            if (!this.warnedMissing) {
                this.warnedMissing = true;
                libLog.warn(
                    `DebugMenu: no custom_hud_layout named "${this.options.layout}". ` +
                        `Add one to the map with its layout set to ${DEBUG_LAYOUT.layoutAsset}.`,
                );
            }
            return undefined;
        }
        this.hud = e;
        this.sync = new HudSync(e);
        // Start clean: this also clears state left over from before a tools-mode reload.
        e.Reset();
        for (const c of getPlayers()) {
            const slot = c.GetPlayerSlot();
            if (e.IsInputCaptureEnabled(slot)) e.SetInputCaptureEnabled(slot, false);
        }
        for (const [, view] of this.views.entries()) view.cursor = false;
        this.tabsDirty = true;
        this.sync.text(DebugIds.title, this.options.title);
        this.sync.text(DebugIds.hint, this.hintText());
        this.sync.oneOf(DebugIds.menu, POS_CLASSES, DebugClasses.position(this.options.position));
        return e;
    }

    private hintText(): string {
        const parts: string[] = [];
        if (this.options.command) parts.push(`!${this.options.command} close`, `!${this.options.command} mouse`);
        if (this.options.cursorKey !== undefined) {
            const name = (CSInputs as unknown as Record<number, string>)[this.options.cursorKey];
            parts.push(`${KEY_NAMES[name] ?? name ?? "key"}: mouse`);
        }
        parts.push("click a row to select it");
        return parts.join("   |   ");
    }

    private resetSlot(slot: number): void {
        this.views.delete(slot);
        this.sync?.forget(slot);
        if (this.hud && this.hud.IsValid()) {
            this.hud.ResetForPlayer(slot);
            if (this.hud.IsInputCaptureEnabled(slot)) this.hud.SetInputCaptureEnabled(slot, false);
        }
    }

    private applyCursor(c: CSPlayerController, view: ViewState, enabled: boolean): void {
        const hud = this.hud;
        view.cursor = enabled && view.open;
        if (!hud || !hud.IsValid()) return;
        const slot = c.GetPlayerSlot();
        if (hud.IsInputCaptureEnabled(slot) !== view.cursor) hud.SetInputCaptureEnabled(slot, view.cursor);
    }

    private selectTab(view: ViewState, tab: number | string): boolean {
        let index: number;
        if (typeof tab === "number") index = tab;
        else {
            const q = tab.toLowerCase();
            index = /^\d+$/.test(q) ? Number(q) - 1 : this.tabList.findIndex((t) => t.title.toLowerCase().startsWith(q));
        }
        if (index < 0 || index >= this.tabList.length) return false;
        if (view.tab !== index) {
            view.tab = index;
            view.page = 0;
            view.selected = undefined;
        }
        return true;
    }

    /** Start the refresh timer and the cursor-key listener; both stop again when nobody has the menu open. */
    private ensureTimer(): void {
        if (this.options.cursorKey !== undefined && !this.stopKeyListener) {
            this.stopKeyListener = Input.onPressed(this.options.cursorKey, (_pawn, controller) => {
                if (controller && this.isOpen(controller)) this.setCursor(controller, !this.hasCursor(controller));
            });
        }
        if (this.timer?.active) return;
        this.timer = Timers.every(this.options.refreshInterval, () => {
            if (this.refreshAll()) return true;
            this.stopKeyListener?.();
            this.stopKeyListener = undefined;
            return false;
        });
    }

    /** Redraw for every open viewer. Returns `false` when nobody has the menu open. */
    private refreshAll(): boolean {
        if (!this.layoutEntity() || !this.sync) return false;
        this.renderShared();
        let anyOpen = false;
        for (const [slot, view] of this.views.entries()) {
            if (!view.open) continue;
            const c = Instance.GetPlayerController(slot);
            if (!c || !c.IsConnected()) {
                view.open = false;
                continue;
            }
            anyOpen = true;
            this.render(c);
        }
        return anyOpen;
    }

    /** What every player sees the same: game time and the tab strip. */
    private renderShared(): void {
        const sync = this.sync!;
        sync.text(DebugIds.time, formatTime(Instance.GetGameTime(), 1));
        if (!this.tabsDirty) return;
        this.tabsDirty = false;
        for (let i = 0; i < L.tabs; i++) {
            const tab = this.tabList[i];
            sync.cls(DebugIds.tab(i), DebugClasses.hidden, !tab);
            if (tab) sync.text(DebugIds.tabLabel(i), formatCell(tab.title, 14));
        }
    }

    private context(c: CSPlayerController, view: ViewState): DebugContext<any> {
        const selected = view.selected === undefined ? undefined : view.rows.find((r) => rowKey(r) === view.selected);
        return { menu: this, viewer: c, pawn: c.GetPlayerPawn(), selected };
    }

    private render(c: CSPlayerController): void {
        if (!this.layoutEntity() || !this.sync) return;
        const sync = this.sync;
        const slot = c.GetPlayerSlot();
        const view = this.views.get(c);
        sync.cls(DebugIds.menu, DebugClasses.hidden, !view.open, slot);
        if (!view.open) return;
        if (this.tabsDirty) this.renderShared();

        sync.cls(DebugIds.menu, DebugClasses.interactive, view.cursor, slot);
        sync.text(DebugIds.mouseLabel, view.cursor ? "MOUSE ON" : "MOUSE", slot);

        view.tab = Math.max(0, Math.min(view.tab, this.tabList.length - 1));
        for (let i = 0; i < L.tabs; i++) sync.cls(DebugIds.tab(i), DebugClasses.on, i === view.tab, slot);
        const tab = this.tabList[view.tab];

        const cols = Math.max(1, Math.min(L.columns, tab?.columns.length ?? 1));
        sync.oneOf(DebugIds.table, COL_CLASSES, DebugClasses.cols(cols), slot);
        for (let col = 0; col < cols; col++) sync.text(DebugIds.headCell(col), formatCell(tab?.columns[col] ?? "", cellCharBudget(col, cols)), slot);

        let rows: readonly DebugRow[] = [];
        if (tab) {
            try {
                rows = tab.rows(this.context(c, view));
            } catch (err) {
                libLog.error(`DebugMenu tab "${tab.title}" rows() threw:`, err);
                view.status = `error: ${err instanceof Error ? err.message : String(err)}`;
                view.statusUntil = Instance.GetGameTime() + 4;
            }
        }
        view.rows = rows;

        const pages = Math.max(1, Math.ceil(rows.length / L.rows));
        view.page = Math.max(0, Math.min(view.page, pages - 1));
        const start = view.page * L.rows;
        for (let r = 0; r < L.rows; r++) {
            const row = rows[start + r];
            const id = DebugIds.row(r);
            sync.cls(id, DebugClasses.hidden, !row, slot);
            if (!row) continue;
            sync.cls(id, DebugClasses.selected, view.selected !== undefined && rowKey(row) === view.selected, slot);
            for (let col = 0; col < cols; col++) sync.text(DebugIds.cell(r, col), formatCell(row.cells[col], cellCharBudget(col, cols)), slot);
        }
        sync.cls(DebugIds.empty, DebugClasses.hidden, rows.length > 0, slot);
        if (rows.length === 0) sync.text(DebugIds.empty, tab ? (tab.empty ?? "Nothing to show") : "No tabs. Add one with menu.addTab().", slot);

        sync.text(DebugIds.page, `${view.page + 1} / ${pages}`, slot);
        sync.cls(DebugIds.prev, DebugClasses.off, view.page === 0, slot);
        sync.cls(DebugIds.next, DebugClasses.off, view.page >= pages - 1, slot);

        const ctx = this.context(c, view);
        const actions = tab?.actions ?? [];
        for (let i = 0; i < L.actions; i++) {
            const action = actions[i];
            const id = DebugIds.action(i);
            sync.cls(id, DebugClasses.hidden, !action, slot);
            if (!action) continue;
            let label = "";
            let active = false;
            try {
                label = typeof action.label === "function" ? action.label(ctx) : action.label;
                active = action.active?.(ctx) ?? false;
            } catch (err) {
                libLog.error("DebugMenu action label/active threw:", err);
            }
            sync.text(DebugIds.actionLabel(i), formatCell(label, 16), slot);
            sync.cls(id, DebugClasses.on, active, slot);
            sync.cls(id, DebugClasses.danger, action.danger === true, slot);
            sync.cls(id, DebugClasses.off, action.needsSelection === true && !ctx.selected, slot);
        }
        for (let r = 0; r * L.actionsPerRow < L.actions; r++) {
            sync.cls(DebugIds.actionRow(r), DebugClasses.hidden, actions.length <= r * L.actionsPerRow, slot);
        }

        const status = Instance.GetGameTime() < view.statusUntil ? view.status : "";
        sync.text(DebugIds.status, formatCell(status, 48), slot);
    }

    private buildClickHandlers(): void {
        const h = this.clickHandlers;
        h.set(DebugIds.close, (c) => this.close(c));
        h.set(DebugIds.mouse, (c) => this.setCursor(c, !this.hasCursor(c)));
        h.set(DebugIds.prev, (c) => {
            const v = this.views.get(c);
            v.page = Math.max(0, v.page - 1);
        });
        h.set(DebugIds.next, (c) => {
            const v = this.views.get(c);
            v.page += 1; // clamped on render
        });
        for (let i = 0; i < L.tabs; i++) h.set(DebugIds.tab(i), (c) => void this.selectTab(this.views.get(c), i));
        for (let r = 0; r < L.rows; r++) h.set(DebugIds.row(r), (c) => this.clickRow(c, r));
        for (let i = 0; i < L.actions; i++) h.set(DebugIds.action(i), (c) => this.clickAction(c, i));
    }

    private click(c: CSPlayerController, buttonId: string): void {
        const view = this.views.peek(c);
        if (!view || !view.open || !this.options.allow(c)) return;
        const handler = this.clickHandlers.get(buttonId);
        if (!handler) return;
        try {
            handler(c);
        } catch (err) {
            libLog.error(`DebugMenu click on "${buttonId}" threw:`, err);
        }
        if (this.isOpen(c)) this.render(c);
    }

    private clickRow(c: CSPlayerController, index: number): void {
        const view = this.views.get(c);
        const row = view.rows[view.page * L.rows + index];
        if (!row) return;
        const key = rowKey(row);
        if (view.selected === key) {
            view.selected = undefined;
            return;
        }
        view.selected = key;
        const tab = this.tabList[view.tab];
        const message = tab?.onSelect?.(row, this.context(c, view));
        if (message) this.setStatus(c, message);
    }

    private clickAction(c: CSPlayerController, index: number): void {
        const view = this.views.get(c);
        const action = this.tabList[view.tab]?.actions?.[index];
        if (!action) return;
        const ctx = this.context(c, view);
        if (action.needsSelection && !ctx.selected) {
            this.setStatus(c, "Select a row first");
            return;
        }
        const message = action.run(ctx);
        if (message) this.setStatus(c, message);
    }

    /** Log whether the menu is usable, once the map has loaded. */
    private announce(): void {
        if (!this.layoutEntity()) return; // layoutEntity() already warned
        const how = [this.options.command && `!${this.options.command} in chat`, this.options.consoleCommand && `${this.options.consoleCommand} in the console (sv_cheats 1)`]
            .filter(Boolean)
            .join(" or ");
        libLog.info(`Debug menu ready (HUD entity "${this.options.layout}" found)${how ? `: type ${how}` : ""}.`);
    }

    /**
     * Run a debug menu command for a player: no argument toggles the menu, `mouse` toggles the
     * cursor, `close` closes it, anything else opens that tab. Returns a message describing what happened.
     */
    runCommand(player: CSPlayerController, argString: string): string {
        const who = player.GetPlayerName() || `slot ${player.GetPlayerSlot()}`;
        if (!this.options.allow(player)) return `${who} isn't allowed to use the debug menu`;
        if (!this.layoutEntity()) {
            return `the debug menu needs a custom_hud_layout named "${this.options.layout}" with layout ${DEBUG_LAYOUT.layoutAsset}`;
        }
        const arg = argString.trim();
        const lower = arg.toLowerCase();
        if (arg === "") return this.toggle(player) ? `opened the debug menu for ${who}` : `closed the debug menu for ${who}`;
        if (lower === "mouse" || lower === "cursor") {
            this.setCursor(player, !this.hasCursor(player));
            return `mouse ${this.hasCursor(player) ? "on" : "off"} for ${who}`;
        }
        if (lower === "close" || lower === "off") {
            this.close(player);
            return `closed the debug menu for ${who}`;
        }
        if (this.open(player, { tab: arg }) && this.showTab(player, arg)) return `opened tab "${arg}" for ${who}`;
        return `no debug tab "${arg}". Tabs: ${this.tabList.map((t) => t.title).join(", ")}`;
    }

    private registerCommand(name: string): Unsubscribe {
        return ChatCommands.register(name, {
            description: "Open or close the debug menu",
            usage: "[mouse | close | <tab>]",
            handler: (ctx) => {
                const result = this.runCommand(ctx.player, ctx.argString);
                libLog.info(`!${name}${ctx.argString ? ` ${ctx.argString}` : ""}: ${result}`);
                if (this.isOpen(ctx.player)) {
                    if (result.startsWith("no debug tab")) this.setStatus(ctx.player, result);
                } else if (!result.startsWith("closed")) {
                    // The menu can't show this itself, so it goes to chat.
                    ctx.reply(`Debug menu: ${result}`);
                }
            },
        });
    }

    private registerConsoleCommand(name: string): void {
        if (!Console || typeof Console.RegisterCheatCommand !== "function") return;
        try {
            Console.RegisterCheatCommand(name, (args) => {
                if (this.disposed) return;
                const player = getPlayers({ bots: false })[0];
                if (!player) return libLog.warn(`${name}: no human player connected`);
                libLog.info(`${name}${args ? ` ${args}` : ""}: ${this.runCommand(player, args ?? "")}`);
            });
        } catch (err) {
            libLog.warn(`DebugMenu: couldn't register console command "${name}":`, err);
        }
    }
}
