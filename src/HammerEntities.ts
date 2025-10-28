import { Instance, Entity, BaseModelEntity} from "cs_script/point_script";


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

export class CPropPhysicsMultiplayer extends BaseModelEntity {
    
}

export class CPathTrack extends Entity {
    
}

export class CFuncMoveLinear extends Entity {
    
}
