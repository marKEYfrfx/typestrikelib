import { CustomCameraMode } from "../core/engine";
import type { CSPlayerPawn, Entity, QAngle, Vector } from "cs_script/point_script";
import { compact } from "../util/object";

/*
 * Wrappers for Valve's experimental CustomPlayerCamera (`pawn.GetCustomCamera()`).
 * The camera is itself an entity: in CONTROLLED modes its origin and angles are the view.
 */

export interface ThirdPersonOptions {
    /** Distance behind the player. Default 120. */
    distance?: number;
    /** Height above the eyes. Default 0. */
    height?: number;
    /** Sideways offset (positive = left). Default 0. */
    side?: number;
    /** Pull the camera in instead of clipping through walls. Default `true`. */
    clip?: boolean;
    /** How fast the camera springs back after being pushed in by a wall (1 = instantly). */
    returnStrength?: number;
}

export const Camera = {
    /** Normal first-person view. */
    reset(pawn: CSPlayerPawn): void {
        pawn.GetCustomCamera().SetMode(CustomCameraMode.DISABLED);
    },

    /** Over-the-shoulder / third-person view that follows the player. */
    thirdPerson(pawn: CSPlayerPawn, options: ThirdPersonOptions = {}): void {
        Camera.follow(pawn, pawn, { ...options, followEyes: true });
    },

    /** Follow any entity with an offset; the player still controls where the camera looks. */
    follow(pawn: CSPlayerPawn, target: Entity, options: ThirdPersonOptions & { followEyes?: boolean; followOffset?: Vector } = {}): void {
        const camera = pawn.GetCustomCamera();
        camera.SetFollowConfig(
            compact({
                followEntity: target,
                followEyes: options.followEyes ?? false,
                followOffset: options.followOffset,
                cameraOffset: { x: -(options.distance ?? 120), y: options.side ?? 0, z: options.height ?? 0 },
                clipCameraOffset: options.clip ?? true,
                cameraOffsetReturnStrength: options.returnStrength,
            }),
        );
        camera.SetMode(CustomCameraMode.FOLLOW_POSITION);
    },

    /** Lock the view to a fixed position and angles (cutscenes, security cameras). */
    fixed(pawn: CSPlayerPawn, position: Vector, angles: QAngle): void {
        const camera = pawn.GetCustomCamera();
        camera.SetMode(CustomCameraMode.CONTROLLED);
        camera.Teleport({ position, angles });
    },

    /** Fix the view position but let the player look around. */
    fixedPosition(pawn: CSPlayerPawn, position: Vector): void {
        const camera = pawn.GetCustomCamera();
        camera.SetMode(CustomCameraMode.CONTROLLED_POSITION);
        camera.Teleport({ position });
    },

    /** Move a fixed camera without resetting interpolation (smooth motion when called every tick). */
    move(pawn: CSPlayerPawn, position?: Vector, angles?: QAngle): void {
        pawn.GetCustomCamera().Move(compact({ position, angles }));
    },

    isCustom(pawn: CSPlayerPawn): boolean {
        return pawn.GetCustomCamera().GetMode() !== CustomCameraMode.DISABLED;
    },
};
