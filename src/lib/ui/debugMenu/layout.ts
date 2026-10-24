/*
 * The shape of panorama/layout/custom_game/typestrike_debug.xml.
 *
 * custom_hud_layout can't create panels at runtime, so the XML has a fixed number of slots
 * (tabs, rows, cells, action buttons) and DebugMenu fills them in. These sizes and ids are the
 * single source of truth: tools/generate-debug-layout.mjs builds the XML from this file.
 * After changing anything here, run `npm run build:hud` and rebuild the map's HUD assets.
 *
 * This file must not import "cs_script/point_script" (the generator runs it in Node).
 */

export const DEBUG_LAYOUT = {
    /** Source files, relative to the addon's content folder. */
    layoutFile: "panorama/layout/custom_game/typestrike_debug.xml",
    styleFile: "panorama/styles/custom_game/typestrike_debug.css",
    /** The compiled asset to pick in the custom_hud_layout entity's `layout` property. */
    layoutAsset: "panorama/layout/custom_game/typestrike_debug.vxml",
    /** Default targetname for the custom_hud_layout entity. */
    entityName: "typestrike_debug",
    tabs: 6,
    rows: 12,
    columns: 5,
    actions: 8,
    actionsPerRow: 4,
} as const;

/** Panel ids. Label ids double as their dialog variable names (`text="{s:<id>}"`). */
export const DebugIds = {
    root: "tsd_root",
    menu: "tsd_menu",
    title: "tsd_title",
    time: "tsd_time",
    mouse: "tsd_mouse",
    mouseLabel: "tsd_mouse_lbl",
    close: "tsd_close",
    tabs: "tsd_tabs",
    tab: (i: number) => `tsd_tab_${i}`,
    tabLabel: (i: number) => `tsd_tab_${i}_lbl`,
    table: "tsd_table",
    head: "tsd_head",
    headCell: (c: number) => `tsd_head_${c}`,
    row: (r: number) => `tsd_row_${r}`,
    cell: (r: number, c: number) => `tsd_cell_${r}_${c}`,
    empty: "tsd_empty",
    actionRow: (i: number) => `tsd_actions_${i}`,
    action: (i: number) => `tsd_action_${i}`,
    actionLabel: (i: number) => `tsd_action_${i}_lbl`,
    prev: "tsd_prev",
    next: "tsd_next",
    page: "tsd_page",
    status: "tsd_status",
    hint: "tsd_hint",
} as const;

/** CSS classes DebugMenu toggles. They are documented at the top of typestrike_debug.css. */
export const DebugClasses = {
    hidden: "hidden",
    /** On the menu while the player has the mouse cursor. */
    interactive: "interactive",
    /** Active tab, or a toggle action that is currently on. */
    on: "on",
    /** Selected table row. */
    selected: "selected",
    /** Disabled button (paging at the first/last page, an action that needs a selection). */
    off: "off",
    danger: "danger",
    /** On the table: how many columns are visible (`cols-1` .. `cols-5`). */
    cols: (n: number) => `cols-${n}`,
    /** On the menu: where it sits on screen. */
    position: (p: "right" | "left" | "center") => `pos-${p}`,
} as const;

/** Every dialog-variable label in the layout, in document order. */
export function allLabelIds(): string[] {
    const ids: string[] = [DebugIds.title, DebugIds.time, DebugIds.mouseLabel];
    for (let i = 0; i < DEBUG_LAYOUT.tabs; i++) ids.push(DebugIds.tabLabel(i));
    for (let c = 0; c < DEBUG_LAYOUT.columns; c++) ids.push(DebugIds.headCell(c));
    for (let r = 0; r < DEBUG_LAYOUT.rows; r++) for (let c = 0; c < DEBUG_LAYOUT.columns; c++) ids.push(DebugIds.cell(r, c));
    ids.push(DebugIds.empty);
    for (let i = 0; i < DEBUG_LAYOUT.actions; i++) ids.push(DebugIds.actionLabel(i));
    ids.push(DebugIds.page, DebugIds.status, DebugIds.hint);
    return ids;
}

/** Every button id in the layout. */
export function allButtonIds(): string[] {
    const ids: string[] = [DebugIds.mouse, DebugIds.close];
    for (let i = 0; i < DEBUG_LAYOUT.tabs; i++) ids.push(DebugIds.tab(i));
    for (let r = 0; r < DEBUG_LAYOUT.rows; r++) ids.push(DebugIds.row(r));
    for (let i = 0; i < DEBUG_LAYOUT.actions; i++) ids.push(DebugIds.action(i));
    ids.push(DebugIds.prev, DebugIds.next);
    return ids;
}

/**
 * Rough character budget for a cell, used to truncate text so it doesn't spill into the next
 * column. Based on the CSS: a 532px wide table, the first column weighted 1.6, the rest 1.0,
 * about 7.5px per character for the 13px monospace value font.
 */
export function cellCharBudget(column: number, visibleColumns: number): number {
    const width = 532 - 6 * (visibleColumns - 1);
    const weights = 1.6 + (visibleColumns - 1);
    const px = (width * (column === 0 ? 1.6 : 1)) / weights;
    return Math.max(4, Math.floor(px / 7.5));
}
