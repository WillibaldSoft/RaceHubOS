# Layout and repeat placement · 2026-11-05

## Deutsch

Die grafische Arbeitsfläche nutzt die verfügbare Fensterhöhe: Katalog links, Bahn in der Mitte, Auswahl und Detailfelder rechts. Die Seitenbereiche scrollen unabhängig. Rückgängig, Wiederholen, Zoom und Einpassen bleiben erreichbar. Zusätzliche Ansichtsoptionen sind ausklappbar. Auf kleinen Bildschirmen öffnen Katalog und Auswahl unterhalb der Bahn. Ein ResizeObserver passt den SVG-Ausschnitt an die tatsächliche Zeichenfläche an; Einpassen berücksichtigt das vollständige Bahnrechteck. Die bestehende Schienenzeichnung bleibt erhalten.

Im Katalog **Mehrfachlegen** markieren und eine Schiene wählen. Die Maus zeigt die Vorschau; jeder Klick setzt ein weiteres Exemplar. Passende freie Anschlüsse derselben Ebene rasten bei aktivierter Einrasthilfe ein. R / Umschalt+R drehen die freie Vorschau um ±15°, Escape oder Abwählen beendet den Modus. Ein exakt belegter Platz wird nicht doppelt gestempelt. Jede Platzierung unterstützt Rückgängig/Wiederholen. Auch mehrteilige Katalogeinträge werden vollständig eingefügt. Bei aktiver Anschlusshilfe bestimmt der passende Anschluss die Richtung.

## English

The graphical workspace fills the available window height: catalogue left, drawing centre, selection and details right. Sidebars scroll independently. Undo, redo, zoom and fit remain accessible; additional view options expand on demand. Small screens dock catalogue and selection below the drawing. A ResizeObserver and aspect-aware SVG viewport keep the complete track footprint visible when fitted. Existing rail artwork is preserved.

Check **Repeat placement** and select a catalogue part. Its preview follows the mouse; each click places another copy. When snapping is enabled, compatible nearby open ports on the same level determine position and direction. R / Shift+R rotate a free preview ±15°; Escape or clearing the checkbox exits. Exact duplicate stamps are rejected. Every placement supports undo/redo, including complete multipart catalogue assemblies.

## Français

L’espace graphique utilise la hauteur disponible : catalogue à gauche, circuit au centre, sélection et détails à droite. Les panneaux défilent séparément. Annuler, rétablir, zoomer et ajuster restent accessibles ; les options supplémentaires se déplient. Sur petit écran, les panneaux s’ouvrent sous le circuit. ResizeObserver et le cadrage SVG adapté au rapport largeur/hauteur conservent toute l’emprise du circuit lors de l’ajustement. Le dessin des rails est conservé.

Activer la **pose répétée**, puis choisir une pièce. Son aperçu suit la souris ; chaque clic pose une copie. L’accrochage actif utilise les raccords libres compatibles du même niveau pour choisir position et direction. R / Maj+R tournent l’aperçu libre de ±15° ; Échap ou décocher termine le mode. Les doublons exactement superposés sont refusés. Chaque pose, y compris un ensemble de plusieurs modules, peut être annulée et rétablie.

## Verification

- Standalone UI build: passed; existing Vite large-chunk warning remains.
- Frontend Node unit runner: **38 test files passed**, including four new viewport/repeat-placement cases.
- Standalone Playwright regression: **21 passed**. Includes DE 1600×900, FR 1366×768, EN 1024×768, resizing down to 390×844 and 768×650, independently scrolling panels, full track fit, ordinary dragging, zoom, repeated stamping, snapping, duplicate prevention, Escape and undo/redo. Existing start/CU/pit/AKS/template/audit tests also pass.
- Shared preview/export components: targeted ESLint passed. No backend or database schema changes. The earlier backend migration-test limitations remain documented in [publication verification](TRACK-PLANNER-PUBLICATION-20261105.md); this change does not claim a fresh complete backend run.
- Real screenshots and DE/EN/FR explanations: [galleries](TRACK-PLANNER-GALLERY.md).
- Linux amd64 DEB, portable TAR and add-on JSON built locally. Every bundled dist file in DEB and TAR was compared byte-for-byte with the current build. SHA-256 manifest accompanies the artifacts. Windows/macOS installers were not built for this change.

## Paths and remaining proposals

Local artifacts: `installation/streckenplaner-20261105/layout-mehrfachlegen/deb/` relative to the Carrera workspace. The running RaceHubOS installation is not replaced by these builds.

Further optional work: persistent sidebar widths, an explicit touch placement workflow, and collision feedback while hovering (current duplicate protection only rejects exact stamps; the existing build audit checks overlaps). Repeat placement remains limited by the existing 2,000-piece plan limit. Source comparisons and import/export limitations remain in the [review](TRACK-PLANNER-REVIEW-20261105.md).
