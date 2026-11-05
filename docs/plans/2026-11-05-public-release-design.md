# typestrikelib public release: design

Nov 5, 2026 · Approved by Mark section by section. Phase 1 is in progress; the restructure hasn't started and nothing new has run in game.

## Goal

Restructure typestrikelib, prove it in game with a purpose-built test map, and release it for other CS2 map makers.

Release means two things:

| Deliverable | What it is |
| --- | --- |
| `typestrikelib` on npm | The library: `typestrikelib`, `typestrikelib/debug` and `typestrikelib/testing` (the mock, for testing map scripts). |
| `typestrike-starter` template repo | A complete CS2 addon to clone into `csgo_addons`, with the build setup, Panorama files and the verification map. |

The starter gets its own repo because an addon must sit in its own `csgo_addons` folder. The library repo stops being an addon and drops its maps.

## Decisions

| Question | Decision |
| --- | --- |
| Release form | npm package plus starter addon |
| Test map's job | In-game verification, doubling as the starter |
| Refactor depth | Full restructure, including internals |
| Order | In-game baseline first, then restructure |
| Licence | MIT, replacing the unbacked `ISC` in `package.json` |
| First version | `0.1.0`; `1.0.0` once GlobalDefensive runs on the package |
| npm name | `typestrikelib` (returned 404 from the npm registry on Nov 5, 2026, so it was free then) |

## Starting point (Nov 5, 2026)

- 5,497 lines of library code. 91/91 mock tests pass and the typecheck is clean.
- Nothing shows which library features have run in game, apart from a few behaviours the README records.
- The GitHub repo is already public, with no LICENSE file.
- The repo tracks a 68 MB `maps/cs_script_demo.vmap`. It appears to derive from Valve's sample; that hasn't been confirmed.
- `package.json` says `typestrikelibrary` and the README says `typestrikelib`.
- The root `point_script.d.ts` was updated today from `csgo_addons/cs_script_demo/maps/scripts/`. The update is uncommitted. The library's copies in `scripts/` and `maps/scripts/`, and all of GlobalDefensive's copies, are still the old version.

## Phases

1. **Clean up.** Commit the uncommitted library work, add the licence, fix the naming, delete the extra type copies.
2. **Baseline.** Build the test map on today's code. Mark runs it once and the results are saved.
3. **Restructure.** Five stages, below.
4. **Release.** Package, publish the starter, add the verified table to the README.
5. **Migrate GlobalDefensive.** Replace `src/lib/` with the npm package. This reverses Mark's Nov 3 decision to keep a hand-synced copy, so it is Mark's call when the time comes. Nothing about the game depends on it.

## Restructure

### Findings

- The layers are mostly clean, with one cycle: `game/damage.ts` imports `players/players`, and `players/commands.ts` imports `teamShortName` from `game/constants.ts`. Moving the constants below both layers removes it.
- 19 module-level variables hold state, across `core`, `players/input`, `ui/watch`, `ui/debugMenu/tabs` and `util/save`. Stateful singletons such as `ChatCommands` and `Logger`'s level and sink add to that.
- `DebugMenu.ts` (686 lines) mixes view state, rendering, click routing and command registration. `tabs.ts` holds all three ready-made tabs plus god-mode state.

### Target layers

Each row imports only from the rows above it, plus other modules in its own row where the row lists one area. `players` and `game` get separate rows so the cycle can't return. A check in `npm test` fails on a violation.

| Layer | Contents |
| --- | --- |
| `engine` | The one file that reads `cs_script/point_script` |
| `runtime` | Events, Timers, reload, Signal, Logger |
| `math` | Pure math helpers |
| `util` | Save, time, text, shared team constants |
| `entities` | Finding, casting, I/O, wrappers, templates |
| `world` | Traces, camera, precache |
| `players` | Queries, Pawn, PlayerData, Input, commands, chat |
| `game` | Round, Convars, Weapons, Damage |
| `ui` | HUD, Draw, Watch |
| `debug` | The menu, published as `typestrikelib/debug` |

### Runtime object

Dispatcher state moves into one `Runtime` object. `Events.on(...)` and `Timers.after(...)` keep working as they do now, because the engine allows one think callback and one callback per event. Tests can then reset the runtime cleanly, and it can detect two copies of the library in one bundle, which would otherwise overwrite each other's `SetThink`.

**The Runtime lives in module scope, never on `globalThis`.** A tools-mode reload clears every engine callback and resets module variables, but `globalThis` survives. A Runtime kept there would still believe its think and event callbacks were installed, so timers and events would silently stop after a reload.

**Duplicate detection uses only a marker on `globalThis`.** The first copy sets it during load and clears it in a microtask once loading ends, so a later reload or another test bundle doesn't trigger a false alarm. A second copy loading in the same pass sees the marker and warns. The microtask timing is unproven in game and is tested at stage 3. If it isn't reliable, drop the detection and document the duplicate-copy risk instead.

### Stages

1. Move to the package layout and update import paths, with no behaviour changes. Regenerate the debug layout, because the XML embeds its source path.
2. Remove the cycle and add the layer check.
3. Introduce `Runtime`. **In-game checkpoint**, including a tools-mode reload.
4. Split `DebugMenu` and `tabs.ts`.
5. Review the public API: naming, exports, debug subpath. **In-game checkpoint.**

Each stage is its own commit and must pass the mock tests and typecheck. Existing assertions stay unchanged; a test whose expected result has to change is flagged as a behaviour change. New tests are allowed, and API renames in stage 5 are listed in the commit.

## Test map

`.vmap` files are binary and agents can't open Hammer. The agent writes the station scripts and an exact Hammer spec (entity names, classes, settings), and Mark builds the map.

### Stations

One small room each, and one module per station (`src/stations/traces.ts`, for example). All stations build into one bundle and run from one `point_script`, so there is one copy of the library and `!verify report` can see every result. New users delete what they don't need or keep one as an example.

| Station | Checks |
| --- | --- |
| Runtime | Events, Timers |
| Entities | Find, cast, I/O, wrappers, templates, `Entities.Spawn` |
| Players | Input, Pawn, PlayerData, disconnect (using a bot) |
| Chat | Commands, text sanitising |
| Game | Round, Convars, Weapons, Damage |
| World | Traces against known geometry, Camera |
| UI | HudLayout, DebugMenu, Draw, Watch |
| Persistence | SaveStore, tools-mode reload |

`Entities.Spawn` is new in Valve's latest types and has only been read in the API. It gets one check and no library wrapper until it is proven in game. `core/engine.ts` exposes `Entities` as an optional value outside `ENGINE_EXPORTS`, so builds without it don't warn and the mock doesn't need it yet.

### Running checks

- **Automatic:** the script does the action and asserts the result.
- **Confirmed:** for things only a person can judge, the script sets it up and the player clicks Pass or Fail in the debug menu.
- **Not run:** a missing entity is reported for that check and the others continue.

**If something under test breaks, there are two fallbacks.** Pass and Fail can each be recorded three ways:

| Method | Depends on | Covers |
| --- | --- | --- |
| Debug menu buttons | DebugMenu, HUD | Normal use |
| `!verify pass <id>` and `!verify fail <id>` | Chat, ChatCommands | The menu is broken |
| Hammer Pass and Fail buttons firing `RunScriptInput` | `Events.onScriptInput` | Chat is broken |

Console output carries the results in every case. The script must never call `Instance.OnPlayerChat` directly as a fallback, because that would take the library's callback slot.

### Results

`!verify report` prints one line per check. Mark pastes them into `verification/<patch>.md`, named after `PatchVersion` in `game/csgo/steam.inf`, because scripts can't read that file. The README's verified table is generated from the latest results file.

Run on a local server for most checks, then once on a dedicated server with `sv_cheats 0`.

### Migration

Stations import from `typestrikelib` from day one, through a build alias to the local source. The baseline code carries forward without rewrites, except where the API review changes something.

## Release

### Package

- Compiled ESM and `.d.ts` files, with `sideEffects: false` so esbuild drops unused modules.
- Includes the debug menu's Panorama files. `npx typestrike sync` copies them into the addon.
- `package.json` sets `files` explicitly and names the CLI `.mjs`, because `.gitignore` ignores `*.js` and `npm pack` would otherwise honour that.
- The starter's `tsconfig` uses `moduleResolution: "bundler"`. The current `node` setting ignores `exports`, so `typestrikelib/debug` types wouldn't resolve. GlobalDefensive needs the same change when it migrates.

### Testing export

`typestrikelib/testing` ships three things: the mock, an esbuild plugin that resolves `cs_script/point_script` to that same mock file, and a small test runner based on `test/run.mjs` and the harness. The plugin is required: if the alias pointed at a different path than the test's own import, the bundle would hold two separate mock states.

### Valve's types

The published `.d.ts` files need `cs_script/point_script` declared in the user's project. `sync` copies `point_script.d.ts` from `csgo_addons/cs_script_demo/maps/scripts/`. If that folder is missing, it stops and names the path it expected; `--from <path>` overrides it.

That folder has only been seen on Mark's machine, so the starter's setup needs testing on a clean install if possible.

The file stays out of the npm package. The library repo keeps one copy because CI has no CS2 install. The file's header invites copies but states no licence, so keeping it in a public repo is Mark's call.

### CI

GitHub Actions runs the typecheck, the mock tests and a packaging test: `npm pack`, install the result into the starter, then run `tsc --noEmit` and the build there, and run one test through `typestrikelib/testing`. The `tsc` step matters because esbuild ignores types.

### Git history

Remove the whole `maps/` folder from history, because the library repo no longer holds maps, and this takes any Valve-derived content out of the public history. The repo had no forks or stars when checked on Nov 5, 2026. Publishing the rewrite requires a force-push, so get Mark's confirmation at that step.

That removes `maps/cs_script_demo.vmap`, `maps/content_examples/lighting_info.vmap`, `maps/typestrikelib.vmap` (three versions, about 68 MB each) and Valve's sample types in `maps/scripts/`. Whether each map derives from Valve's samples is unconfirmed, and this decision doesn't depend on it.

GlobalDefensive's public repo also tracks `cs_script_demo.vmap`, `lighting_info.vmap` and `script_zoo.vmap`. That is outside this rewrite and needs its own decision.

### Release checklist

1. Every check has a result on the current CS2 patch, and each failure is fixed or listed in the README as a known limit.
2. CI passes.
3. Someone can go from a clean clone to a loaded map using only the starter's README, ideally someone other than Mark.
4. The README covers the new install path and the verified table.

### Only Mark can do

Create or log in to the npm account, approve publishing, and mark the starter as a template repo. The agent prepares each step and waits for approval before publishing or pushing.

## Out of scope

- GlobalDefensive's game design and prototype tests.
- New library features, unless the map shows they're needed.
- A Workshop upload, which can follow the release.

## Testing limits

Passing the mock doesn't prove in-game behaviour. The mock lacks `TraceBullet`, `TakeDamage`, `Move`, `GiveNamedItem`, `DestroyWeapons` and the new `Entities` API, and its `TraceLine` never hits. The README's verified table will say which features ran in game, and on which CS2 patch.
