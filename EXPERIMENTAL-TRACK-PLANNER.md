# Experimental track planner / Streckenplaner / Planificateur

**Work in progress · In Entwicklung · En développement**

[Download the experimental packages and screenshot gallery](https://github.com/WillibaldSoft/RaceHubOS/releases/tag/track-planner-v1.0.0-experimental.1)

This branch is a distribution index only. It does not replace fork-main or upstream-main and does not contain the full local prototype. The release attaches a reviewed source snapshot, standalone Linux/Windows packages, the optional add-on and a multilingual screenshot gallery. No merge has been performed.

## Deutsch

Der Streckenplaner ist separat installierbar und aktivierbar oder eigenständig auf einem anderen Rechner nutzbar. Unterstützt werden grafische Planung, Schienen-/Weichenkatalog, Boxengasse, Randstreifen, Teilebestand, Materiallisten, Raumplanung, Druck und Dateiaustausch.

Die Rennanzeige zeigt die Geschwindigkeit der letzten abgeschlossenen Runde in tatsächlichen oder maßstäblichen km/h. Maßstab pro Fahrzeug (1:32/1:24), globale Vorgabe bei fehlender Angabe; auch mit manueller Streckenlänge ohne Planer nutzbar.

**Kompatibilität:** Das Zusatzpaket benötigt Host-API 1. Unverändertes main enthält diese noch nicht. Den experimentellen Host aus `RaceHubOS-TrackPlanner-Experimental-Source.zip` in einem getrennten Checkout mit separater Datenbank erproben. Die eigenständigen Ausgaben benötigen kein RaceHubOS. Die automatisch erzeugten GitHub-Source-Archive enthalten nur diesen Indexzweig; den ausdrücklich benannten Source-ZIP verwenden.

**Bilder:** `RaceHubOS-TrackPlanner-Screenshots-DE-EN-FR.zip` enthält 45 echte Aufnahmen – 15 Funktionsansichten in Deutsch, Englisch und Französisch. Nach dem Entpacken `index.html` öffnen. Alle Daten sind synthetisch. Die Galerie zeigt den tatsächlichen Entwicklungsstand, einschließlich noch nicht abschließend lokalisierter Katalogbezeichnungen.

**Offen:** nativer Windows-Test, echte CU-/Bluetooth-Tests und Architekturabstimmung mit Upstream. Keine Zusage produktiver Einsatzreife.

## English

The release provides an optional installable/enabled-on-demand add-on and a standalone planner for another computer. Last-lap speed supports actual or scale km/h, per-car scale and a global fallback; manual track length works without the planner. Unchanged main lacks host API 1. Download the explicitly named experimental source ZIP for the host support and evaluate it separately from a race installation. The GitHub-generated source archives describe only this distribution branch. Screenshot gallery: 15 real feature views in DE/EN/FR, synthetic data, work in progress.

## Français

Module installable et activable à la demande, et planificateur autonome pour un autre ordinateur. La vitesse du dernier tour peut être réelle ou à l’échelle, selon la voiture et une valeur globale par défaut. Une longueur saisie manuellement suffit sans planificateur. Main inchangé ne contient pas l’API hôte 1 : utiliser l’archive source expérimentale explicitement nommée dans la release, dans un environnement séparé. Galerie : 15 vues réelles en DE/EN/FR avec données synthétiques, développement en cours.

[Architecture discussion upstream](https://github.com/AnselmeSDR/RaceHubOS/discussions/9)
