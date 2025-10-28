/**
 * Entry Point File
 */
import { Entity, Instance } from "cs_script/point_script";
import { CDebugMenu } from "./CDebugMenu";
import { CPropPhysicsMultiplayer } from "./HammerEntities";

const g_debugMenu : CDebugMenu = new CDebugMenu();

var props : CPropPhysicsMultiplayer[] = new Array();

var ent1 : Entity | undefined = Instance.FindEntityByName("prop1");
var ent2 : Entity | undefined = Instance.FindEntityByName("prop2");
var ent3 : Entity | undefined = Instance.FindEntityByName("prop3");
var ent4 : Entity | undefined = Instance.FindEntityByName("skkkkkeeeeeeeeeeeeeeeeeet");
Object.setPrototypeOf(ent1, CPropPhysicsMultiplayer.prototype);
Object.setPrototypeOf(ent2, CPropPhysicsMultiplayer.prototype);
Object.setPrototypeOf(ent3, CPropPhysicsMultiplayer.prototype);
Object.setPrototypeOf(ent4, CPropPhysicsMultiplayer.prototype);
const prop1 = ent1 as CPropPhysicsMultiplayer;
const prop2 = ent2 as CPropPhysicsMultiplayer;
const prop3 = ent3 as CPropPhysicsMultiplayer;  
const prop4 = ent4 as CPropPhysicsMultiplayer;  
props.push(prop1);
props.push(prop2);
props.push(prop3);
props.push(prop4);

g_debugMenu.addColumn(props);

Instance.SetThink(() => {
    g_debugMenu.displayGameTime();
    g_debugMenu.displayColumns();
    Instance.SetNextThink(Instance.GetGameTime() + 0.125);
});
Instance.SetNextThink(Instance.GetGameTime());
