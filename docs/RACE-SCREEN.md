# Custom race screens, sector timing and pit advice

Open **Settings → Customise race screen**. A new installation includes a plain template and the **Sector times and pit plan** template. Existing saved layouts are migrated to a named profile without changing their layout. Up to 50 profiles are stored in the existing `Preference.raceScreenLayout` value, so normal complete database backups include them; this feature adds no schema or npm dependency.

## Editing and saving

Selecting a profile or changing the preview does not change the saved active profile. **Save race screen** updates the edited profile, **Save as another template** creates a separate copy, and **Save and use for racing** explicitly selects the saved profile for racing. Resetting a layout only changes the draft until it is saved. Loading failures leave saving disabled to prevent overwriting an unreadable saved collection.

The first driver row is the common template for all 1–6 drivers. Its position, size, font, colour and visibility changes propagate to the other rows. Drag a display to move it, use its yellow corner to resize, or use the numeric controls. The selected display stays above neighbouring fields while editing so overlaps cannot hide its resize handle. Automatic height distribution changes only the same column; start lights and intentionally overlapping fields stay independent.

The canvas keeps a 16:9 aspect ratio. Driver rows share the driver area evenly; fewer drivers get larger text up to a fixed limit. Screen, text, row and per-display colours are configurable. Unsupported or missing live values remain `—`. Numeric race lap deficits are distinguished from millisecond time gaps. Times use the selected language's number format.

## Live view and fullscreen

Automatic opening and fullscreen can be disabled independently. The view opens on a new activation of a session. Closing it with Escape or **Back to controls** leaves the session running; resuming the same paused session does not force it open again. Another activation may open it again.

Fullscreen is requested within the existing Start click. A browser may refuse it, especially when activation comes from another client. The large, closable view still works and explains the fallback. Preview and **Test start lights** use labelled synthetic data and send no race-start or hardware commands. CU states 2–6 represent one to five red lamps, 7 is release; state 6 must not be labelled a false start.

## Measured sectors

CU timing channel 1 is start/finish; channels 2 and 3 are intermediate points. One intermediate point gives two sectors, two ordered points give three. Only a complete, ordered sequence between finish passages can populate `Lap.sector1/2/3`. Missing, duplicate, out-of-order and invalid events do not invent sector values. Session changes, pause/resume, disconnection, device replacement and clock resets discard incomplete sequences and restart lap baselines.

The latest measured sectors reach the live leaderboard, reload from persisted laps and appear in session history. The existing Excel export already supports the sector fields and is kept unchanged. Historic laps without measured sectors remain empty. This feature does not configure or update a timing rail or CU firmware.

## Pit advice

Fresh CU readings belong to the assigned controller, never the driver's ranking position. Disconnected, stale, malformed or future-dated readings cannot produce a current fuel value or advice. One or two refuelling places and short approach instructions can be configured in **Sector times and pit plan**. Cars on track at 5/15 or below are ordered by fuel, then controller; an empty tank has immediate priority.

The CU reports cars in the pit lane, not individual left/right occupancy. The proposed group is advisory: there is no automatic switch control, guaranteed free place, forced waiting or physical refuelling operation. Real refuelling must work at each proposed place independently.

## Verification and limits

Use `npm run check:push`, `npm run build`, the backend Jest suite and `npx playwright test tests/race-screen.spec.js` from `packages/frontend`. Tests use their own `test.db`/`e2e.db`; browser lifecycle actions are simulated and cannot start a real race. Pure layout/fuel/pit rules are tested through the existing Jest runner as well as the actual editor through Chromium. Persistence is verified using a real isolated SQLite database and the leaderboard HTTP route.

Linux is the exercised runtime. Real track crossings, timing-rail programming, physical refuelling at both pit places, and automatic fullscreen during an actual hardware race still require a supervised hardware test. The original installation and its database are not changed by preparation. New test fixtures contain no owner's layouts, race data, pictures or import files.
