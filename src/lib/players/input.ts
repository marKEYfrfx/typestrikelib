import type { CSInputs, CSPlayerController, CSPlayerPawn } from "cs_script/point_script";
import type { Unsubscribe } from "../core/events";
import { libLog } from "../core/log";
import { Timers, type TimerHandle } from "../core/scheduler";
import { getPawns } from "./players";

/*
 * Button handling for every player, without writing your own think loop. While at least one
 * listener exists, the library checks each living pawn's input once per tick.
 * Pass a single CSInputs flag per listener; combining flags isn't well defined by the API.
 */

export type InputCallback = (pawn: CSPlayerPawn, controller: CSPlayerController | undefined) => void;

type Mode = "pressed" | "released" | "held";

interface InputListener {
    input: CSInputs;
    mode: Mode;
    callback: InputCallback;
}

const inputListeners: InputListener[] = [];
let poller: TimerHandle | undefined;

function poll(): void {
    if (inputListeners.length === 0) return;
    for (const pawn of getPawns()) {
        for (const l of inputListeners.slice()) {
            const hit =
                l.mode === "pressed"
                    ? pawn.WasInputJustPressed(l.input)
                    : l.mode === "released"
                      ? pawn.WasInputJustReleased(l.input)
                      : pawn.IsInputPressed(l.input);
            if (!hit) continue;
            try {
                l.callback(pawn, pawn.GetPlayerController());
            } catch (err) {
                libLog.error("Uncaught error in input listener:", err);
            }
        }
    }
}

function add(listener: InputListener): Unsubscribe {
    inputListeners.push(listener);
    if (!poller || !poller.active) poller = Timers.everyTick(poll);
    return () => {
        const i = inputListeners.indexOf(listener);
        if (i !== -1) inputListeners.splice(i, 1);
        if (inputListeners.length === 0 && poller) {
            poller.cancel();
            poller = undefined;
        }
    };
}

/**
 * ```ts
 * Input.onPressed(CSInputs.USE, (pawn) => log.info(pawn, "pressed E"));
 * Input.onHeld(CSInputs.ATTACK2, (pawn) => chargeShot(pawn));
 * ```
 */
export const Input = {
    /** The input went from released to pressed this tick. */
    onPressed(input: CSInputs, callback: InputCallback): Unsubscribe {
        return add({ input, mode: "pressed", callback });
    },
    /** The input went from pressed to released this tick. */
    onReleased(input: CSInputs, callback: InputCallback): Unsubscribe {
        return add({ input, mode: "released", callback });
    },
    /** Every tick while the input is held. */
    onHeld(input: CSInputs, callback: InputCallback): Unsubscribe {
        return add({ input, mode: "held", callback });
    },
    get listenerCount(): number {
        return inputListeners.length;
    },
};
