# Crossword Maker

Démo en ligne : https://vico-de.github.io/crossword-maker/

Éditeur de grilles de mots croisés avec gestion de sets, définitions et apparence personnalisable.

## Démarrer
1. Installer les dépendances : `npm install`
2. Lancer en mode développement : `npm run dev`
3. Vérifier la compilation : `npm run build`

## Utilisation rapide
- Au chargement, choisissez **Nouveau set de grille**, **Charger un set existant** ou **Charger un set local**. Vous pouvez aussi supprimer des sets stockés avant d'entrer dans l'éditeur.
- La barre d'état affiche le nom du set et de la grille courante.
- La direction de saisie (→ ou ↓) se change via le bouton flottant ou la touche Tab.
- Cliquez sur une case pour la sélectionner ; cliquez à nouveau ou à l'extérieur pour la désélectionner. Les cases noires peuvent être sélectionnées et retournées en blanches.

## Mots & définitions
- Les mots sont détectés automatiquement dès qu'au moins deux lettres adjacentes forment une chaîne horizontale ou verticale.
- Dans la colonne de droite, sélectionnez un mot pour saisir ou modifier sa définition. La saisie dans le panneau fige la saisie clavier dans la grille pour éviter les conflits.
- Les définitions restent liées au mot même si l’ancre ou la case noire disparaît ; seules les flèches et l’affichage en case noire sont nettoyés.
- Cliquez sur **Placer la définition** puis sur une case noire adjacente au début ou à la fin du mot pour ancrer l’affichage. Choisissez l’orientation de la flèche (droite/gauche/haut/bas ou coudée) en cliquant autour de la case noire. Chaque case noire accepte deux définitions séparées par une barre horizontale.

## Apparence
- Onglet **Apparence** : changez les couleurs (cases noires/blanches, flèches, lettres, définitions, bordures, barre séparatrice) et choisissez les polices pour la grille et les définitions. Un sélecteur “Charger une police…” permet d’ajouter un fichier de police local.
- La grille conserve l’épaisseur des bordures en affichage comme en export. Les flèches restent grises, sans fond, et collées à la case voisine.

## Gestion des grilles et sets
- **Sauvegarder** : enregistre la grille courante avec son nom, ses définitions et les apparences du set. Si le nom existe, choisir remplacer ou créer une copie.
- **Charger** : depuis la liste déroulante, ouvrez une grille sauvegardée ou supprimez-la.
- **Nouveau set de grille** : réinitialise l’espace de travail et vide le cache des sets précédents.
- **Exporter le set** : génère un fichier JSON compact contenant toutes les grilles, définitions et préférences d’apparence du set. Un nom est demandé et repris dans le fichier.
- **Charger un set** : depuis la liste déroulante de l’onglet Infos ou la boîte de dialogue d’accueil, choisir un set enregistré ou importer un set local (JSON).
- **Supprimer des sets** : dans la boîte de dialogue d’accueil, utilisez le bouton *Supprimer* sur un set listé.

## Export
- **Exporter la grille (PDF)** : produit un PDF haute résolution de la grille active.
- **Exporter le set (PDF)** : produit un PDF regroupant toutes les grilles du set.
- Les exports utilisent un rendu local haute définition sans appel CDN.

## Redimensionnement
- Les contrôles de redimensionnement se trouvent dans l’onglet **Infos**. L’application conserve le contenu existant et rogne seulement par le bas et la droite si la grille est réduite.

## Résolution de conflits Git
Voir la section “Resolving GitHub merge conflicts” ajoutée pour rappeler les étapes principales : récupérer `main`, fusionner ou rebaser, corriger les marqueurs `<<<<<<<`/`=======`/`>>>>>>>`, tester puis pousser.
