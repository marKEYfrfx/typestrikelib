/** Team numbers used by `GetTeamNumber()`, `JoinTeam()`, `GameRules.GetTeamScore()` and friends. */
export const Team = {
    UNASSIGNED: 0,
    SPECTATOR: 1,
    T: 2,
    CT: 3,
} as const;

export type TeamNumber = (typeof Team)[keyof typeof Team];

/** The two teams that play rounds. */
export const PLAYING_TEAMS: readonly TeamNumber[] = [Team.T, Team.CT];

/** Highest number of player slots on a CS2 server. */
export const MAX_PLAYER_SLOTS = 64;

const TEAM_NAMES: Record<number, string> = {
    [Team.UNASSIGNED]: "Unassigned",
    [Team.SPECTATOR]: "Spectator",
    [Team.T]: "Terrorist",
    [Team.CT]: "Counter-Terrorist",
};

const TEAM_SHORT: Record<number, string> = {
    [Team.UNASSIGNED]: "NONE",
    [Team.SPECTATOR]: "SPEC",
    [Team.T]: "T",
    [Team.CT]: "CT",
};

/** `"Terrorist"`, `"Counter-Terrorist"`, `"Spectator"` or `"Unassigned"`. */
export function teamName(team: number): string {
    return TEAM_NAMES[team] ?? `Team ${team}`;
}

/** `"T"`, `"CT"`, `"SPEC"` or `"NONE"`. */
export function teamShortName(team: number): string {
    return TEAM_SHORT[team] ?? String(team);
}

/** The opposing team: T <-> CT. Other values are returned unchanged. */
export function otherTeam(team: number): number {
    return team === Team.T ? Team.CT : team === Team.CT ? Team.T : team;
}

/** `true` for T and CT. */
export function isPlayingTeam(team: number): boolean {
    return team === Team.T || team === Team.CT;
}

/** Parse "t", "ct", "spec", "2", "terrorist", ... into a team number. */
export function parseTeam(text: string): TeamNumber | undefined {
    const t = text.trim().toLowerCase();
    if (["t", "2", "terrorist", "terrorists", "tt"].includes(t)) return Team.T;
    if (["ct", "3", "counter-terrorist", "counter-terrorists", "counterterrorist", "cts"].includes(t)) return Team.CT;
    if (["spec", "spectator", "spectators", "1"].includes(t)) return Team.SPECTATOR;
    if (["none", "unassigned", "0"].includes(t)) return Team.UNASSIGNED;
    return undefined;
}
