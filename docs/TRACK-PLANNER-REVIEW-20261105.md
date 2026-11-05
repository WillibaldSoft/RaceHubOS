# Streckenplaner: Prüfung am 5. November 2026

## Ausgangslage und Arbeitskopie

Bearbeitet: `installation/github-fork-20261030/worktree`, Branch `publication/carrera-1.25.2`, Ausgangscommit `d5859b5`. Remote laut lokaler Konfiguration: `https://github.com/AnselmeSDR/RaceHubOS.git`. Der lokale Branch lag drei Commits vor dem lokal bekannten `origin/main`; kein Fetch und kein Push durchgeführt, daher keine Aussage zum aktuellen Server-HEAD.

Die laufende Arbeitskopie `RaceHubOS` steht auf `9b8c240` und enthält uncommittete Katalog-/Add-on-Änderungen. Diese wurden nicht verändert. Der bearbeitete Fork war zu Beginn sauber. Seine `node_modules` sind mit der laufenden Kopie verlinkt. Der separate Vite-Build erhält deshalb einen expliziten Alias auf die Shared-Quellen dieses Forks, damit er nicht versehentlich dessen fremde Workspace-Version bündelt.

## Belegter Vergleich und Grenzen

Recherche am 05.11.2026; Herstellerangaben, keine nachgestellten Bedienversuche in proprietären Desktop-Anwendungen.

| Bereich | Externe Referenz | Stand des Forks / Folgerung |
| --- | --- | --- |
| Einstieg | SoftyBP zeigt einen webbasierten Katalog mit normalen Schienen, Randstreifen und Digitalteilen; veröffentlichte Pläne werden per Link geteilt. | Eigenständiger Offline-Browserplaner und optionales Host-Add-on vorhanden. Neu: Startbaugruppe statt erster Konfiguration über numerische Boxenparameter. |
| Streckenaufbau | Autorennbahnplaner dokumentiert Teilebuttons und Haupt-/Nebenstränge für Abzweige und Rückführungen. | Freies Verschieben, Drehen, Einrasten, Baugruppen, Einfügen/Ersetzen und Undo/Redo bereits vorhanden. Neu: CU/Start-Ziel und zweifache Box als gemeinsame Baugruppe. |
| Bestand und Raum | Hersteller nennt Teileverwaltung, Raumplanung, Gebäudepositionen und bis zu acht Spuren. | Schienenbestand, Teileliste, Raumplaner, Randstreifen und Ebenen vorhanden. Keine Gleichwertigkeit bei beliebigen achtspurigen Nebensträngen oder Gebäudebibliotheken behauptet. |
| 3D | Autorennbahnplaner nennt einen optionalen 3D-/VR-Zusatz. | Der geprüfte Editor ist 2D; keine 3D-/VR-Funktion ergänzt. |
| Dateiaustausch | Externe Formate sind keine Zusicherung vollständiger Kompatibilität. | JSON bewahrt das native Modell. SBP und TRK sind experimentell; freies Platzieren verhindert den Legacy-TRK-Export. AKS bleibt in JSON und in eigenen Austausch-Metadaten erhalten; fremde Programme müssen diese Erweiterung nicht anzeigen oder bewahren. |

Primärquellen:

- [Softyroyal](https://softyroyal.de/) und [indexierte SoftyBP-Oberfläche](https://sippenserver.de/): Katalog-/Link-Funktionen; Softyroyal selbst lieferte beim Textabruf keinen lesbaren Inhalt. Detailbehauptungen zu einer aktuellen Einrast-Automatik wurden daher nicht aus Sekundärquellen übernommen.
- [Autorennbahnplaner Funktionen](https://autorennbahnplaner.de/shop/): Raum, Teilebestand, Gebäude, bis acht Spuren und optionaler 3D-/VR-Zusatz.
- [Hersteller-Tutorials](https://autorennbahnplaner.de/tutorials/): Teilebuttons, Haupt-/Nebenstränge, Spurzuordnung, Druck und Teileverwaltung.
- [Hersteller-Download](https://autorennbahnplaner.de/shop/autorennbahnplaner-download/): Windows `2022.001.002` vom 17.06.2022, Macintosh `2026.001.001` vom 17.02.2026; AIR-Laufzeit. Die Startseite nennt ebenfalls die Windows-Version 2022.

Eine eigenständige Version namens **Autorennbahnplaner 2.0** konnte weder auf diesen Herstellerseiten noch durch eine gezielte Suche verifiziert werden. Ein versionsspezifischer Vergleich oder vollständige TRK-2.0-Unterstützung wird deshalb ausdrücklich nicht als erledigt ausgewiesen. Dafür wird eine konkrete Herstellerquelle bzw. repräsentative Datei benötigt.

## Änderungen

- Leerer Plan: Schaltfläche „Start/Ziel + CU + 2 Tankplätze einfügen“. Sechs Module à 345 mm mit Einfahrt, gemeinsamer Zufahrt, Control Unit, paralleler Box mit zwei Tankplätzen und Ausfahrt; Gesamtlänge des Hauptstrangs 2070 mm. Das ist ein offener Streckenbeginn, kein geschlossener Rundkurs und keine elektrische Einbauanleitung.
- Die vorhandene Boxengeometrie, Auswahl-/Bewegungsgruppen und Undo/Redo werden wiederverwendet. Ganze Baugruppe bewegen/drehen, bei Bedarf trennen und offene Enden weiterbauen. Die Schaltfläche erscheint nur im leeren Plan; vorhandene Strecken werden nicht ersetzt.
- CU- und weitere Gerätebeschriftungen bleiben bei gedrehten Schienen lesbar. Gehäuse, Schienenoberfläche, Sensoren und Weichengeometrie bleiben erhalten.
- Bei ausgewählter Weiche: „Anti-Kollisionsschaltung eingebaut“. Separate Option „AKS-Markierungen anzeigen“, standardmäßig aus. Einbauangabe und Anzeige werden getrennt gespeichert. Normale und native Pit-Weichen unterstützt; die Angabe steuert keine reale Elektronik und simuliert keine Kollisionsfreiheit.
- Validatoren akzeptieren ausschließlich boolesche AKS-Angaben an Weichen. Bestehende Pläne ohne diese Felder bleiben gültig.
- Linux-Paketbau benötigt keinen Windows-Node mehr. Ohne Windows-Laufzeit entsteht kein vermeintliches Windows-Paket. Installer-Revisionszähler erhöht; Projekt-/Produktversion unverändert.

## Weitere Vorschläge

1. Vorschau einer einfügbaren Start-/Boxenbaugruppe an ausgewählten offenen Anschlüssen, inklusive Links-/Rechtsvariante und Kollisionsanzeige. Der jetzige sichere Einstieg ist auf leere Pläne beschränkt.
2. Verständlicher Assistent für Haupt- und Nebenstränge mit echten Anschlussprüfungen; getrennte Tankplätze und Ein-/Ausfahrtrichtung vor Übernahme hervorheben.
3. Import-Kompatibilitätsmatrix mit echten Beispielen aller nachgewiesenen Autorennbahnplaner-Versionen, insbesondere der gewünschten „2.0“. Fremdprogrammtests für SBP/TRK durchführen; native JSON-Sicherung weiter anbieten.
4. AKS optional pro mehrteiliger Weichenbaugruppe gemeinsam setzen, zusätzlich in der Teileliste ausgeben. Der jetzige Stand erfasst die ausgewählte physische Schiene bzw. einzelne Boxenweiche.
5. Signierte Windows-/macOS-Pakete auf passenden Buildsystemen und reale Installationstests auf Zielsystemen. Linux-Paketprüfung durch Entpacken und Browserlauf ersetzt keinen Systeminstallationstest.

Messungen und endgültige Artefakt-/Commitnachweise werden im begleitenden Ergebnisbericht unter `installation/streckenplaner-20261105` abgelegt.
