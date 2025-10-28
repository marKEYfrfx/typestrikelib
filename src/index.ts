/**
 * Entry Point File
 */
import { Instance } from "cs_script/point_script";
import { CDebugMenu } from "./CDebugMenu";

const g_debugMenu : CDebugMenu = new CDebugMenu();

Instance.SetThink(() => {
    g_debugMenu.textDisplay();
    Instance.SetNextThink(Instance.GetGameTime() + 0.125);
});
Instance.SetNextThink(Instance.GetGameTime());
