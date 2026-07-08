# Guide du code (pour agents & contributeurs)

Éditeur de **mots fléchés** (grilles de mots croisés à définitions fléchées).
100 % client, sans backend : tout est persisté dans `localStorage`.

## Stack

- **Svelte 5** (runes : `$state`, `$derived`, `$effect`, `$props`, `$bindable`) + **Vite**.
- **Tailwind CSS v4** + **daisyUI 5** pour l'UI (voir `.claude/skills/daisyui`).
- **theme-change** pour le thème clair/sombre (persisté).
- TypeScript. Le build est `vite build` (pas de `tsc` séparé).

Commandes : `npm run dev`, `npm run build`, `npm run serve`.

> ⚠️ Toute création/édition de fichier `.svelte` doit passer par le skill
> `svelte-code-writer` et être validée avec `npx @sveltejs/mcp svelte-autofixer <fichier>`.
> Toute UI utilise daisyUI (skill `daisyui`).

## Arborescence

```
src/
  main.ts                      Point d'entrée (mount de App), import de app.css
  app.css                      Tailwind + daisyUI (thèmes light/dark) + reset scroll
  App.svelte                   Composant racine : ÉTAT + logique d'édition + orchestration
  models/
    types.ts                   Types partagés (Cell, Grid, SavedGrid, placements, apparence…)
  lib/                         Logique pure, sans framework (testable/réutilisable)
    words.ts                   Extraction des mots, flèches/définitions, apparence défaut, signature
    serialization.ts           (dé)sérialisation de la base + import de l'ancien format « set »
    pdf.ts                     Génération de PDF vectoriel (texte éditable, polices standard)
    crossword.ts               Baril de ré-exports de words/serialization/pdf
    previewDraw.ts             Dessin canvas d'un aperçu de grille (partagé worker/fallback)
    previewWorker.ts           Web Worker : rend l'aperçu via OffscreenCanvas (hors thread principal)
    previewRenderer.ts         Façade renderPreview() : worker si dispo, sinon canvas principal
  components/
    toolbar/Toolbar.svelte     Barre du haut (navbar icônes) + modales Infos & Apparence
    grid/CrosswordGrid.svelte  Rendu de la grille (cellules, définitions, flèches SVG)
    grid/CrosswordGrid.css     Styles de la grille (le seul CSS custom restant)
    grid/GridPreviewAsync.svelte  Aperçu <img> asynchrone (via previewRenderer)
    sidebar/Sidebar.svelte     Panneau droit « Mots trouvés » + éditeur de définition / case noire
    dialog/GridsDialog.svelte  Modale « Grilles » (maître-détail, import/export, renommage de set)
```

## Modèle de données (`models/types.ts`)

- `Grid` : `cells` (matrice de `Cell`), `size`, `name`, `set` (tag), `separators`.
- `Cell` : `value`, `isBlack`, `x`, `y`.
- `SavedGrid` : entrée de la base = `{ id, name, timestamp, grid, definitions, pool }`.
- `WordDefinitionPlacement` : case noire + ancre + `wordDirection`/`anchorRole` d'un mot
  (la flèche est **déduite**, pas stockée).

### Les « sets » sont des tags

Chaque grille porte un tag `grid.set`.
Le regroupement par set se fait à l'affichage.
Les anciens fichiers/`localStorage` (`gridSets`) sont migrés au chargement en aplatissant les grilles avec leur tag (`App.loadDatabase`).

### Définitions : pool + placements (dans `App.svelte`)

- `defPool: Record<mot, texte>` — **texte** des définitions, indépendant de la grille.
  Éditer les lettres d'un mot ne détruit donc pas sa définition.
- `placements: Record<mot, WordDefinitionPlacement>` — où/comment poser la flèche.
  Purgé (via un `$effect`) si le mot ou l'ancrage disparaît ; `defPool` est conservé.
- La vue combinée `wordDefinitions` (dérivée) alimente le rendu, l'export et la signature.

## Persistance (localStorage)

- `gridsDb` : toute la base (`SavedGrid[]`).
- `appearance` : réglages d'apparence (utilisés surtout pour l'export PDF).
- `theme` : géré par theme-change.
- Enregistrement auto toutes les 60 s si `saveStatus === 'modified'`.

## Rendu de la grille & couleurs

- À l'écran, la grille suit le **thème** daisyUI (variables `--color-*`), via les variables
  CSS `--grid-*` posées par `App.gridVars`.
- L'**export PDF** (`lib/pdf.ts`) utilise les couleurs d'**apparence** (`AppearanceSettings`),
  toujours en clair. Un bouton « aperçu apparence » bascule l'écran sur ces couleurs.
- Les **flèches** sont déduites de (case noire, ancre, orientation) dans `words.buildPlacementsForGrid`
  puis tracées en SVG (écran) / vectoriel (PDF). Voir `ArrowPlacement` (`entry`, `bodyDir`, `slotIndex`).

## Où toucher quoi

- Logique d'édition (clavier, sélection, placement des définitions, séparateurs, sauvegarde,
  import/export, zoom) : **`App.svelte`** (état propriétaire + callbacks passés aux composants).
- Apparence par défaut / calcul des mots & flèches / signature : **`lib/words.ts`**.
- Format de fichier (base et ancien set) : **`lib/serialization.ts`**.
- Rendu/qualité du PDF : **`lib/pdf.ts`**.
- UI de la barre du haut et des modales Infos/Apparence : **`components/toolbar/Toolbar.svelte`**.
- Panneau droit : **`components/sidebar/Sidebar.svelte`**.
- Modale des grilles : **`components/dialog/GridsDialog.svelte`**.

Ces composants sont « présentationnels » : ils reçoivent des données + des callbacks ;
l'état vit dans `App.svelte`.
