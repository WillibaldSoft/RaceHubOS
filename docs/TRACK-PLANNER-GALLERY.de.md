# Rennbahnplaner – neue Funktionen in Bildern

Deutsch · [English](TRACK-PLANNER-GALLERY.en.md) · [Français](TRACK-PLANNER-GALLERY.fr.md)

Echte Bildschirmaufnahmen des eigenständigen Planers vom 5. November 2026, mit deutscher Oberfläche und ausschließlich synthetischen Demodaten. Alle Bilder wurden bei 1600 × 1400 Pixeln aufgenommen. Die Schienenoptik wurde für die Aufnahmen nicht verändert.

Bedienung und technische Grenzen: [Bedienhilfen](TRACK-PLANNER-TOOLS.md). Quellenvergleich: [Prüfbericht](TRACK-PLANNER-REVIEW-20261105.md). Reproduktion und Prüfstand: [Galerieübersicht](TRACK-PLANNER-GALLERY.md).

## 01. Startbaugruppe anlegen

Im leeren Plan startet die Schaltfläche eine Baugruppe aus Start/Ziel, Control Unit und zwei parallelen Tankplätzen. Bestehende Strecken werden dabei nicht überschrieben; Planänderungen lassen sich rückgängig machen.

![Startbaugruppe anlegen](screenshots/track-planner/de/01-start-setup.png)

## 02. Start/Ziel, CU und zwei Tankplätze

Die eingefügte Baugruppe enthält sechs Hauptmodule und zwei FUEL-Positionen. Sie lässt sich gemeinsam bewegen, drehen und bei Bedarf trennen. Die offenen Enden sind der Ausgangspunkt für den weiteren Streckenaufbau.

![Start/Ziel, CU und zwei Tankplätze](screenshots/track-planner/de/02-start-cu-two-bays.png)

## 03. Lesbare Beschriftung bei gedrehter CU

Auch nach einer Drehung um 180° bleibt die CU-Beschriftung lesbar. Gehäuse, Sensoren und Schienen drehen sich mit; die bestehende Schienenoptik bleibt erhalten.

![Lesbare Beschriftung bei gedrehter CU](screenshots/track-planner/de/03-readable-rotated-cu.png)

## 04. CU auf einer vorhandenen Geraden platzieren

Eine ausgewählte 345-mm-Standardgerade wird gezielt durch die CU mit Start/Ziel ersetzt. Anschlüsse und Nachbarschienen bleiben an ihren Positionen; der zusätzliche Gehäuseplatz wird dargestellt.

![CU auf einer vorhandenen Geraden platzieren](screenshots/track-planner/de/04-cu-on-existing-straight.png)

## 05. Optionale AKS-Markierung

Die Einbauangabe „Anti-Kollisionsschaltung eingebaut“ wird an der ausgewählten Weiche gespeichert. „AKS-Markierungen anzeigen“ steuert die Sichtbarkeit unabhängig davon. Eine Markierung bestätigt keine reale elektrische Funktion.

![Optionale AKS-Markierung](screenshots/track-planner/de/05-optional-aks-marker.png)

## 06. Boxenassistent: ein Tankplatz auf der anderen Seite

Der Assistent zeigt Anschluss, Tankplatzanzahl und Boxenseite vor der Übernahme. Die andere Seite verwendet ungespiegelte Teile mit umgekehrter Boxen-Fahrtrichtung; die Fahrtrichtung ist beim Aufbau zu beachten.

![Boxenassistent: ein Tankplatz auf der anderen Seite](screenshots/track-planner/de/06-pit-assistant-single-other-side.png)

## 07. Boxenassistent: sechs vorhandene Module ersetzen

Die Vorschau plant zwei Tankplätze anstelle von sechs fluchtenden 345-mm-Geraden derselben Ebene. Geschützte Gruppen, Anbauteile und Randstreifen werden nicht stillschweigend entfernt. Erst „Vorschlag übernehmen“ ändert den Plan.

![Boxenassistent: sechs vorhandene Module ersetzen](screenshots/track-planner/de/07-pit-assistant-replace-six.png)

## 08. Anschluss- und Einrasthilfe

Freie Enden lassen sich auswählen. Die Verbindungslinie zeigt hier 25,0 mm Restabstand und die erforderliche Winkeldrehung. Grün bedeutet passende Richtung und Ebene; Einrasten setzt zusätzlich ausreichende Nähe voraus.

![Anschluss- und Einrasthilfe](screenshots/track-planner/de/08-connection-gap-direction.png)

## 09. Baugruppenvorlagen speichern und übertragen

Die ausgewählte Startbox wird als benannte Vorlage im Browser gespeichert. Einfügen am gewählten Anschluss sowie JSON-Export und -Import ermöglichen die Wiederverwendung. Vorlagen erhalten Fuel-/AKS-Angaben und relative Ebenen; es gibt keine automatische Synchronisierung.

![Baugruppenvorlagen speichern und übertragen](screenshots/track-planner/de/09-assembly-templates.png)

## 10. Kontextmenü direkt am Teil

Ein Rechtsklick bietet Drehen, Ersetzen durch das gewählte Katalogteil, Trennen, AKS-Einbauangabe und Löschen. Verfügbarkeit und Umfang der Aktionen hängen von Auswahl und Gruppierung ab.

![Kontextmenü direkt am Teil](screenshots/track-planner/de/10-context-menu.png)

## 11. Aufbauprüfung und Fehlteile

Das absichtlich fehlerhafte Demolayout enthält eine Überlagerung und einen offenen Boxenanschluss. Der gespeicherte Demobestand ist ausdrücklich leer; die Fehlteilliste wird daraus berechnet. Die Aufnahme enthält keine persönlichen Bestandsdaten.

![Aufbauprüfung und Fehlteile](screenshots/track-planner/de/11-build-check-and-missing-parts.png)

## 12. Überlagerungen auf der Zeichenfläche markieren

Ein ausgewählter Prüfbefund markiert die betroffenen Hauptschienen rot. So lässt sich die problematische Stelle direkt bearbeiten. Nach Planänderungen verschwinden veraltete Markierungen.

![Überlagerungen auf der Zeichenfläche markieren](screenshots/track-planner/de/12-highlighted-overlap.png)

## 13. Offenen Anschluss eines Boxenteils finden

Die Prüfung erfasst auch offene Slot-Enden nativer Boxenteile. Der rote Kreis zeigt den nach dem Entfernen einer Einfahrt entstandenen offenen Anschluss. Dies ergänzt die Prüfung der Hauptstrecke und ersetzt keine elektrische Prüfung.

![Offenen Anschluss eines Boxenteils finden](screenshots/track-planner/de/13-open-pit-connection.png)

## 14. Mehrfachlegen und feste Bedienbereiche

Im Katalog „Mehrfachlegen“ markieren und eine Schiene wählen. Die Vorschau folgt der Maus; jeder Klick setzt ein weiteres gleiches Teil. Nahe passende Anschlüsse rasten ein. R / Umschalt+R drehen die Vorschau, Escape beendet den Modus. Die Bahn bleibt zwischen Katalog links und Bedienfeldern rechts sichtbar; beide Seiten scrollen unabhängig. Auf kleinen Bildschirmen lassen sich die Bereiche unterhalb der Bahn öffnen.

![Mehrfachlegen und feste Bedienbereiche](screenshots/track-planner/de/14-repeat-placement.png)
