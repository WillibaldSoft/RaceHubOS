# Join track sections · 6 November 2026

## Deutsch

Je eine Schiene der beiden getrennten Abschnitte mit **Strg/⌘+Klick** markieren und rechts **Zusammenfügen** wählen. Auch mehrere markierte Schienen sind erlaubt, solange sie genau zwei getrennten Abschnitten angehören. Der zuerst markierte Abschnitt bleibt fest; der zweite wird vollständig gedreht und verschoben. Freie Anschlussmarkierungen lassen sich ebenfalls mit Strg/⌘+Klick auswählen. Ihre ausdrücklich gewählten Enden werden für die Verbindung vorgeschlagen.

Die Vorschau markiert den festen Anschluss grün und den beweglichen orange. **Anschlüsse wählen** bietet andere freie Anschlusskombinationen auf gleicher Ebene an; standardmäßig wird das nächstgelegene Paar vorgeschlagen. Erst **Zusammenfügen** ändert die Bahn. Die Entfernung ist nicht auf den Einrastradius begrenzt. Rückgängig/Wiederholen unterstützt die ganze Aktion in einem Schritt.

Die Ermittlung der Abschnitte nutzt tatsächliche eindeutige Anschlüsse und vorhandene Bewegungs-/Katalog-/Boxenbaugruppen. Gruppen werden nicht zerrissen; angeheftete Zusatzteile folgen ihren Trägern. Nicht zugehörige Abschnitte bleiben stehen. Bei bereits gemeinsam verbundenen bzw. gruppierten Schienen, mehr als zwei ausgewählten Abschnitten, fehlenden eindeutigen freien Anschlüssen oder unterschiedlichen Ebenen bleibt die Aktion gesperrt und nennt den Grund. Geschlossene Abschnitte ohne freie Enden lassen sich so nicht zusätzlich anbinden.

Es wird eine starre Verbindung hergestellt, keine Schiene gedehnt oder neu erzeugt. Wenn beide anderen Enden anschließend ebenfalls passen, wird daraus ein geschlossener Rundkurs. Andernfalls bleibt die weitere Lücke bestehen. Die bestehende Aufbauprüfung bleibt für Überlagerungen zuständig.

## English

Select rails in two separate sections with **Ctrl/⌘+click**, then choose **Join sections** in the right sidebar. The first selected section stays fixed; the whole second section rotates and shifts. Free connection markers support the same selection gesture and retain the explicitly selected endpoint pair. The preview marks the fixed connection green and the moving connection orange. A selector offers other free pairs on the same level; the nearest pair is the default. Nothing moves until the action is applied. The distance is not limited by the normal snap radius. Undo/redo applies to the entire join.

Actual unambiguous connections and existing assemblies determine the moving section. Groups and anchored extras stay together; unrelated sections remain fixed. Already connected/grouped selections, more than two sections, missing free connections and mismatched levels are rejected with a reason. No rails are stretched or inserted. Matching remaining ends close the loop automatically; otherwise the remaining gap stays visible.

## Français

Sélectionner les rails de deux sections séparées avec **Ctrl/⌘+clic**, puis choisir **Raccorder les sections** à droite. La première section reste fixe ; toute la seconde tourne et se déplace. Les repères des raccords libres acceptent le même geste et conservent les extrémités explicitement choisies. L’aperçu montre le raccord fixe en vert et le raccord mobile en orange. Une liste propose d’autres paires libres du même niveau ; la paire la plus proche est proposée par défaut. L’action seule applique le déplacement, sans limite de distance d’accrochage. Annuler/rétablir porte sur tout le raccordement.

Les raccords physiques non ambigus et les ensembles existants définissent la section mobile. Groupes et accessoires ancrés restent ensemble ; les autres sections restent fixes. Une sélection déjà raccordée/groupée, plus de deux sections, l’absence de raccords libres ou des niveaux différents empêchent l’action et affichent une explication. Aucun rail n’est étiré ni ajouté. Si les extrémités restantes correspondent, la boucle se ferme ; sinon l’écart demeure visible.

## Verification

- Frontend unit runner: **40 test files passed**. Seven new geometry cases cover distant sections, fixed-side selection order, start-to-start rotation, invalid selections/levels, groups/extras, multiple marked rails and two displaced semicircles forming a closed loop.
- Browser regression: **29 cases passed**, including DE/EN/FR joining, preview/connection choice, whole-section positions, undo/redo, and connection-marker selection. The existing 25 replacement/start/pit/AKS/template/layout cases also pass.
- After the final join-preview adjustment: the four join browser cases and all three localized full-feature capture scenarios passed against the final extracted DEB; its UI files match the built source byte-for-byte in both DEB and portable TAR.
- Standalone/add-on Vite build passed. Existing large-chunk warning remains. No backend/schema changes or rail-artwork changes. No claim of a new complete backend run; earlier migration-test limits remain documented in the publication report.
- [Localized galleries](TRACK-PLANNER-GALLERY.md), scenes 17 and 18, show the join preview and resulting section.

## Proposed next feature: closing suggestions

The user asked whether recommendations could appear as a gap becomes small. This is feasible but **not implemented in this change**: a bounded search for short catalogue sequences could compare endpoint distance, direction and level, then rank geometrically fitting options by part count and available stock. A preview, parts list, overlap check and explicit Apply action should precede any plan edit. A failed bounded search must report that no suggestion was found rather than claiming the circuit cannot be closed.
