<script lang="ts">
    import { untrack } from 'svelte';
    import CrosswordGrid from './components/grid/CrosswordGrid.svelte';
    import GridsDialog from './components/dialog/GridsDialog.svelte';
    import Sidebar from './components/sidebar/Sidebar.svelte';
    import Toolbar from './components/toolbar/Toolbar.svelte';
    import type { AppearanceSettings, Cell, Grid, GridSet, SavedGrid, WordDefinitionData, WordDefinitionPlacement } from './models/types';
    import {
        DEFAULT_APPEARANCE,
        buildEmptyGrid,
        buildPlacementsForGrid,
        deserializeDatabase,
        downloadPdf,
        extractWordPositions,
        gridSignature,
        renderGridPdfPage,
        serializeDatabase
    } from './lib/crossword';

    type Placement = WordDefinitionPlacement;
    type Candidate = { x: number; y: number; anchor: { x: number; y: number }; anchorRole: 'start' | 'end'; wordDirection: 'horizontal' | 'vertical' };

    // --- État de la grille courante ---------------------------------------
    let currentGrid = $state<Grid>(buildEmptyGrid(15, 15));
    let currentGridId = $state<string | null>(null);
    let selectedCell = $state<{ x: number; y: number } | null>(null);
    let selectedDirection = $state<'horizontal' | 'vertical'>('horizontal');

    const setDirection = (dir: 'horizontal' | 'vertical') => (selectedDirection = dir);
    const loadGrid = (grid: Grid) => (currentGrid = grid);

    const updateCell = (x: number, y: number, changes: Partial<Cell>) => {
        const cell = currentGrid.cells[y]?.[x];
        if (!cell) return;
        currentGrid.cells[y][x] = { ...cell, ...changes };
    };

    const resizeGrid = (width: number, height: number) => {
        if (width <= 0 || height <= 0) return;
        const existing = currentGrid.cells;
        const newCells = buildEmptyGrid(width, height).cells;
        const maxY = Math.min(height, existing.length);
        const maxX = Math.min(width, existing[0].length);
        for (let y = 0; y < maxY; y++) {
            for (let x = 0; x < maxX; x++) {
                newCells[y][x] = { ...existing[y][x], x, y };
            }
        }
        if (selectedCell && (selectedCell.x >= width || selectedCell.y >= height)) selectedCell = null;
        currentGrid = { ...currentGrid, cells: newCells, size: { width, height } };
    };

    // --- État de l'éditeur -------------------------------------------------
    let isToolbarInputActive = $state(false);
    let selectedWord = $state<string | null>(null);
    let selectedBlackCell = $state<{ x: number; y: number } | null>(null);
    // Pool de définitions (texte) indépendant des mots : éditer les lettres
    // d'un mot ne détruit pas sa définition.
    let defPool = $state<Record<string, string>>({});
    // Placement (case noire + ancre) par mot ; purgé si le mot/ancrage disparaît.
    let placements = $state<Record<string, Placement>>({});
    let zoom = $state(1);
    let showSidebar = $state(true);
    let showGridsDialog = $state(false);
    let dialogSelectedId = $state<string | null>(null);
    let dialogOpenSet = $state<string | null>(null);
    let wordSearch = $state('');
    let editMode = $state<'normal' | 'separator'>('normal');
    let sepFirst = $state<{ x: number; y: number } | null>(null);
    let previewAppearance = $state(false);
    let previewWithoutLetters = $state(false);

    let gridAreaEl = $state<HTMLElement | null>(null);
    let gridContainerEl = $state<HTMLElement | null>(null);
    let sidebarEl = $state<HTMLElement | null>(null);
    let dbFileInput = $state<HTMLInputElement | null>(null);

    // Apparence : utilisée uniquement pour l'export PDF (toujours en clair).
    const loadAppearance = (): AppearanceSettings => {
        const raw = localStorage.getItem('appearance');
        if (raw) {
            try {
                return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) };
            } catch {
                /* ignore */
            }
        }
        const setsRaw = localStorage.getItem('gridSets');
        if (setsRaw) {
            try {
                const sets = JSON.parse(setsRaw) as GridSet[];
                if (sets[0]?.appearance) return { ...DEFAULT_APPEARANCE, ...sets[0].appearance };
            } catch {
                /* ignore */
            }
        }
        return DEFAULT_APPEARANCE;
    };

    // Base de toutes les grilles. Migre les anciens sets vers des tags.
    const loadDatabase = (): SavedGrid[] => {
        const raw = localStorage.getItem('gridsDb');
        if (raw) {
            try {
                return (JSON.parse(raw) as SavedGrid[]).map((g) => ({ ...g, grid: { ...g.grid, set: g.grid.set || '' } }));
            } catch {
                /* ignore */
            }
        }
        const setsRaw = localStorage.getItem('gridSets');
        if (setsRaw) {
            try {
                const sets = JSON.parse(setsRaw) as GridSet[];
                return sets.flatMap((s) => (s.grids || []).map((g) => ({ ...g, grid: { ...g.grid, set: s.name || '' } })));
            } catch {
                /* ignore */
            }
        }
        const legacy = localStorage.getItem('savedGrids');
        if (legacy) {
            try {
                return (JSON.parse(legacy) as SavedGrid[]).map((g) => ({ ...g, grid: { ...g.grid, set: '' } }));
            } catch {
                /* ignore */
            }
        }
        return [];
    };

    let appearance = $state<AppearanceSettings>(loadAppearance());
    let grids = $state<SavedGrid[]>(loadDatabase());

    // Au démarrage, ouvre la dernière grille enregistrée (la plus récente).
    const lastSaved = grids.reduce<SavedGrid | null>(
        (latest, g) => (!latest || (g.timestamp || 0) > (latest.timestamp || 0) ? g : latest),
        null
    );
    if (lastSaved) {
        currentGrid = { ...lastSaved.grid, cells: lastSaved.grid.cells.map((row) => row.map((c) => ({ ...c }))) };
        currentGridId = lastSaved.id;
        const defs = lastSaved.definitions || {};
        placements = Object.fromEntries(
            Object.entries(defs).filter(([, d]) => d.placement).map(([w, d]) => [w, d.placement as Placement])
        );
        defPool = lastSaved.pool
            ? { ...lastSaved.pool }
            : Object.fromEntries(Object.entries(defs).map(([w, d]) => [w, d.definition]));
    }

    // --- Valeurs dérivées --------------------------------------------------
    const wordPositions = $derived(extractWordPositions(currentGrid.cells));
    const currentWords = $derived(new Set(wordPositions.map((p) => p.word)));

    // Vue combinée (texte + placement) pour le rendu, l'export et la signature.
    const wordDefinitions = $derived.by(() => {
        const result: Record<string, WordDefinitionData> = {};
        for (const word of currentWords) {
            const placement = placements[word];
            const definition = defPool[word] ?? '';
            if (placement || definition) result[word] = { definition, placement };
        }
        return result;
    });

    const renderData = $derived(buildPlacementsForGrid(currentGrid, wordDefinitions));
    const wordsList = $derived([...currentWords].sort());
    const filteredWordsList = $derived(
        wordSearch.trim()
            ? wordsList.filter((w) => w.toLowerCase().includes(wordSearch.trim().toLowerCase()))
            : wordsList
    );
    // Mots présents plus d'une fois dans la grille (mis en évidence en rouge).
    const duplicateWords = $derived.by(() => {
        const counts = new Map<string, number>();
        for (const pos of wordPositions) counts.set(pos.word, (counts.get(pos.word) || 0) + 1);
        return new Set([...counts].filter(([, c]) => c > 1).map(([w]) => w));
    });
    const duplicateCells = $derived.by(() => {
        const s = new Set<string>();
        for (const pos of wordPositions) if (duplicateWords.has(pos.word)) for (const c of pos.cells) s.add(`${c.x}-${c.y}`);
        return s;
    });
    const separatorSet = $derived(new Set(currentGrid.separators || []));
    // Dimensions réelles de la grille (cellule 40px + 1px de bordure) pour
    // réserver la place à l'échelle du zoom et pouvoir tout faire défiler.
    const boardW = $derived(currentGrid.size.width * 40 + 1);
    const boardH = $derived(currentGrid.size.height * 40 + 1);

    // Toutes les occurrences du mot sélectionné (surligne les 2 pour un doublon).
    const highlightedCells = $derived.by(() => {
        const s = new Set<string>();
        if (!selectedWord) return s;
        for (const pos of wordPositions) if (pos.word === selectedWord) for (const c of pos.cells) s.add(`${c.x}-${c.y}`);
        return s;
    });

    // Les (jusqu'à 6) cases noires où l'on peut poser la définition du mot choisi.
    const candidateInfos: Candidate[] = $derived.by(() => {
        // Pas de placement pour les mots en double (occurrence ambiguë).
        if (!selectedWord || duplicateWords.has(selectedWord)) return [];
        const pos = wordPositions.find((p) => p.word === selectedWord);
        if (!pos) return [];
        const rows = currentGrid.cells.length;
        const cols = currentGrid.cells[0]?.length ?? 0;
        const out: Candidate[] = [];
        const add = (bx: number, by: number, anchor: { x: number; y: number }, anchorRole: 'start' | 'end') => {
            if (bx < 0 || by < 0 || by >= rows || bx >= cols) return;
            if (!currentGrid.cells[by][bx].isBlack) return;
            out.push({ x: bx, y: by, anchor, anchorRole, wordDirection: pos.direction });
        };
        const { start: s, end: e } = pos;
        if (pos.direction === 'horizontal') {
            add(s.x - 1, s.y, s, 'start');
            add(s.x, s.y - 1, s, 'start');
            add(s.x, s.y + 1, s, 'start');
            add(e.x + 1, e.y, e, 'end');
            add(e.x, e.y - 1, e, 'end');
            add(e.x, e.y + 1, e, 'end');
        } else {
            add(s.x, s.y - 1, s, 'start');
            add(s.x - 1, s.y, s, 'start');
            add(s.x + 1, s.y, s, 'start');
            add(e.x, e.y + 1, e, 'end');
            add(e.x - 1, e.y, e, 'end');
            add(e.x + 1, e.y, e, 'end');
        }
        return out;
    });
    // On ne surligne les cases candidates que si le mot n'a pas déjà de placement.
    const candidateCells = $derived(
        selectedWord && !placements[selectedWord] ? new Set(candidateInfos.map((c) => `${c.x}-${c.y}`)) : new Set<string>()
    );

    const selectedBlackCellDefinitions = $derived.by(() => {
        if (!selectedBlackCell) return [] as { word: string; placement: Placement; definition: string }[];
        // Même ordre géométrique qu'à l'affichage (haut -> côté -> bas).
        const rank = (p: Placement) => (p.anchor.y < p.y ? 0 : p.anchor.y > p.y ? 2 : 1);
        return Object.entries(placements)
            .filter(([, p]) => p.x === selectedBlackCell!.x && p.y === selectedBlackCell!.y)
            .sort(([, a], [, b]) => rank(a) - rank(b))
            .map(([word, placement]) => ({ word, placement, definition: defPool[word] ?? '' }));
    });

    // Le rendu à l'écran suit le thème daisyUI (clair/sombre) ; l'export garde
    // les couleurs d'apparence. On ne reprend de l'apparence que les polices.
    const gridVars = $derived(
        (previewAppearance
            ? [
                  `--grid-black-color: ${appearance.blackCellColor}`,
                  `--grid-cell-color: ${appearance.cellBackgroundColor}`,
                  `--grid-arrow-color: ${appearance.borderColor}`,
                  `--grid-letter-color: ${appearance.letterColor}`,
                  `--grid-definition-color: ${appearance.definitionTextColor}`,
                  `--grid-border-color: ${appearance.borderColor}`,
                  `--definition-separator-color: ${appearance.separatorColor}`
              ]
            : [
                  '--grid-black-color: var(--color-neutral)',
                  '--grid-cell-color: var(--color-base-100)',
                  '--grid-arrow-color: color-mix(in oklab, var(--color-base-content) 28%, var(--color-base-100))',
                  '--grid-letter-color: color-mix(in oklab, var(--color-base-content) 78%, var(--color-base-100))',
                  '--grid-definition-color: var(--color-neutral-content)',
                  '--grid-border-color: color-mix(in oklab, var(--color-base-content) 28%, var(--color-base-100))',
                  '--definition-separator-color: var(--color-base-100)'
              ]
        )
            .concat([
                `--definition-separator-width: ${appearance.separatorWidth}px`,
                `--grid-font-family: ${appearance.gridFont}`,
                `--grid-font-weight: ${appearance.gridFontWeight}`,
                `--grid-font-style: ${appearance.gridFontStyle}`,
                `--definition-font-family: ${appearance.definitionFont}`,
                `--definition-font-weight: ${appearance.definitionFontWeight}`,
                `--definition-font-style: ${appearance.definitionFontStyle}`,
                `--ui-font-family: ${appearance.gridFont}`
            ])
            .join(';')
    );

    // --- Suivi des modifications non enregistrées --------------------------
    const sigOf = (grid: Grid, defs: Record<string, WordDefinitionData>, pool: Record<string, string>) =>
        gridSignature(grid, defs) + '␞' + JSON.stringify(Object.entries(pool).sort());
    const currentSignature = $derived(sigOf(currentGrid, wordDefinitions, defPool));
    const gridHasContent = $derived(currentGrid.cells.some((row) => row.some((cell) => cell.isBlack || cell.value)));
    const isSavedGrid = $derived(grids.some((g) => sigOf(g.grid, g.definitions || {}, g.pool || {}) === currentSignature));
    const saveStatus: 'empty' | 'saved' | 'modified' = $derived(
        !gridHasContent ? 'empty' : isSavedGrid ? 'saved' : 'modified'
    );

    // Grilles regroupées par set (les sans-set en dernier).
    const gridsBySet = $derived.by(() => {
        const map = new Map<string, SavedGrid[]>();
        for (const g of grids) {
            const key = (g.grid.set || '').trim() || 'Sans set';
            (map.get(key) ?? map.set(key, []).get(key)!).push(g);
        }
        return [...map.entries()]
            .sort((a, b) => (a[0] === 'Sans set' ? 1 : b[0] === 'Sans set' ? -1 : a[0].localeCompare(b[0])))
            .map(([set, list]) => ({ set, list: [...list].sort((a, b) => a.name.localeCompare(b.name)) }));
    });
    const dialogSelectedGrid = $derived(grids.find((g) => g.id === dialogSelectedId) || null);

    // --- Effets ------------------------------------------------------------
    $effect(() => {
        localStorage.setItem('gridsDb', JSON.stringify(grids));
    });

    $effect(() => {
        localStorage.setItem('appearance', JSON.stringify(appearance));
    });

    // Recharge les polices personnalisées persistées lors d'une nouvelle session.
    $effect(() => {
        const loadPersistedFont = async (family: string, data?: string, weight?: string, style?: string) => {
            if (!data) return;
            const name = family.replace(/^['"]|['"]$/g, '');
            if (document.fonts.check(`12px "${name}"`)) return;
            try {
                const descriptor: FontFaceDescriptors = {};
                if (weight && weight !== 'normal') descriptor.weight = weight;
                if (style && style !== 'normal') descriptor.style = style;
                const face = new FontFace(name, `url(${data})`, descriptor);
                await face.load();
                document.fonts.add(face);
            } catch (error) {
                console.error('Impossible de recharger la police personnalisée', error);
            }
        };
        void loadPersistedFont(appearance.gridFont, appearance.gridFontData, appearance.gridFontWeight, appearance.gridFontStyle);
        void loadPersistedFont(appearance.definitionFont, appearance.definitionFontData, appearance.definitionFontWeight, appearance.definitionFontStyle);
    });

    // Purge les placements dont le mot ou l'ancrage a disparu (le pool est conservé).
    $effect(() => {
        const positions = wordPositions;
        void currentGrid;
        untrack(() => {
            let changed = false;
            const next = { ...placements };
            for (const [word, p] of Object.entries(placements)) {
                const pos = positions.find((x) => x.word === word);
                if (!pos) {
                    delete next[word];
                    changed = true;
                    continue;
                }
                const cell = currentGrid.cells[p.y]?.[p.x];
                const anchorPt = p.anchorRole === 'start' ? pos.start : pos.end;
                const adjacent = Math.abs(p.x - anchorPt.x) + Math.abs(p.y - anchorPt.y) === 1;
                const ok = cell?.isBlack && adjacent && p.anchor.x === anchorPt.x && p.anchor.y === anchorPt.y;
                if (!ok) {
                    delete next[word];
                    changed = true;
                }
            }
            if (changed) placements = next;
        });
    });

    // Zoom via Ctrl/Cmd + molette sur la zone de grille.
    $effect(() => {
        const gridArea = gridAreaEl;
        if (!gridArea) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                zoom = Math.max(0.5, Math.min(2, zoom + delta));
            }
        };
        gridArea.addEventListener('wheel', handleWheel, { passive: false });
        return () => gridArea.removeEventListener('wheel', handleWheel);
    });

    // Enregistrement automatique toutes les 60 s si la grille a changé.
    $effect(() => {
        const id = setInterval(() => {
            if (saveStatus === 'modified') saveCurrentGrid();
        }, 60000);
        return () => clearInterval(id);
    });

    // --- Grilles & base de données -----------------------------------------
    const resetEditingState = () => {
        const size = currentGrid.size;
        defPool = {};
        placements = {};
        selectedWord = null;
        selectedBlackCell = null;
        loadGrid(buildEmptyGrid(size.width, size.height));
    };

    const applyAppearanceChanges = (changes: Partial<AppearanceSettings>) => {
        appearance = { ...appearance, ...changes };
    };

    const setGridName = (name: string) => {
        currentGrid.name = name;
    };

    const setGridSet = (set: string) => {
        currentGrid.set = set;
    };

    const saveCurrentGrid = () => {
        const name = (currentGrid.name || '').trim() || 'Grille sans nom';
        if (currentGrid.name !== name) currentGrid.name = name;
        const id = currentGridId || Date.now().toString();
        const entry: SavedGrid = {
            id,
            name,
            timestamp: Date.now(),
            grid: { ...currentGrid, name },
            definitions: wordDefinitions,
            pool: { ...defPool }
        };
        const index = grids.findIndex((g) => g.id === id);
        grids = index >= 0 ? grids.map((g, i) => (i === index ? entry : g)) : [...grids, entry];
        currentGridId = id;
    };

    const loadSavedGrid = (saved: SavedGrid) => {
        if (saveStatus === 'modified') saveCurrentGrid();
        selectedWord = null;
        selectedBlackCell = null;
        const defs = saved.definitions || {};
        placements = Object.fromEntries(
            Object.entries(defs).filter(([, d]) => d.placement).map(([w, d]) => [w, d.placement as Placement])
        );
        defPool = saved.pool ? { ...saved.pool } : Object.fromEntries(Object.entries(defs).map(([w, d]) => [w, d.definition]));
        currentGridId = saved.id;
        loadGrid({ ...saved.grid, cells: saved.grid.cells.map((row) => row.map((c) => ({ ...c }))) });
        showGridsDialog = false;
    };

    const newGrid = () => {
        if (saveStatus === 'modified') saveCurrentGrid();
        currentGridId = null;
        resetEditingState();
    };

    const openGrids = () => {
        dialogSelectedId = currentGridId ?? grids[0]?.id ?? null;
        const sel = grids.find((g) => g.id === dialogSelectedId);
        dialogOpenSet = sel ? (sel.grid.set || '').trim() || 'Sans set' : null;
        showGridsDialog = true;
    };

    const renameSet = (key: string) => {
        const next = window.prompt('Renommer le set (vide = « Sans set »)', key === 'Sans set' ? '' : key);
        if (next === null) return;
        const tag = next.trim();
        grids = grids.map((g) => (setKeyOf(g) === key ? { ...g, grid: { ...g.grid, set: tag } } : g));
        if (((currentGrid.set || '').trim() || 'Sans set') === key) currentGrid.set = tag;
        if (dialogOpenSet === key) dialogOpenSet = tag || 'Sans set';
    };

    const deleteGrid = (id: string) => {
        if (!window.confirm('Supprimer cette grille ?')) return;
        const idx = grids.findIndex((g) => g.id === id);
        grids = grids.filter((g) => g.id !== id);
        if (currentGridId === id) currentGridId = null;
        if (dialogSelectedId === id) dialogSelectedId = grids[Math.max(0, idx - 1)]?.id ?? grids[0]?.id ?? null;
    };

    const slug = (s: string) => s.replace(/\s+/g, '_').toLowerCase() || 'grilles';

    const downloadJson = (content: string, filename: string) => {
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    const setKeyOf = (g: SavedGrid) => (g.grid.set || '').trim() || 'Sans set';
    const gridsInSet = (key: string) => grids.filter((g) => setKeyOf(g) === key);

    const handleExportDatabase = () => downloadJson(serializeDatabase(grids), 'grilles.json');

    const exportGridJson = () => {
        if (dialogSelectedGrid) downloadJson(serializeDatabase([dialogSelectedGrid]), `${slug(dialogSelectedGrid.name)}.json`);
    };
    const exportGridPdf = () => {
        if (!dialogSelectedGrid) return;
        const pages = [
            renderGridPdfPage(dialogSelectedGrid.grid, dialogSelectedGrid.definitions || {}, appearance, { includeLetters: false }),
            renderGridPdfPage(dialogSelectedGrid.grid, dialogSelectedGrid.definitions || {}, appearance, { includeLetters: true })
        ];
        downloadPdf(pages, `${slug(dialogSelectedGrid.name)}.pdf`);
    };
    const exportSetJson = () => {
        if (!dialogSelectedGrid) return;
        const key = setKeyOf(dialogSelectedGrid);
        downloadJson(serializeDatabase(gridsInSet(key)), `${slug(key)}.json`);
    };
    const exportSetPdf = () => {
        if (!dialogSelectedGrid) return;
        const key = setKeyOf(dialogSelectedGrid);
        const pages: ReturnType<typeof renderGridPdfPage>[] = [];
        gridsInSet(key).forEach((entry) => {
            pages.push(renderGridPdfPage(entry.grid, entry.definitions || {}, appearance, { includeLetters: false }));
            pages.push(renderGridPdfPage(entry.grid, entry.definitions || {}, appearance, { includeLetters: true }));
        });
        downloadPdf(pages, `${slug(key)}.pdf`);
    };

    const handleImportDatabase = (content: string) => {
        try {
            const imported = deserializeDatabase(content);
            if (imported.length === 0) {
                window.alert('Aucune grille trouvée dans ce fichier.');
                return;
            }
            const existingIds = new Set(grids.map((g) => g.id));
            const merged = imported.map((g) =>
                existingIds.has(g.id) ? { ...g, id: `${g.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}` } : g
            );
            grids = [...grids, ...merged];
            dialogSelectedId = merged[0]?.id ?? dialogSelectedId;
            showGridsDialog = true;
        } catch (error) {
            console.error('Import base', error);
            window.alert('Impossible de lire ce fichier.');
        }
    };

    const readDbFile = (file?: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => handleImportDatabase(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => window.alert('Impossible de lire ce fichier.');
        reader.readAsText(file);
    };

    // --- Édition de la grille ---------------------------------------------
    const handleCellUpdate = (x: number, y: number, changes: Partial<Cell>) => {
        const currentCell = currentGrid.cells[y]?.[x];
        if (!currentCell) return;
        const newChanges = { ...changes };
        if ('isBlack' in changes) {
            if (changes.isBlack) newChanges.value = '';
        } else if ('value' in changes && currentCell.isBlack) {
            return;
        }
        updateCell(x, y, newChanges);
    };

    const moveSelection = (deltaX: number, deltaY: number, allowBlackSelection = false): boolean => {
        if (!selectedCell) return false;
        const { x, y } = selectedCell;
        const { cells } = currentGrid;
        const targetX = x + deltaX;
        const targetY = y + deltaY;
        if (targetX < 0 || targetY < 0 || targetY >= cells.length || targetX >= cells[0].length) return false;
        if (!allowBlackSelection && cells[targetY][targetX].isBlack) return false;
        selectedCell = { x: targetX, y: targetY };
        return true;
    };

    const moveToPreviousCell = () => (selectedDirection === 'horizontal' ? moveSelection(-1, 0) : moveSelection(0, -1));
    const moveToNextCell = () => (selectedDirection === 'horizontal' ? moveSelection(1, 0) : moveSelection(0, 1));

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && selectedCell) {
            selectedCell = null;
            return;
        }
        if (isToolbarInputActive || showGridsDialog || editMode !== 'normal') return;
        if (!selectedCell) return;
        const { x, y } = selectedCell;
        const { cells } = currentGrid;

        if (event.key === ' ') {
            event.preventDefault();
            handleCellUpdate(x, y, { isBlack: !cells[y][x].isBlack, value: '' });
            moveToNextCell();
            return;
        }

        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            const currentCell = cells[y][x];
            if (!currentCell.isBlack) {
                if (currentCell.value) {
                    handleCellUpdate(x, y, { value: '' });
                    if (event.key === 'Backspace') moveToPreviousCell();
                } else if (event.key === 'Backspace') {
                    if (moveToPreviousCell() && selectedCell) {
                        handleCellUpdate(selectedCell.x, selectedCell.y, { value: '' });
                    }
                }
            }
            return;
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            toggleDirection();
            return;
        }

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                moveSelection(-1, 0, true);
                break;
            case 'ArrowRight':
                event.preventDefault();
                moveSelection(1, 0, true);
                break;
            case 'ArrowUp':
                event.preventDefault();
                moveSelection(0, -1, true);
                break;
            case 'ArrowDown':
                event.preventDefault();
                moveSelection(0, 1, true);
                break;
            default:
                if (event.key.length === 1 && event.key.match(/[a-zA-Z]/i)) {
                    event.preventDefault();
                    handleCellUpdate(x, y, { value: event.key.toUpperCase() });
                    moveToNextCell();
                }
        }
    };

    const handleCellClick = (x: number, y: number) => {
        if (editMode === 'separator') {
            handleSeparatorClick(x, y);
            return;
        }
        // Si un mot est sélectionné, cliquer une case noire candidate y place sa définition.
        if (selectedWord) {
            const cand = candidateInfos.find((c) => c.x === x && c.y === y);
            if (cand) {
                placeDefinition(cand);
                return;
            }
        }
        const cell = currentGrid.cells[y]?.[x];
        selectedCell = { x, y };
        if (cell && !cell.isBlack) {
            selectedBlackCell = null;
            // On connaît le mot avec certitude grâce au sens (horizontal/vertical) choisi.
            const wp = wordPositions.find((p) => p.direction === selectedDirection && p.cells.some((c) => c.x === x && c.y === y));
            selectedWord = wp ? wp.word : null; // case « vide » -> on désélectionne le mot
        }
    };

    const handleBlackCellClick = (x: number, y: number) => (selectedBlackCell = { x, y });

    const handleResize = (width: number, height: number) => resizeGrid(width, height);

    const toggleDirection = () => setDirection(selectedDirection === 'horizontal' ? 'vertical' : 'horizontal');

    const placeDefinition = (cand: Candidate) => {
        if (!selectedWord) return;
        const word = selectedWord;
        const atCell = Object.entries(placements).filter(([, p]) => p.x === cand.x && p.y === cand.y);
        const already = atCell.some(([w]) => w === word);
        if (atCell.length >= 2 && !already) return; // au plus 2 définitions par case noire
        if (defPool[word] === undefined) defPool = { ...defPool, [word]: '' };
        const direction: Placement['direction'] =
            cand.anchor.x > cand.x ? 'right' : cand.anchor.x < cand.x ? 'left' : cand.anchor.y > cand.y ? 'down' : 'up';
        // L'ordre des segments dans la case noire est déduit géométriquement au
        // rendu (voir buildPlacementsForGrid), pas stocké.
        placements = {
            ...placements,
            [word]: {
                x: cand.x,
                y: cand.y,
                direction,
                anchor: { x: cand.anchor.x, y: cand.anchor.y },
                anchorRole: cand.anchorRole,
                wordDirection: cand.wordDirection,
                segmentColor: placements[word]?.segmentColor,
                segmentTextColor: placements[word]?.segmentTextColor,
                segmentFontSize: placements[word]?.segmentFontSize
            }
        };
    };

    // --- Mode séparateur ---------------------------------------------------
    const toggleEditMode = () => {
        editMode = editMode === 'separator' ? 'normal' : 'separator';
        sepFirst = null;
    };

    const handleSeparatorClick = (x: number, y: number) => {
        if (!sepFirst) {
            sepFirst = { x, y };
            return;
        }
        const a = sepFirst;
        if (Math.abs(a.x - x) + Math.abs(a.y - y) !== 1) {
            sepFirst = { x, y };
            return;
        }
        let edge: string;
        if (x === a.x + 1) edge = `${a.x}-${a.y}-r`;
        else if (x === a.x - 1) edge = `${x}-${y}-r`;
        else if (y === a.y + 1) edge = `${a.x}-${a.y}-b`;
        else edge = `${x}-${y}-b`;
        const seps = new Set(currentGrid.separators || []);
        if (seps.has(edge)) seps.delete(edge);
        else seps.add(edge);
        currentGrid = { ...currentGrid, separators: [...seps] };
        sepFirst = null;
    };

    const removePlacement = (word: string) => {
        const { [word]: _removed, ...rest } = placements;
        placements = rest;
    };

    const handleWordSelect = (word: string) => {
        selectedWord = selectedWord === word ? null : word;
        selectedBlackCell = null;
    };

    const handleDefinitionChange = (value: string) => {
        if (!selectedWord) return;
        defPool = { ...defPool, [selectedWord]: value };
    };

    const handleOutsideClick = (event: MouseEvent) => {
        const target = event.target as Node;
        if (gridContainerEl && !gridContainerEl.contains(target) && !sidebarEl?.contains(target)) {
            selectedCell = null;
        }
    };

    const updatePlacement = (word: string, updater: (p: Placement) => Placement) => {
        const current = placements[word];
        if (!current) return;
        placements = { ...placements, [word]: updater(current) };
    };

</script>

<svelte:window onkeydown={handleKeyDown} onmousedown={handleOutsideClick} />

<div class="flex h-screen flex-col overflow-hidden bg-base-200 text-base-content" style={gridVars}>
    <Toolbar
        onResize={handleResize}
        currentGrid={currentGrid}
        onInputFocus={(v) => (isToolbarInputActive = v)}
        {appearance}
        onAppearanceChange={applyAppearanceChanges}
        onGridNameChange={setGridName}
        onGridSetChange={setGridSet}
        {saveStatus}
        onSave={saveCurrentGrid}
        onNewGrid={newGrid}
        onShowGrids={openGrids}
        {selectedDirection}
        onDirectionToggle={toggleDirection}
        {editMode}
        onToggleEditMode={toggleEditMode}
        {previewAppearance}
        onTogglePreviewAppearance={() => (previewAppearance = !previewAppearance)}
        {previewWithoutLetters}
        onTogglePreviewWithoutLetters={() => (previewWithoutLetters = !previewWithoutLetters)}
        {showSidebar}
        onToggleSidebar={() => (showSidebar = !showSidebar)}
    />

    <div class="flex flex-1 overflow-hidden">
        <main class="relative flex-1 overflow-auto" bind:this={gridAreaEl}>
            <div class="flex h-fit min-h-full w-fit min-w-full items-center justify-center p-6">
                <div class="shrink-0" style:width={`${boardW * zoom}px`} style:height={`${boardH * zoom}px`} bind:this={gridContainerEl}>
                    <div style:transform={`scale(${zoom})`} style:transform-origin="top left">
                        <CrosswordGrid
                            cells={currentGrid.cells}
                            {selectedCell}
                            {highlightedCells}
                            {candidateCells}
                            {duplicateCells}
                            separators={separatorSet}
                            pendingCell={editMode === 'separator' ? sepFirst : null}
                            definitionPlacements={renderData.definitionPlacements}
                            arrowPlacements={renderData.arrowPlacements}
                            hideLetters={previewWithoutLetters}
                            onCellClick={handleCellClick}
                            onBlackCellClick={handleBlackCellClick}
                        />
                    </div>
                </div>
            </div>

            <div class="join fixed bottom-4 z-40 shadow-lg" style:right={showSidebar ? '21rem' : '1rem'}>
                <button class="btn btn-sm join-item" onclick={() => (zoom = Math.max(zoom - 0.1, 0.5))} title="Dézoomer (Ctrl + molette bas)">−</button>
                <button class="btn btn-sm join-item" onclick={() => (zoom = 1)} title="Réinitialiser le zoom">{Math.round(zoom * 100)}%</button>
                <button class="btn btn-sm join-item" onclick={() => (zoom = Math.min(zoom + 0.1, 2))} title="Zoomer (Ctrl + molette haut)">+</button>
            </div>
        </main>

        {#if showSidebar}
            <aside bind:this={sidebarEl} class="contents">
                <Sidebar
                    {selectedBlackCell}
                    {selectedBlackCellDefinitions}
                    {appearance}
                    {wordsList}
                    {filteredWordsList}
                    {duplicateWords}
                    {defPool}
                    {placements}
                    {selectedWord}
                    candidateCount={candidateInfos.length}
                    bind:wordSearch
                    onFocusInput={(v) => (isToolbarInputActive = v)}
                    onWordSelect={handleWordSelect}
                    onDefinitionChange={handleDefinitionChange}
                    onUpdatePlacement={updatePlacement}
                    onRemovePlacement={removePlacement}
                    onCloseBlackCell={() => (selectedBlackCell = null)}
                    onClearSelection={() => (selectedCell = null)}
                />
            </aside>
        {/if}
    </div>

    {#if showGridsDialog}
        <GridsDialog
            {gridsBySet}
            hasGrids={grids.length > 0}
            bind:selectedId={dialogSelectedId}
            selectedGrid={dialogSelectedGrid}
            openSet={dialogOpenSet}
            {currentGridId}
            onClose={() => (showGridsDialog = false)}
            onImport={() => dbFileInput?.click()}
            onExportDatabase={handleExportDatabase}
            onExportSetJson={exportSetJson}
            onExportSetPdf={exportSetPdf}
            onExportGridJson={exportGridJson}
            onExportGridPdf={exportGridPdf}
            onOpen={loadSavedGrid}
            onDelete={deleteGrid}
            onRenameSet={renameSet}
        />
    {/if}

    <input
        bind:this={dbFileInput}
        type="file"
        accept=".json,.txt"
        class="hidden"
        onchange={(e) => {
            readDbFile(e.currentTarget.files?.[0]);
            e.currentTarget.value = '';
        }}
    />
</div>
