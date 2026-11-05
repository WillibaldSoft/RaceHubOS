# Planificateur de circuit – nouvelles fonctions en images

[Deutsch](TRACK-PLANNER-GALLERY.de.md) · [English](TRACK-PLANNER-GALLERY.en.md) · Français

Captures réelles du planificateur autonome réalisées le 5 novembre 2026, avec interface française et données de démonstration exclusivement synthétiques. Toutes les images mesurent 1600 × 1400 pixels. L’apparence des rails n’a pas été modifiée pour les captures.

Utilisation et limites techniques : [outils de planification](TRACK-PLANNER-TOOLS.md) (allemand). Comparaison des sources : [rapport](TRACK-PLANNER-REVIEW-20261105.md) (allemand). Reproduction et vérification : [index des galeries](TRACK-PLANNER-GALLERY.md).

## 01. Créer le groupe de départ

Dans un plan vide, le bouton crée un groupe départ/arrivée avec une Control Unit et deux postes de ravitaillement parallèles. Il ne remplace pas un circuit existant. Les modifications du plan peuvent être annulées.

![Créer le groupe de départ](screenshots/track-planner/fr/01-start-setup.png)

## 02. Départ/arrivée, CU et deux postes

Le groupe inséré contient six modules principaux et deux positions FUEL. Il peut être déplacé, tourné ou dissocié. Ses extrémités libres permettent de poursuivre la construction du circuit.

![Départ/arrivée, CU et deux postes](screenshots/track-planner/fr/02-start-cu-two-bays.png)

## 03. Libellés lisibles sur une CU tournée

Les libellés de la CU restent lisibles après une rotation de 180°. Le boîtier, les capteurs et les rails suivent la rotation, tout en conservant l’apparence existante des rails.

![Libellés lisibles sur une CU tournée](screenshots/track-planner/fr/03-readable-rotated-cu.png)

## 04. Placer une CU sur une droite existante

La droite standard de 345 mm sélectionnée est remplacée par une Control Unit avec départ/arrivée. Les raccords et les rails voisins restent en place ; l’encombrement supplémentaire du boîtier est affiché.

![Placer une CU sur une droite existante](screenshots/track-planner/fr/04-cu-on-existing-straight.png)

## 05. Repère anti-collision facultatif

L’indication de montage du circuit anti-collision est enregistrée sur l’aiguillage sélectionné. Une option distincte commande l’affichage des repères AKS sans supprimer cette indication. Le repère ne prouve pas le fonctionnement électrique réel.

![Repère anti-collision facultatif](screenshots/track-planner/fr/05-optional-aks-marker.png)

## 06. Assistant des stands : un poste de l’autre côté

L’aperçu présente le raccord, le nombre de postes et le côté avant validation. L’autre côté utilise des pièces non réfléchies avec circulation inversée dans les stands, à prendre en compte lors du montage réel.

![Assistant des stands : un poste de l’autre côté](screenshots/track-planner/fr/06-pit-assistant-single-other-side.png)

## 07. Assistant des stands : remplacer six modules

L’aperçu prévoit deux postes à la place de six droites de 345 mm alignées au même niveau. Les groupes protégés, accessoires et bordures ne sont pas supprimés automatiquement. Seule la validation modifie le plan.

![Assistant des stands : remplacer six modules](screenshots/track-planner/fr/07-pit-assistant-replace-six.png)

## 08. Aide au raccordement et à l’accrochage

Sélectionner une extrémité libre comme point d’insertion. Le guide indique ici un écart de 25,0 mm et la rotation nécessaire. Le vert signale un sens et un niveau compatibles ; l’accrochage exige aussi une proximité suffisante.

![Aide au raccordement et à l’accrochage](screenshots/track-planner/fr/08-connection-gap-direction.png)

## 09. Enregistrer et transférer des modèles

Le groupe de départ sélectionné est enregistré comme modèle nommé dans le navigateur. L’insertion au raccord choisi et l’export/import JSON permettent sa réutilisation. Les données Fuel/AKS et niveaux relatifs sont conservés, sans synchronisation automatique.

![Enregistrer et transférer des modèles](screenshots/track-planner/fr/09-assembly-templates.png)

## 10. Menu contextuel sur la pièce

Un clic droit propose rotation, remplacement par la pièce du catalogue choisie, dissociation, indication AKS et suppression. Les actions disponibles et leur portée dépendent de la sélection et des groupes.

![Menu contextuel sur la pièce](screenshots/track-planner/fr/10-context-menu.png)

## 11. Vérification du montage et pièces manquantes

Ce circuit de démonstration volontairement incorrect contient un chevauchement et un raccord libre des stands. Le stock de démonstration enregistré est explicitement vide ; les quantités manquantes sont calculées à partir de ce stock. Aucune donnée personnelle n’est affichée.

![Vérification du montage et pièces manquantes](screenshots/track-planner/fr/11-build-check-and-missing-parts.png)

## 12. Marquer les chevauchements sur le plan

La sélection d’un résultat marque en rouge les rails principaux concernés pour localiser et corriger le problème. Les repères devenus obsolètes disparaissent après modification du plan.

![Marquer les chevauchements sur le plan](screenshots/track-planner/fr/12-highlighted-overlap.png)

## 13. Localiser un raccord libre des stands

La vérification identifie aussi les extrémités de slot libres des éléments natifs des stands. Le cercle rouge montre le raccord laissé ouvert après suppression d’une entrée. Ce contrôle complète celui du tracé principal et ne remplace pas une vérification électrique.

![Localiser un raccord libre des stands](screenshots/track-planner/fr/13-open-pit-connection.png)
