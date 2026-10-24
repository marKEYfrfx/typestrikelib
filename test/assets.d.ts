// Layout and style files imported as text by tests (test/run.mjs uses esbuild's text loader).
declare module "*.xml" {
    const text: string;
    export default text;
}
declare module "*.css" {
    const text: string;
    export default text;
}
