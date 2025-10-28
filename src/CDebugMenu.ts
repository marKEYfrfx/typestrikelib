import { Instance } from "cs_script/point_script";
export class CDebugMenu {
    constructor() {
    }
    public textDisplay() {
        let textTest: string = "|GWSRGHWG|||\n".repeat(10);
        Instance.DebugScreenText({
        text: Instance.GetGameTime().toFixed(3),
        x: 10, // Center horizontally
        y: 10, // Center vertically
        duration: 0.125, // Show for 10 seconds
        color: { r: 255, g: 255, b: 128 } // Green color
        });
    }
}
