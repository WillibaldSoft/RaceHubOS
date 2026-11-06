# Vorbereitung für Anselmes Integrationsweg · 6. November 2026

## Zuständigkeit und Status

Der Planer wird als eigenständige Anwendung mit eigenem Repository vorbereitet. Anselme entwirft die offizielle Plugin-Schnittstelle und implementiert Download, Start und Add-on-Unterstützung im RaceHubOS-Kern. Dafür wurden in dieser Änderung **keine funktionalen Host-, Backend-, Datenbank- oder Shared-Core-Dateien geändert**. Die fertige offizielle Schnittstelle ist noch nicht bekannt; die Vorbereitung behauptet keine bereits bestehende offizielle Plugin-Kompatibilität.

[Deutsche Übersetzung seiner Nachricht](ANSELME-NACHRICHT-DE.md).

## Oberfläche

- Vorhandener shadcn/ui-Button, Inter-Schrift und RaceHubOS-Designvariablen für Primärfarben, Flächen, Rahmen, Fokus und Radien statt eigener Türkis-Überschreibungen.
- Eigenständiger Modus: System/Hell/Dunkel-Umschalter mit lokaler Speicherung. Im eingebetteten Modus bestimmt der Host Darstellung und Sprache; dort gibt es keinen konkurrierenden Theme-Schalter.
- Eingabewerte nutzen ausdrücklich die Vordergrundfarbe des Themes, einschließlich Dunkelansicht.
- Bahnfläche und seitliche Bedienelemente behalten ihre Aufteilung. Schienenzeichnung und Geometrie bleiben erhalten.

## Austauschbare Anbindung

`addons/track-planner/src/host/legacyBridge.js` kapselt das bisherige experimentelle Nachrichtenprotokoll. `EmbeddedPlanner` bekommt die Transportanbindung als austauschbare Abhängigkeit. Der Adapter prüft Absender, Origin, Kanal und initiales Planformat, beschränkt ausgehende Aktionen und räumt Listener beim Schließen auf. Diese Kompatibilität dient dem vorhandenen Renn-PC; sie ist kein Entwurf einer verbindlichen RaceHubOS-Kernschnittstelle.

`integration/proposal.json` benennt die vorbereiteten Fähigkeiten und ausdrücklich offenen Vereinbarungen. Download-Knopf, Updateverfahren, Berechtigungen, Authentifizierung und offizielles Plugin-Manifest bleiben Anselmes Entscheidung.

## Fertiges Layout und Sektoren

`src/host/layoutHandoff.js` erzeugt einen **planereigenen Übergabevorschlag**, keine bereits vom Host unterstützte API:

- Vollständiger nativer Plan im bestehenden Format.
- Weltkoordinaten der Schienenanfänge/-enden in Millimetern mit Richtung und Ebene.
- Spur­längen in Metern.
- Optionale eindeutig benannte Sektoranker an einem Schienenanfang oder -ende, mit daraus exakt berechneter Position.

Das synthetische Beispiel in `integration/layout-handoff.example.json` enthält Start/Ziel und einen Sektoranker. Es ordnet keine reale CU-Messstelle oder Zeitmessung automatisch zu. Eine feinere Position innerhalb einer Kurve sowie Hardware-Zuordnung können nach Abstimmung ergänzt werden. Es wurden keine Sektor-Steuerelemente in die Produktoberfläche eingebaut, bevor die Host-Nutzung geklärt ist.

## Eigenes Repository reproduzierbar erzeugen

```sh
node scripts/export-track-planner-repository.mjs /new/empty/planner-directory
```

In einer Umgebung, die Git-Unterprozesse blockiert, kann der verifizierte Ausgangscommit über `PLANNER_SOURCE_COMMIT` gesetzt werden. Das Exportziel muss neu sein; bestehende Dateien werden nicht überschrieben. Die Herkunftsangabe vermerkt, dass der aktuelle Arbeitsstand enthalten ist.

Der Export enthält den vollständigen Planer, eigene mitgelieferte Geometrie-/UI-Quellen unter `vendor/racehubos`, passende Lizenzen und SHA-256-Herkunftsnachweise. Er benötigt kein Eltern-Checkout. Abhängigkeiten werden auf die tatsächlich verwendeten Versionen festgelegt. Ein frisches `npm install` erzeugt die Lockdatei; diese gehört anschließend in das eigene Repository.

```sh
npm install
npm test
npm run build
npm start
```

Die Standalone-Anwendung nutzt nur Loopback und ihren eigenen lokalen Datenspeicher. Der Export legt kein neues öffentliches GitHub-Repository an. Das lokale Repository ist ein konkreter Übergabestand; die endgültige GitHub-Adresse ist noch offen.

## Prüfungen

41 Frontend-Testdateien einschließlich fünf neuer Adapter-/Übergabetests bestehen. Das separat installierte Exportprojekt besteht seine 22 gezielten Tests und baut erfolgreich mit eigenen Abhängigkeiten und mitgelieferten Quellen. Alle 33 Browserfälle bestehen gegen den endgültigen eigenständigen Build: Hell/Dunkel, Theme-Speicherung, geerbte Host-Darstellung, Lesbarkeit von Eingabewerten und die bisherigen Planerfunktionen. Die drei lokalisierten Screenshot-Szenarien bestehen und erzeugen 57 Aufnahmen mit SHA-256-Manifesten. Eine frische Installation anhand der Lockdatei wurde mit `npm ci --offline --ignore-scripts` geprüft; vier Testdateien enthalten insgesamt 22 gezielte Fälle. Die abschließenden Ergebnisprotokolle liegen neben dem erzeugten Repository.

Bekannte Grenzen: Die offizielle API ist ausstehend. Der bestehende Vite-Hinweis auf große JavaScript-Chunks bleibt. Bestehende Backend-Migrationstestgrenzen werden durch diese reine Planeränderung nicht neu bewertet. Empfehlungen zum automatischen Schließen einer Bahn bleiben ein separat dokumentierter Vorschlag.

## English

Prepared an independent planner source repository with owned vendor snapshots, licenses and provenance; no new functional host/core/backend changes. The UI follows the existing RaceHubOS shadcn theme, with standalone System/Light/Dark support and host-controlled appearance when embedded. The old experimental transport is isolated behind an injectable compatibility adapter. The finished-layout/sector handoff is explicitly a planner-owned proposal. The official manifest, download/update behavior, capabilities and sector contract await Anselme’s interface proposal.

## Français

Préparation d’un dépôt indépendant contenant les sources nécessaires, licences et provenance, sans nouvelle modification fonctionnelle du cœur ou du backend hôte. L’interface reprend le thème shadcn de RaceHubOS : Système/Clair/Sombre en mode autonome, apparence pilotée par l’hôte en mode intégré. L’ancien protocole expérimental est isolé dans un adaptateur remplaçable. Le format de transfert du circuit et des secteurs est une proposition du planificateur. Le manifeste officiel, le téléchargement, les mises à jour, les autorisations et le contrat des secteurs attendent la proposition d’Anselme.
