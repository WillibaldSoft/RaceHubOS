# Track planner screenshot galleries / Bildergalerien / Galeries

| Language / Sprache / Langue | Gallery | Actual localized screenshots |
| --- | --- | --- |
| Deutsch | [Beschreibung aller neuen Funktionen](TRACK-PLANNER-GALLERY.de.md) | 16 |
| English | [Descriptions of every new feature](TRACK-PLANNER-GALLERY.en.md) | 16 |
| Français | [Description de toutes les nouvelles fonctions](TRACK-PLANNER-GALLERY.fr.md) | 16 |

The galleries cover start/finish with CU and two fuel bays, readable rotated CU lettering, CU replacement on an existing straight, optional AKS display, the pit assistant on either side with one/two bays and replacement of six modules, connection gap/direction guidance, reusable assembly templates, context actions, missing parts, overlaps, open pit connections, repeat placement the fixed sidebars, catalogue replacement with following geometry, and the later cut-point choice.

## Capture provenance

- Captured on **6 November 2026**, using the actual standalone planner UI and synthetic plans only.
- 48 original PNG captures, 1600 × 1400 pixels, device scale 1; screenshots are not composited or annotated.
- Each locale has its own gallery, interface language and SHA-256 manifest under `screenshots/track-planner/{de,en,fr}/manifest.json`.
- The fixture deliberately introduces a rail overlap and removes a pit entry for diagnostic screenshots. Its inventory is explicitly saved as empty. These images do not show a physically validated circuit or personal race data.
- The other pit side reverses pit travel using unmirrored modules. AKS markers describe recorded installation metadata; neither the gallery nor the geometric check verifies electrical operation.
- The gallery is a record of the standalone planner. It does not claim a new Windows/macOS installer, a system installation test, host add-on integration testing or verified Autorennbahnplaner “2.0” compatibility.

## Reproduce

Node 22.13+, installed workspace dependencies and a matching Playwright Chromium are required. No personal database or hardware is needed.

```sh
node scripts/build-track-planner.mjs
node node_modules/@playwright/test/cli.js test --config addons/track-planner/playwright.screenshots.config.mjs
```

The screenshot configuration starts a loopback-only server on port 3181 with a newly generated temporary data directory. It refuses to reuse an existing server. Each language scenario checks its UI state, captures all 16 views and requires an empty browser-error list. The regular regression suite remains separate.

To test a packaged planner, set `RACEHUBOS_PLANNER_PACKAGE_DIR` to a fully extracted package before running the same command. Plans and inventory remain in a separate temporary demo store.

## Verification

The three capture scenarios passed and produced 48 screenshots with per-file SHA-256 manifests. Catalogue replacement and cut-point checks: [replacement report](TRACK-PLANNER-REPLACEMENT-20261106.md). Current layout and repeat-placement checks: [layout report](TRACK-PLANNER-LAYOUT-20261105.md). See [publication verification](TRACK-PLANNER-PUBLICATION-20261105.md) for the final test results and GitHub target. Existing planner validation and operating limits are documented in [planner tools](TRACK-PLANNER-TOOLS.md) and the [source review](TRACK-PLANNER-REVIEW-20261105.md).
