import { Instance, Entity, BaseModelEntity} from "cs_script/point_script";
import { IDebuggable } from "./CDebugMenu";


export class CFuncTrackTrain extends Entity{
    /**
     * Teleports the train to a path node and starts it moving at a specified speed.
     */
    public teleportToPathAndStart(teleportToNode: CPathTrack, speedValue: number): void {
        const pathNodeName = teleportToNode.GetEntityName();
        Instance.EntFireAtTarget({ target: this, input: "TeleportToPathNode", value: pathNodeName });
        this.setSpeed(speedValue);
        Instance.EntFireAtTarget({ target: this, input: "StartForward" });
    }

    /**
     * Sets the speed of the train.
     */
    public setSpeed(speedValue: number): void {
        Instance.EntFireAtTarget({ target: this, input: "SetSpeedReal", value: speedValue });
    }
}

export class CPropPhysicsMultiplayer extends BaseModelEntity implements IDebuggable {
    
    public ignite(): void {

    }
    /**
     * The title for the entire column.
     */
    debugColumnTitle(): string {
        return "prop_physics_multiplayer";
    };

    /**
     * The name for the specific entity/row.
     */
    debugEntityName(): string {
        return this.GetEntityName();
    };

    /**
     * The current value to display for the entity/row.
     */
    debugCurrentValue(): string {
        return "0";
    };
}

export class CPathTrack extends Entity {
    
}

export class CFuncMoveLinear extends Entity {
    
}
