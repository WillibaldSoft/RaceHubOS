# Screenshot publication verification — 5 November 2026

## Deutsch

39 echte Bildschirmaufnahmen dokumentieren alle neuen Planerfunktionen: je 13 mit deutscher, englischer und französischer Oberfläche und passenden Beschreibungen. Die Galerien enthalten ausschließlich synthetische Pläne und einen ausdrücklich leeren Demobestand. Bildgrößen (1600 × 1400 Pixel), SHA-256-Prüfsummen und alle Bildverweise wurden geprüft. Repräsentative Aufnahmen aller 13 Motive wurden visuell kontrolliert. Die Schienenoptik wurde für die Aufnahmen nicht verändert.

Die drei Screenshot-Szenarien bestehen ohne Browserfehler. Die Vor-Push-Regelprüfung und ESLint für die neuen Aufnahme-Skripte bestehen. Die vorhandene Produktcode-Prüfung auf `d790712` umfasst 37 Unit-Testdateien und 15 Browsertests gegen das fertige Linux-DEB; dieser Produktcode wurde für die Galerie nicht verändert.

Die zusätzlich vor der Veröffentlichung ausgeführten Backendtests wurden in separaten Quellkopien mit eigenem, zum Fork-Schema generiertem Prisma-Client durchgeführt. Alle Aufrufe gingen über das vorgeschriebene npm-Testskript mit isolierter `test.db`. Wegen des Teststarts in dieser Umgebung wurde das vorgesehene VM-Modulflag über eine temporäre Test-Shell ausdrücklich an Node übergeben; Produkt-Testskripte wurden nicht verändert.

**43 Backend-Testdateien bestehen. In `migrateSchema.test.js` bestehen drei Tests und scheitern zwei Tests beim Aufruf von Prisma `migrate deploy` mit `Schema engine error`. Die Backend-Gesamtsuite wird deshalb nicht als vollständig erfolgreich ausgewiesen.** Betroffen sind das Anlegen einer frischen Datenbank und der Fall einer bereits vollständigen Migrationshistorie. Diese Migrationsimplementierung, ihre Tests und das Datenbankschema sind gegenüber dem vorherigen Integrationsstand `d5859b5` unverändert. Die Ursache des Schemaengine-Fehlers wurde in dieser Dokumentationsarbeit nicht abschließend ermittelt.

Der versehentlich versionierte absolute lokale `node_modules`-Link wurde in `b164554` aus dem Git-Index genommen. Der lokale Link bleibt erhalten; zukünftige Klone installieren ihre eigenen Abhängigkeiten. Die laufende Installation und ihre persönlichen Daten wurden nicht aktualisiert.

## English

39 actual UI screenshots cover every new planner feature: 13 per language, with German, English and French interfaces and matching descriptions. Only synthetic plans and explicitly empty demo stock are used. Image dimensions (1600 × 1400 pixels), SHA-256 hashes and image links were checked. Representative captures of all 13 scenes were inspected visually. Rail artwork was not altered for the captures.

All three screenshot scenarios pass without browser errors. The pre-push rule check and ESLint for the new capture scripts pass. Existing product-code verification at `d790712` comprises 37 unit-test files and 15 browser tests against the finished Linux DEB; the gallery does not change that product code.

Additional backend checks used separate source copies and a dedicated Prisma client generated from the fork's schema. Every invocation used the prescribed npm test script and isolated `test.db`. A temporary test shell passed the intended Node VM-module flag explicitly in this execution environment; product test scripts were left unchanged.

**43 backend test files pass. In `migrateSchema.test.js`, three tests pass and two fail when Prisma `migrate deploy` reports `Schema engine error`. The full backend suite is therefore not reported as green.** The affected cases are creating a fresh database and an already-complete migration history. The migration implementation, its tests and the database schema are unchanged from the previous integration baseline `d5859b5`. The schema-engine failure was not fully diagnosed as part of this documentation work.

Commit `b164554` removes an accidentally tracked absolute local `node_modules` symlink from the Git index while retaining the local link. Fresh clones install their own dependencies. The running installation and personal data were not updated.

## Français

39 captures réelles présentent toutes les nouvelles fonctions : 13 par langue, avec interfaces allemande, anglaise et française et descriptions correspondantes. Les plans et le stock de démonstration explicitement vide sont synthétiques. Dimensions (1600 × 1400 pixels), empreintes SHA-256 et liens des images ont été vérifiés. Des captures représentatives des 13 scènes ont été contrôlées visuellement. L’apparence des rails n’a pas été modifiée pour les captures.

Les trois scénarios de capture passent sans erreur du navigateur. La vérification des règles avant push et ESLint sur les nouveaux scripts passent. La validation existante du code produit `d790712` comprend 37 fichiers de tests unitaires et 15 tests navigateur sur le DEB Linux final ; la galerie ne modifie pas ce code produit.

Les vérifications backend supplémentaires utilisent des copies séparées du code et un client Prisma propre, généré depuis le schéma du fork. Chaque lancement passe par le script npm prescrit avec une base `test.db` isolée. Un shell de test temporaire transmet explicitement à Node l’option VM prévue dans cet environnement ; les scripts de test du produit restent inchangés.

**43 fichiers de tests backend passent. Dans `migrateSchema.test.js`, trois tests passent et deux échouent lorsque Prisma `migrate deploy` renvoie `Schema engine error`. La suite backend complète n’est donc pas présentée comme réussie.** Les cas concernés sont la création d’une base neuve et un historique de migrations déjà complet. L’implémentation, ses tests et le schéma sont inchangés depuis la référence d’intégration `d5859b5`. La cause de l’erreur du moteur n’a pas été entièrement déterminée dans ce travail de documentation.

Le commit `b164554` retire de l’index Git un lien `node_modules` local absolu versionné par erreur, en conservant le lien local. Les nouveaux clones installent leurs propres dépendances. L’installation en cours et les données personnelles n’ont pas été mises à jour.

## GitHub target and reproducibility

- Repository: [WillibaldSoft/RaceHubOS](https://github.com/WillibaldSoft/RaceHubOS).
- Target: [integration/carrera-1.25.2](https://github.com/WillibaldSoft/RaceHubOS/tree/integration/carrera-1.25.2), a forward update from `d5859b5`; no force push and no merge into upstream `main`.
- The existing functional commits (`1a8a3cb`, `b8e539c`, `8d4dd7b`, `d790712`) are included in the integration history.
- [Gallery index and capture instructions](TRACK-PLANNER-GALLERY.md).
- SHA-256 manifests: [DE](screenshots/track-planner/de/manifest.json), [EN](screenshots/track-planner/en/manifest.json), [FR](screenshots/track-planner/fr/manifest.json).

No new installer build, release, host installation or hardware test is claimed by this screenshot publication.
