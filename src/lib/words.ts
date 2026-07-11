// Analyse de grille : extraction des mots, calcul des flèches/définitions,
// apparence par défaut et signature de changement. Sans dépendance UI.
import type { AppearanceSettings, Cell, Grid, WordDefinitionData } from '../models/types';

export type WordDirection = 'horizontal' | 'vertical';

export interface WordPosition {
    word: string;
    direction: WordDirection;
    start: { x: number; y: number };
    end: { x: number; y: number };
    cells: { x: number; y: number }[];
}

export interface DefinitionMarker {
    word: string;
    definition?: string;
    segmentColor?: string;
    segmentTextColor?: string;
    segmentFontSize?: number;
}

export interface ArrowPlacement {
    // Côté de la case blanche (ancre) où se trouve la case noire de définition.
    entry: 'left' | 'right' | 'top' | 'bottom';
    // Sens de lecture du mot (là où pointe la flèche).
    bodyDir: 'left' | 'right' | 'up' | 'down';
    // Segment de la définition dans la case noire (pour décaler les flèches
    // partageant le même bord vers le milieu de leur définition).
    slotIndex: number;
    slotCount: number;
}

// Calcul partagé par l'aperçu et le PDF afin que les définitions gardent la
// même taille et les mêmes retours à la ligne dans les deux rendus.
export const fitDefinitionFontSize = (text: string, slotCount: number) => {
    const availableWidth = 34;
    const availableHeight = 34 / Math.max(1, slotCount) - 2;
    const words = text.split(/\s+/).filter(Boolean);
    const longestWord = words.reduce((max, word) => Math.max(max, word.length), 0);
    const maxHeightSize = availableHeight / Math.max(1, words.length) / 1.35;
    const maxWidthSize = longestWord > 0 ? availableWidth / (longestWord * 0.65) : 18;
    const upperBound = Math.min(14, maxHeightSize, maxWidthSize) * (slotCount > 1 ? 0.86 : 1);

    for (let size = Math.floor(upperBound); size >= 4; size -= 1) {
        const charWidth = 0.52 * size;
        let currentLineWidth = 0;
        let linesUsed = 1;
        let fits = true;
        for (const word of words) {
            const wordWidth = word.length * charWidth;
            if (wordWidth > availableWidth) {
                fits = false;
                break;
            }
            if (currentLineWidth === 0) currentLineWidth = wordWidth;
            else if (currentLineWidth + charWidth + wordWidth <= availableWidth) currentLineWidth += charWidth + wordWidth;
            else {
                linesUsed += 1;
                if (linesUsed * size * 1.1 > availableHeight) {
                    fits = false;
                    break;
                }
                currentLineWidth = wordWidth;
            }
        }
        if (fits) return size;
    }
    return 4;
};

// Parcourt la grille pour lister les mots existants avec leurs coordonnées.
export const extractWordPositions = (cells: Cell[][]): WordPosition[] => {
    const positions: WordPosition[] = [];

    for (let y = 0; y < cells.length; y++) {
        let currentWord = '';
        let startX = 0;
        const currentCells: { x: number; y: number }[] = [];

        for (let x = 0; x < cells[0].length; x++) {
            if (!cells[y][x].isBlack && cells[y][x].value) {
                if (currentWord.length === 0) startX = x;
                currentWord += cells[y][x].value;
                currentCells.push({ x, y });
            } else if (currentWord.length > 1) {
                positions.push({
                    word: currentWord,
                    direction: 'horizontal',
                    start: { x: startX, y },
                    end: { x: x - 1, y },
                    cells: [...currentCells]
                });
                currentWord = '';
                currentCells.length = 0;
            } else {
                currentWord = '';
                currentCells.length = 0;
            }
        }
        if (currentWord.length > 1) {
            positions.push({
                word: currentWord,
                direction: 'horizontal',
                start: { x: startX, y },
                end: { x: cells[0].length - 1, y },
                cells: [...currentCells]
            });
        }
    }

    for (let x = 0; x < cells[0].length; x++) {
        let currentWord = '';
        let startY = 0;
        const currentCells: { x: number; y: number }[] = [];

        for (let y = 0; y < cells.length; y++) {
            if (!cells[y][x].isBlack && cells[y][x].value) {
                if (currentWord.length === 0) startY = y;
                currentWord += cells[y][x].value;
                currentCells.push({ x, y });
            } else if (currentWord.length > 1) {
                positions.push({
                    word: currentWord,
                    direction: 'vertical',
                    start: { x, y: startY },
                    end: { x, y: y - 1 },
                    cells: [...currentCells]
                });
                currentWord = '';
                currentCells.length = 0;
            } else {
                currentWord = '';
                currentCells.length = 0;
            }
        }
        if (currentWord.length > 1) {
            positions.push({
                word: currentWord,
                direction: 'vertical',
                start: { x, y: startY },
                end: { x, y: cells.length - 1 },
                cells: [...currentCells]
            });
        }
    }

    return positions;
};

// Construit une grille vide aux dimensions souhaitées.
export const buildEmptyGrid = (width: number, height: number): Grid => ({
    name: '',
    size: { width, height },
    cells: Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (__, x) => ({ value: '', isBlack: false, x, y, isHighlighted: false }))
    ),
    words: [],
    status: 'initial',
    separators: []
});

export const DEFAULT_APPEARANCE: AppearanceSettings = {
    blackCellColor: '#000000',
    cellBackgroundColor: '#ffffff',
    arrowColor: '#7a7a7a',
    letterColor: '#000000',
    definitionTextColor: '#f5f5f5',
    borderColor: '#cccccc',
    separatorColor: '#ffffff',
    separatorWidth: 0.5,
    gridFont: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    definitionFont: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    gridFontStyle: 'bold',
    definitionFontStyle: 'normal'
};

// Compare deux ensembles d'apparence pour éviter des boucles de mise à jour.
export const areAppearancesEqual = (a: AppearanceSettings, b: AppearanceSettings) =>
    a.blackCellColor === b.blackCellColor &&
    a.cellBackgroundColor === b.cellBackgroundColor &&
    a.arrowColor === b.arrowColor &&
    a.letterColor === b.letterColor &&
    a.definitionTextColor === b.definitionTextColor &&
    a.borderColor === b.borderColor &&
    a.separatorColor === b.separatorColor &&
    a.separatorWidth === b.separatorWidth &&
    a.gridFont === b.gridFont &&
    a.definitionFont === b.definitionFont &&
    a.gridFontStyle === b.gridFontStyle &&
    a.definitionFontStyle === b.definitionFontStyle &&
    a.backgroundImage === b.backgroundImage;

// Prépare la carte des définitions/flèches à afficher dans la grille courante.
export const buildPlacementsForGrid = (
    grid: Grid | undefined,
    definitions: Record<string, WordDefinitionData>
): {
    definitionPlacements: Record<string, DefinitionMarker[]>;
    arrowPlacements: Record<string, ArrowPlacement[]>;
} => {
    const definitionPlacements: Record<string, DefinitionMarker[]> = {};
    const arrowPlacements: Record<string, ArrowPlacement[]> = {};
    const pending: { arrowKey: string; blackKey: string; word: string; entry: ArrowPlacement['entry']; bodyDir: ArrowPlacement['bodyDir'] }[] = [];

    if (!grid) return { definitionPlacements, arrowPlacements };

    Object.entries(definitions).forEach(([word, data]) => {
        const p = data.placement;
        if (!p) return;
        const black = grid.cells[p.y]?.[p.x];
        if (!black || !black.isBlack) return;

        const blackKey = `${p.x}-${p.y}`;
        (definitionPlacements[blackKey] ||= []).push({
            word,
            definition: data.definition,
            segmentColor: p.segmentColor,
            segmentTextColor: p.segmentTextColor,
            segmentFontSize: p.segmentFontSize
        });

        // Flèche : déduite de la position de la case noire vs. l'ancre et du sens du mot.
        const ax = p.anchor.x;
        const ay = p.anchor.y;
        const anchorCell = grid.cells[ay]?.[ax];
        if (!anchorCell || anchorCell.isBlack) return;

        const entry: ArrowPlacement['entry'] =
            p.x < ax ? 'left' : p.x > ax ? 'right' : p.y < ay ? 'top' : 'bottom';
        const bodyDir: ArrowPlacement['bodyDir'] =
            p.wordDirection === 'horizontal'
                ? p.anchorRole === 'start'
                    ? 'right'
                    : 'left'
                : p.anchorRole === 'start'
                  ? 'down'
                  : 'up';

        pending.push({ arrowKey: `${ax}-${ay}`, blackKey, word, entry, bodyDir });
    });

    // Ordonne les définitions d'une case selon le bord de sortie de leur flèche :
    // mot au-dessus -> segment du haut, sur le côté -> milieu, en dessous -> bas.
    // (Impossible donc d'avoir « une définition en haut pour un mot en dessous ».)
    const exitRank = (word: string) => {
        const p = definitions[word]?.placement;
        if (!p) return 1;
        return p.anchor.y < p.y ? 0 : p.anchor.y > p.y ? 2 : 1;
    };
    Object.keys(definitionPlacements).forEach((key) => {
        definitionPlacements[key].sort((a, b) => exitRank(a.word) - exitRank(b.word));
    });

    // Chaque flèche part du milieu de SA définition (son segment dans la case
    // noire). Le décalage n'est appliqué que sur les bords verticaux (gauche/
    // droite) au rendu ; sur un bord horizontal la flèche reste centrée.
    pending.forEach((a) => {
        const slots = definitionPlacements[a.blackKey] || [];
        const slotIndex = Math.max(0, slots.findIndex((s) => s.word === a.word));
        (arrowPlacements[a.arrowKey] ||= []).push({
            entry: a.entry,
            bodyDir: a.bodyDir,
            slotIndex,
            slotCount: Math.max(1, slots.length)
        });
    });

    return { definitionPlacements, arrowPlacements };
};

// Signature canonique d'une grille et de ses définitions, pour détecter
// les modifications non enregistrées (indépendante de l'ordre des clés).
export const gridSignature = (grid: Grid, definitions: Record<string, WordDefinitionData>): string => {
    const cells = grid.cells.map((row) => row.map((c) => (c.isBlack ? '#' : c.value || '.')).join('')).join('|');
    const defs = Object.keys(definitions)
        .sort()
        .map((word) => {
            const { definition, placement: p } = definitions[word];
            const placement = p
                ? `${p.x},${p.y},${p.direction},${p.anchor.x},${p.anchor.y},${p.anchorRole},${p.wordDirection},${p.arrowStyle || ''},${p.curvedVariant || ''},${p.attachment || ''},${p.order ?? ''},${p.segmentColor || ''},${p.segmentTextColor || ''},${p.segmentFontSize ?? ''}`
                : '';
            return `${word}=${definition}@${placement}`;
        })
        .join(';');
    const seps = (grid.separators || []).slice().sort().join(',');
    return `${grid.name || ''}␟${grid.set || ''}\n${cells}\n${defs}\n${seps}`;
};
