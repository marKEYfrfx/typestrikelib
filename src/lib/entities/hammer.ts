import { BaseModelEntity, Entity } from "../core/engine";
import type { Unsubscribe } from "../core/events";
import { fire, onOutput, type FireOptions, type OutputData } from "./io";

/*
 * Typed wrappers for common Hammer entities. Each method fires a Hammer input or connects a
 * Hammer output by name, so you get autocomplete instead of typing strings.
 *
 * Get one with `findByName("name", CFuncTrackTrain)` / `requireByName(...)` / `castEntity(...)`.
 * See ./cast.ts for how wrapper classes work and the rules they follow (no constructors, no
 * field initialisers).
 *
 * Input and output names follow the Hammer FGD. If a wrapper is missing one, call
 * `fire(entity, "InputName")` / `onOutput(entity, "OutputName", cb)` directly.
 */

/** func_tracktrain */
export class CFuncTrackTrain extends Entity {
    static readonly classNames = ["func_tracktrain"] as const;

    /** Teleport the train to a path node and start it moving forward at `speed` units/second. */
    teleportToPathAndStart(node: CPathTrack | string, speed: number): void {
        this.teleportToPathNode(node);
        this.setSpeed(speed);
        this.startForward();
    }

    teleportToPathNode(node: CPathTrack | string, options?: FireOptions): void {
        fire(this, "TeleportToPathNode", typeof node === "string" ? node : node.GetEntityName(), options);
    }

    /** Set the speed in units/second (`SetSpeedReal`). */
    setSpeed(speed: number, options?: FireOptions): void {
        fire(this, "SetSpeedReal", speed, options);
    }

    startForward(options?: FireOptions): void {
        fire(this, "StartForward", undefined, options);
    }

    startBackward(options?: FireOptions): void {
        fire(this, "StartBackward", undefined, options);
    }

    stop(options?: FireOptions): void {
        fire(this, "Stop", undefined, options);
    }

    reverse(options?: FireOptions): void {
        fire(this, "Reverse", undefined, options);
    }

    toggle(options?: FireOptions): void {
        fire(this, "Toggle", undefined, options);
    }
}

/** path_track */
export class CPathTrack extends Entity {
    static readonly classNames = ["path_track"] as const;

    enablePath(): void {
        fire(this, "EnablePath");
    }
    disablePath(): void {
        fire(this, "DisablePath");
    }
    enableAlternatePath(): void {
        fire(this, "EnableAlternatePath");
    }
    disableAlternatePath(): void {
        fire(this, "DisableAlternatePath");
    }
    toggleAlternatePath(): void {
        fire(this, "ToggleAlternatePath");
    }
    /** A train passed this node. `activator` is usually the train. */
    onPass(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnPass", callback);
    }
}

/** prop_dynamic */
export class CPropDynamic extends BaseModelEntity {
    static readonly classNames = ["prop_dynamic", "prop_dynamic_override"] as const;

    setAnimation(sequence: string, options?: FireOptions): void {
        fire(this, "SetAnimation", sequence, options);
    }
    setDefaultAnimation(sequence: string): void {
        fire(this, "SetDefaultAnimation", sequence);
    }
    setPlaybackRate(rate: number): void {
        fire(this, "SetPlaybackRate", rate);
    }
    setSkin(skin: number): void {
        fire(this, "Skin", skin);
    }
    onAnimationDone(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnAnimationDone", callback);
    }
}

/** func_movelinear */
export class CFuncMoveLinear extends Entity {
    static readonly classNames = ["func_movelinear"] as const;

    open(options?: FireOptions): void {
        fire(this, "Open", undefined, options);
    }
    close(options?: FireOptions): void {
        fire(this, "Close", undefined, options);
    }
    /** Move to a fraction of the way along its path (0 = closed, 1 = open). */
    setPosition(fraction: number, options?: FireOptions): void {
        fire(this, "SetPosition", fraction, options);
    }
    setSpeed(speed: number): void {
        fire(this, "SetSpeed", speed);
    }
    onFullyOpen(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnFullyOpen", callback);
    }
    onFullyClosed(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnFullyClosed", callback);
    }
}

/** func_door, func_door_rotating, prop_door_rotating */
export class CFuncDoor extends Entity {
    static readonly classNames = ["func_door", "func_door_rotating", "prop_door_rotating"] as const;

    open(options?: FireOptions): void {
        fire(this, "Open", undefined, options);
    }
    close(options?: FireOptions): void {
        fire(this, "Close", undefined, options);
    }
    toggle(options?: FireOptions): void {
        fire(this, "Toggle", undefined, options);
    }
    lock(): void {
        fire(this, "Lock");
    }
    unlock(): void {
        fire(this, "Unlock");
    }
    onFullyOpen(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnFullyOpen", callback);
    }
    onFullyClosed(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnFullyClosed", callback);
    }
}

/** func_rotating */
export class CFuncRotating extends Entity {
    static readonly classNames = ["func_rotating"] as const;

    start(): void {
        fire(this, "Start");
    }
    stop(): void {
        fire(this, "Stop");
    }
    toggle(): void {
        fire(this, "Toggle");
    }
    reverse(): void {
        fire(this, "Reverse");
    }
    /** Fraction of max speed, 0-1. */
    setSpeed(fraction: number): void {
        fire(this, "SetSpeed", fraction);
    }
}

/** func_button */
export class CFuncButton extends Entity {
    static readonly classNames = ["func_button", "func_rot_button"] as const;

    press(options?: FireOptions): void {
        fire(this, "Press", undefined, options);
    }
    lock(): void {
        fire(this, "Lock");
    }
    unlock(): void {
        fire(this, "Unlock");
    }
    /** `activator` is the player who pressed it. */
    onPressed(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnPressed", callback);
    }
}

/** trigger_multiple, trigger_once */
export class CTriggerMultiple extends Entity {
    static readonly classNames = ["trigger_multiple", "trigger_once"] as const;

    enable(): void {
        fire(this, "Enable");
    }
    disable(): void {
        fire(this, "Disable");
    }
    toggle(): void {
        fire(this, "Toggle");
    }
    /** `activator` is the entity that touched it. */
    onStartTouch(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnStartTouch", callback);
    }
    onEndTouch(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnEndTouch", callback);
    }
    onTrigger(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnTrigger", callback);
    }
}

/** logic_relay */
export class CLogicRelay extends Entity {
    static readonly classNames = ["logic_relay"] as const;

    trigger(options?: FireOptions): void {
        fire(this, "Trigger", undefined, options);
    }
    enable(): void {
        fire(this, "Enable");
    }
    disable(): void {
        fire(this, "Disable");
    }
    toggle(): void {
        fire(this, "Toggle");
    }
    cancelPending(): void {
        fire(this, "CancelPending");
    }
    onTrigger(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnTrigger", callback);
    }
}

/** math_counter */
export class CMathCounter extends Entity {
    static readonly classNames = ["math_counter"] as const;

    add(amount: number): void {
        fire(this, "Add", amount);
    }
    subtract(amount: number): void {
        fire(this, "Subtract", amount);
    }
    setValue(value: number): void {
        fire(this, "SetValue", value);
    }
    /** Set the value without firing `OutValue`. */
    setValueNoFire(value: number): void {
        fire(this, "SetValueNoFire", value);
    }
    /** Called with the new value whenever it changes (`OutValue`). */
    onValueChanged(callback: (value: number) => void): Unsubscribe {
        return onOutput(this, "OutValue", (data) => {
            if (typeof data.value === "number") callback(data.value);
        });
    }
    onHitMax(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnHitMax", callback);
    }
    onHitMin(callback: (data: OutputData) => void): Unsubscribe {
        return onOutput(this, "OnHitMin", callback);
    }
}

/** point_worldtext */
export class CPointWorldText extends BaseModelEntity {
    static readonly classNames = ["point_worldtext"] as const;

    setMessage(text: string): void {
        fire(this, "SetMessage", text);
    }
    enable(): void {
        fire(this, "Enable");
    }
    disable(): void {
        fire(this, "Disable");
    }
}
