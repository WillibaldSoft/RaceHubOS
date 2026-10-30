# Optional track planner / eigenständiger Streckenplaner

The editable UI is built separately from RaceHubOS. Read-only saved-plan rendering and the documented version-1 plan format stay in the host for compatibility. The host has no imports of the editor or room-search worker. The add-on package includes its own JavaScript, CSS, worker, fonts and reference plans; installation needs no npm download.

## Add-on in RaceHubOS

Requires the host changes on `feat/optional-track-planner-speed` (host API 1). In the host repository:

```sh
node scripts/build-track-planner.mjs
node scripts/addons.mjs install addons/track-planner/track-planner.racehub-addon.json
```

An already built package can be copied from another computer and installed with the second command. The installer checks every SHA-256 digest, API version and path before writing. It never overwrites an existing installation. Install only trusted packages: this is executable local UI code, not a security sandbox. Defaults to `packages/backend/addons/track-planner`; override with `RACEHUBOS_ADDONS_DIR` before starting the host. After installation, open Settings → Track planner add-on → Enable. It starts disabled on a new installation. No database schema change is required.

Disable in Settings before removing the `track-planner` installation directory. Saved track layouts and inventory remain in the existing host data store. A replacement installed after removal retains the existing activation preference; disable first to require explicit reactivation. An incompatible or damaged installation cannot activate or serve assets. This first add-on protocol is experimental and still needs maintainer agreement in Discussion #9.

The planner runs in its own browser frame. Only the matching frame and origin can exchange draft/save messages. The parent retains track persistence. Draft changes are kept in the host while editing. Saved plan previews remain available without the add-on.

## Standalone on another computer

No RaceHubOS or database installation is required. The separately built browser UI is served by `standalone-server.mjs`, using only Node built-ins. Offline Linux x64 and Windows x64 packages include Node; no Python, npm install, Bluetooth hardware or internet connection is needed at runtime.

- Linux Debian/Mint/Ubuntu x64: install the `.deb`, start **RaceHubOS Track Planner** from the menu. A portable archive is also supplied; extract and run `Start.sh`.
- Windows x64: use the experimental `RaceHubOS-Streckenplaner-Setup-x64.exe` installer, or extract the complete portable ZIP to a local folder and run `Start.cmd`. Both include Node and work offline. Windows hardware execution still needs validation.
- Source/other platforms: Node 22.13+ required; build the UI, then run `node addons/track-planner/launcher.mjs`. Other platform binaries are not bundled.

The local browser opens on `http://127.0.0.1:3180`. The server binds only to loopback. Close the launch terminal to stop it. If already running, a second launch opens the existing planner. Override `PORT` if required.

Own plans and stock are stored under `%LOCALAPPDATA%/racehubos-track-planner` on Windows or `$XDG_DATA_HOME/racehubos-track-planner` (normally `~/.local/share/racehubos-track-planner`) on Linux. Override `RACEHUBOS_PLANNER_DATA_DIR` to choose another folder. Each overwrite first saves the previous data file; the ten latest backups remain in `backups/`. A malformed store stops startup instead of silently replacing it. Removing the application does not remove this data.

Use the planner's Files tab to exchange RaceHubOS JSON, experimental Softyroyal SBP and supported Autorennbahnplaner TRK files. Free-placement plans cannot be exported to legacy TRK. JSON preserves the full native format. File exchange is explicit; there is no automatic synchronization with another computer.

## Last-lap speed in RaceHubOS

Settings select actual or scale km/h. The explicit scale-source option uses each selected car's saved scale (Cars → Equipment → Scale), or forces the global 1:32/1:24 setting. Vehicle-scale mode uses the global value as a fallback when a car has no valid scale. Unrecognized or empty values use the fallback. Actual mode ignores scale. This applies to the leaderboard and custom race screen. The feature works without the planner using the manually entered track length.

`actual km/h = distance in metres × 3600 / lap time in milliseconds`

Scale km/h multiply by 32 or 24. Missing/non-positive/non-finite distance or time shows `—`. A lap time is a lap average, not instantaneous telemetry; lane changes and pit routes make the nominal distance approximate. Car/controller speed settings are not changed.
