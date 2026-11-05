# Bedienhilfen des Streckenplaners

Die Schienen- und Geräteoptik bleibt erhalten. Die Bauhilfen stehen oberhalb des Katalogs; alle Änderungen an der Strecke können über Rückgängig/Wiederholen zurückgenommen werden.

## Boxenassistent

1. Einen offenen Anschluss auf der Zeichenfläche anklicken oder im Assistenten wählen.
2. „Boxenassistent“ öffnen, einen oder zwei Tankplätze und die Seite wählen.
3. „Vorschau erstellen“, Einfahrt, Ausfahrt und Platzbedarf prüfen, dann „Vorschlag übernehmen“.

Alternativ lassen sich sechs aufeinanderfolgende, fluchtende 345-mm-Geraden derselben Ebene ersetzen. Eine CU innerhalb dieses Bereichs bleibt erhalten. An Ein- und Ausfahrt benötigt die Box ihre Weichenmodule; eine dort vorhandene CU muss außerhalb oder zwischen diesen Modulen liegen. Vorhandene Gruppen, angehängte Boxenteile und Randstreifen werden nicht automatisch entfernt.

Die andere Seite entsteht durch umgekehrte Boxen-Fahrtrichtung mit realen, ungespiegelten Modulen. Sie bedeutet keine frei erfundene Linksweiche. Ein- und Ausfahrt sowie die tatsächliche Fahrtrichtung müssen beim Aufbau berücksichtigt werden. Die Vorschau führt keine elektrische Simulation durch.

Eine neu angelegte Box ist eine eigene Bewegungsgruppe. Ein- und Ausfahrt sowie ein oder zwei echte Fuel-Positionen sind explizit gespeichert. Mehrere unabhängige Boxen und Vorlagen sind möglich. Materialliste und Darstellung verwenden dieselben Fuel-Zuordnungen.

## CU / Start-Ziel auf vorhandener Strecke

Eine Standardgerade wählen und „Ausgewählte Gerade → CU / Start-Ziel“ betätigen. Schienenanschlüsse und Nachbarschienen bleiben an ihren Positionen. Der zusätzliche CU-Gehäuseplatz wird dargestellt und in der Aufbauprüfung berücksichtigt. Ist schon eine CU vorhanden, diese auswählen und verschieben.

## Anschlüsse und Einrasthilfe

„Anschlüsse und Einrasthilfe zeigen“ blendet freie Enden und Richtungspfeile ein. Ein freies Ende lässt sich anklicken; es dient im Assistenten und für Vorlagen als Einfügeanschluss. Anfang/Ende wird außerdem für normales Anlegen berücksichtigt. Bei einer ausgewählten oder bewegten Gruppe zeigt eine gestrichelte Linie den nächsten Anschluss, Abstand in Millimetern und erforderliche Winkeldrehung. Grün bedeutet passende Richtung und Ebene; tatsächliches Einrasten erfordert weiterhin ausreichende Nähe. Die vorhandene Option für automatisches Einrasten bleibt maßgeblich.

Der Anlegen-Knopf wird bei kurzen Schienen kleiner, damit die Schiene für Auswahl und Kontextmenü erreichbar bleibt.

## Baugruppenvorlagen

Schienen oder eine Gruppe auswählen, „Baugruppenvorlagen“ öffnen und unter einem Namen speichern. Die Vorlage wird auf ihren ersten Anschluss ausgerichtet; Schienen, Randstreifen, angehängte Boxenteile, Fuel-/AKS-Angaben und relative Ebenen bleiben erhalten. Einfügen richtet den ersten Anschluss am ausgewählten offenen Ende aus. Unzulässige Ebenen außerhalb 0–2 werden abgelehnt.

Bis zu 50 Vorlagen liegen im Browserprofil. Export/Import als JSON überträgt sie zwischen Rechnern; dies ist keine automatische Synchronisierung. Ungültige Dateien werden abgelehnt. Bei beschädigtem oder gesperrtem Browserspeicher wird ein Fehler angezeigt. Vorlagen lassen sich gezielt löschen. Das Einfügen in den Streckenplan ist rückgängig machbar; Änderungen an der separaten Vorlagenbibliothek gehören nicht zur Planhistorie.

## Kontextmenü

Rechtsklick auf ein Teil bietet Drehen, Ersetzen durch das aktuell im Katalog gewählte Teil, Trennen der Baugruppe, AKS-Einbauangabe und Löschen. Bei gruppierten Teilen verhindert das Menü unbeabsichtigtes Ersetzen eines Einzelteils. Löschen zeigt die Anzahl der betroffenen Schienen an und entfernt zugehörige Anbauteile unter Erhaltung der übrigen Index-/Gruppenzuordnungen. Gesperrte native Boxenweichen lassen sich erst nach Trennen drehen oder ersetzen.

## Aufbauprüfung

„Aufbau prüfen“ liest den gespeicherten Teilebestand und prüft anschließend:

- freie bzw. mehrdeutige Anschlüsse der Hauptstrecke, offene Slot-Enden nativer Boxenteile und getrennte Gruppen;
- geometrische Überlagerungen von Hauptschienen, Gerätegehäusen und nativen Boxenteilen auf derselben Ebene;
- fehlende Artikel anhand des gespeicherten Bestands sowie nicht zuordenbare Teile.

Anschlüsse und Überlagerungen können aus der Liste auf der Zeichenfläche markiert werden. Markierungen verschwinden nach einer Planänderung, damit keine veralteten Befunde angezeigt werden. Ohne gespeicherten Bestand wird keine scheinbar genaue Fehlteilliste aus einem angenommenen Nullbestand erzeugt.

Die Prüfung ist eine geometrische Aufbauhilfe, kein Nachweis vollständiger physischer oder elektrischer Kollisionsfreiheit. Randstreifen, tatsächliche Höhenverläufe und Elektronik sind zusätzlich zu prüfen.

## Austausch und Kompatibilität

Die neuen Angaben sind optionale Erweiterungen des nativen Version-1-Plans. Alte Pläne bleiben lesbar. JSON und eigene SBP-/TRK-Metadaten bewahren diese Angaben; fremde Programme können Erweiterungen ignorieren. Neue freie Vorlagen lassen sich wie bisher nicht als Legacy-TRK exportieren. Native SBP-Ausgabe vermeidet doppelte Ein-/Ausfahrten aus Hauptschienen-Träger und angehängter Boxenweiche.

## Tests

- `node packages/frontend/tests/unit/trackPlannerTools.test.mjs`: gezielte Geometrie-, Schutz-, Vorlagen-, AKS-/Fuel-, Bestands- und Anschlussprüfungen.
- `node --test packages/frontend/tests/unit/*.test.mjs`: bestehende und neue Unit-Testdateien.
- `node node_modules/@playwright/test/cli.js test --config addons/track-planner/playwright.config.mjs`: vorhandene Standalone- und neue Bedienabläufe, inklusive Rückgängig/Wiederholen, Speichern, Vorlagenübertragung, Kontextmenü und Bestand.
- `node scripts/check-rules.mjs`: Repository-Regeln.

Die Ausführungsergebnisse, Buildartefakte und Git-Commits stehen im jeweiligen Ergebnisbericht. Die laufende RaceHubOS-Installation wird durch das Erstellen dieser Dateien nicht aktualisiert.
