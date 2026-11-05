# Catalogue replacement and following geometry · 6 November 2026

## Deutsch

Ein einzelnes Bahnteil markieren und die gewünschte Ersatzschiene im Katalog anklicken. Der Eingang des markierten Teils bleibt stehen. Die neue Ausgangsposition und -richtung bestimmen eine gemeinsame Drehung und Verschiebung des angeschlossenen Folgeabschnitts. Der Katalogklick ersetzt sofort; zusätzliches Ziehen oder „Auswahl ersetzen“ ist nicht nötig. Der bestehende Ersetzen-Knopf und das Kontextmenü nutzen dieselbe Nachführfunktion.

Rechts erscheint **Auftrennpunkt nach dem Austausch**. Wählbar sind „Direkt nach dem neuen Teil“ und die zulässigen Enden der Folgeschienen. Der Abschnitt bis zum gewählten Punkt bewegt sich mit; der Rest bleibt stehen. Der Punkt und ein verbleibender Anschlussspalt werden orange markiert. Jede Wahl wird aus dem Zustand vor dem Austausch neu berechnet; Drehungen summieren sich nicht auf. „Auftrennpunkt übernehmen“ schließt die Auswahl. Andere Planänderungen beenden sie ebenfalls. Austausch und Änderungen am Auftrennpunkt lassen sich schrittweise rückgängig machen und wiederholen.

Es werden tatsächliche, eindeutige Anschlüsse verfolgt, auch bei ungeordneter Teileliste, rückwärts verlegten Schienen und beim Umlauf einer geschlossenen Bahn. Standardmäßig folgt der gesamte zulässige angeschlossene Folgeabschnitt. Bei einem geschlossenen Einzelkreis liegt die Trennung damit vor dem ersetzten Teil. Mehrdeutige oder bereits offene Anschlüsse werden nicht übersprungen. Nicht verbundene Schienen bleiben unverändert. Bewegungskombinationen, Katalogbaugruppen und native Boxenbaugruppen werden nicht durch einen Auftrennpunkt geteilt. Eine markierte geschützte Bewegungskombination muss vor dem Austausch getrennt werden. Angeheftete Zusatzteile folgen ihren Trägerschienen; freie Zusatzteile werden nicht einer Schiene zugeordnet.

**Mehrfachlegen** hat Vorrang: Im aktivierten Modus wählt der Katalog weiterhin nur das nächste Teil an der Maus. Ohne markiertes Bahnteil wählt der Katalog wie bisher das nächste Teil zum Anlegen. Der Auftrennpunkt ist eine Bearbeitungsauswahl; gespeichert wird die resultierende Bahngeometrie im bestehenden Planformat. Es entsteht kein neuer Dateiformat- oder Datenbankstand.

## English

Select one rail and click its replacement in the catalogue. The incoming end stays fixed; the physically connected following section rotates and shifts to the replacement's outgoing geometry. The right sidebar then lets you choose the cut immediately after the new part or after a following rail. Orange marks the boundary and any remaining gap. Cut choices recompute from the original layout, support undo/redo and never accumulate rotations. Confirm the cut or make another edit to close the selection.

Connections are followed independently of array order, including reversed rails and closed circuits. Disconnected sections remain fixed; ambiguous joints stop traversal. Cuts cannot split movement groups, catalogue assemblies or native pit assemblies. Release a protected selected movement group first. Anchored extras follow their carrier rails. Repeat placement retains its existing mouse-stamping behavior and takes priority over catalogue replacement. Only resulting geometry is saved in the existing plan format.

## Français

Sélectionner un rail, puis cliquer sur son remplacement dans le catalogue. L’entrée reste fixe ; la section suivante raccordée suit la nouvelle position et direction de sortie. Le panneau droit permet ensuite de choisir la séparation juste après la nouvelle pièce ou après un rail suivant. Le repère orange montre la limite et l’écart restant. Chaque choix est recalculé depuis l’état initial, sans cumuler les rotations, avec annuler/rétablir. Confirmer ou effectuer une autre modification termine le choix.

Le parcours utilise les raccords physiques indépendamment de l’ordre du tableau, y compris les rails inversés et les circuits fermés. Les sections indépendantes restent fixes ; un raccord ambigu arrête le parcours. Une séparation ne coupe pas un groupe de déplacement, un ensemble du catalogue ou un ensemble natif des stands. Dégrouper d’abord un groupe protégé sélectionné. Les accessoires ancrés suivent leurs rails. La pose multiple conserve la pose à la souris et reste prioritaire. Seule la géométrie obtenue est enregistrée dans le format existant.

## Verification and evidence

- Vite standalone/add-on build passed; existing large-chunk warning remains.
- Frontend unit runner: 39 test files passed. Six new geometry tests cover propagation, later cuts, shuffled/disconnected parts, a closed loop, multipart replacement with level/extra remapping and group protection, and reverse-connected rails.
- Browser regression: 25 cases passed, including catalogue replacement, later cut changes, undo/redo and repeat-placement precedence in DE/EN/FR, plus all existing start/CU/pit/AKS/template/audit/layout cases.
- [Localized screenshots](TRACK-PLANNER-GALLERY.md), scenes 15 and 16, show the replacement and the later cut choice.
- No backend, database schema or rail-artwork changes. Prior backend migration-test limitations remain in the [publication report](TRACK-PLANNER-PUBLICATION-20261105.md).

The cut is geometric editing assistance; it does not guarantee a closed circuit, clearance or physical buildability. The existing build audit remains available. Ambiguous connections require manual correction before automatic following can continue.
