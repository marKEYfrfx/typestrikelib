import { CSRoundEndReason, CSTeamMoneyReason, GameRules } from "../core/engine";
import { Team } from "./constants";

/** Match and round state, on top of Valve's `GameRules`. */
export const Round = {
    isWarmup: (): boolean => GameRules.IsWarmupPeriod(),
    isFreezeTime: (): boolean => GameRules.IsFreezePeriod(),
    isTeamIntro: (): boolean => GameRules.IsTeamIntroPeriod(),

    /** Not in warmup, freeze time or the team intro. */
    isLive(): boolean {
        return !GameRules.IsWarmupPeriod() && !GameRules.IsFreezePeriod() && !GameRules.IsTeamIntroPeriod();
    },

    roundsPlayed: (): number => GameRules.GetRoundsPlayed(),

    /** Seconds left in the round. */
    timeLeft: (): number => GameRules.GetRoundRemainingTime(),
    setTimeLeft: (seconds: number): void => GameRules.SetRoundRemainingTime(Math.max(0, seconds)),
    /** Add (or, with a negative number, remove) round time. */
    addTime(seconds: number): void {
        GameRules.SetRoundRemainingTime(Math.max(0, GameRules.GetRoundRemainingTime() + seconds));
    },

    score: (team: number): number => GameRules.GetTeamScore(team),
    addScore: (team: number, points = 1): void => GameRules.AddTeamScore(team, points),

    /**
     * End the round with `team` as the winner. By default this also adds a point to their score
     * (TerminateRound alone doesn't).
     */
    win(team: number, options: { delay?: number; addScore?: boolean; reason?: CSRoundEndReason } = {}): void {
        const reason = options.reason ?? (team === Team.CT ? CSRoundEndReason.CTS_WIN : CSRoundEndReason.TERRORISTS_WIN);
        if (options.addScore !== false) GameRules.AddTeamScore(team, 1);
        GameRules.TerminateRound(reason, options.delay);
    },

    /** End the round as a draw. */
    draw(delay?: number): void {
        GameRules.TerminateRound(CSRoundEndReason.DRAW, delay);
    },

    /** End the round with any reason. Doesn't change scores. */
    end(reason: CSRoundEndReason, delay?: number): void {
        GameRules.TerminateRound(reason, delay);
    },

    startWarmup: (): void => GameRules.StartWarmup(),
    endWarmup: (): void => GameRules.EndWarmup(),

    /** Give every player on a team money, following the normal rules. */
    giveTeamMoney(team: number, amount: number, reason: CSTeamMoneyReason = CSTeamMoneyReason.NONE): void {
        GameRules.AddTeamMoney(team, reason, amount);
    },
};
