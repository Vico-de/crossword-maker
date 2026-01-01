import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CrosswordGrid } from '../components/grid/CrosswordGrid';
import { Toolbar, type AppearanceSettings } from '../components/toolbar/Toolbar';
import { useCrossword } from '../context/CrosswordContext';
import type {
    Cell,
    Grid,
    GridSet,
    SavedGrid,
    WordDefinitionData,
    WordDefinitionPlacement
} from '../models/types';
import './CrosswordEditor.css';

// -----------------------------------------------------------------------------
// Types et helpers transverses
// -----------------------------------------------------------------------------
type WordDirection = 'horizontal' | 'vertical';

interface WordPosition {
    word: string;
    direction: WordDirection;
    start: { x: number; y: number };
    end: { x: number; y: number };
    cells: { x: number; y: number }[];
}

// Parcourt la grille pour lister les mots existants avec leurs coordonnées.
const extractWordPositions = (cells: Cell[][]): WordPosition[] => {
    const positions: WordPosition[] = [];

    // Extraction des mots horizontaux
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

    // Extraction des mots verticaux
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
const buildEmptyGrid = (width: number, height: number) => {
    return {
        name: '',
        size: { width, height },
        cells: Array(height)
            .fill(null)
            .map((_, y) =>
                Array(width)
                    .fill(null)
                    .map((__, x) => ({ value: '', isBlack: false, x, y, isHighlighted: false }))
            ),
        words: [],
        status: 'initial' as const
    };
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
    blackCellColor: '#000000',
    cellBackgroundColor: '#ffffff',
    arrowColor: '#7a7a7a',
    letterColor: '#000000',
    definitionTextColor: '#f5f5f5',
    borderColor: '#cccccc',
    separatorColor: '#ffffff',
    gridFont: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    definitionFont: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif"
};

// Compare deux ensembles d'apparence pour éviter des boucles de mise à jour.
const areAppearancesEqual = (a: AppearanceSettings, b: AppearanceSettings) =>
    a.blackCellColor === b.blackCellColor &&
    a.cellBackgroundColor === b.cellBackgroundColor &&
    a.arrowColor === b.arrowColor &&
    a.letterColor === b.letterColor &&
    a.definitionTextColor === b.definitionTextColor &&
    a.borderColor === b.borderColor &&
    a.separatorColor === b.separatorColor &&
    a.gridFont === b.gridFont &&
    a.definitionFont === b.definitionFont;

type PackedDefinition = [
    string,
    string,
    |
        [
            number,
            number,
            WordDefinitionPlacement['direction'],
            [number, number],
            WordDefinitionPlacement['anchorRole'],
            WordDirection
        ]
        | undefined
];

type ArrowPlacement = {
    direction: 'up' | 'down' | 'left' | 'right';
    variant?: 'straight' | 'curved-right' | 'curved-left';
    from: { x: number; y: number };
    attachment?: 'left' | 'right' | 'top' | 'bottom';
};

// Compacte les définitions et leurs ancrages pour les sauvegardes de set.
const packDefinitions = (definitions: Record<string, WordDefinitionData>): PackedDefinition[] => {
    return Object.entries(definitions).map(([word, data]) => [
        word,
        data.definition,
        data.placement
            ? [
                  data.placement.x,
                  data.placement.y,
                  data.placement.direction,
                  [data.placement.anchor.x, data.placement.anchor.y],
                  data.placement.anchorRole,
                  data.placement.wordDirection
              ]
            : undefined
    ]);
};

// Restaure les définitions depuis la forme compacte du set.
const unpackDefinitions = (packed: PackedDefinition[]): Record<string, WordDefinitionData> => {
    const result: Record<string, WordDefinitionData> = {};
    packed.forEach(([word, definition, placement]) => {
        result[word] = {
            definition,
            placement:
                placement && placement[2]
                    ? {
                          x: placement[0],
                          y: placement[1],
                          direction: placement[2],
                          anchor: { x: placement[3][0], y: placement[3][1] },
                          anchorRole: placement[4],
                          wordDirection: placement[5]
                      }
                    : undefined
        };
    });
    return result;
};

// -----------------------------------------------------------------------------
// Sérialisation / désérialisation des grilles et définitions pour les sets
// -----------------------------------------------------------------------------

// Sérialise la grille en notation compacte (lettre, # pour noire, . pour vide).
const packGrid = (grid: Grid) => ({
    n: grid.name || '',
    s: [grid.size.width, grid.size.height],
    r: grid.cells.map((row) => row.map((cell) => (cell.isBlack ? '#' : cell.value || '.')).join(''))
});

// Désérialise la notation compacte vers la grille complète.
const unpackGrid = (packed: { n?: string; s: [number, number]; r: string[] }): Grid => {
    const [width, height] = packed.s;
    const cells: Cell[][] = Array(height)
        .fill(null)
        .map((_, y) =>
            Array(width)
                .fill(null)
                .map((__, x) => {
                    const char = packed.r[y]?.[x] || '.';
                    const isBlack = char === '#';
                    return {
                        x,
                        y,
                        isBlack,
                        value: isBlack || char === '.' ? '' : char.toUpperCase(),
                        isHighlighted: false
                    } as Cell;
                })
        );

    return {
        name: packed.n || '',
        size: { width, height },
        cells,
        words: [],
        status: 'loaded'
    } as Grid;
};

// Prépare la carte des définitions/flèches à afficher dans la grille courante.
const buildPlacementsForGrid = (
    grid: Grid | undefined,
    definitions: Record<string, WordDefinitionData>
): { definitionPlacements: Record<string, { word: string; definition?: string }[]>; arrowPlacements: Record<string, ArrowPlacement[]> } => {
    const definitionPlacements: Record<string, { word: string; definition?: string }[]> = {};
    const arrowPlacements: Record<string, ArrowPlacement[]> = {};

    if (!grid) return { definitionPlacements, arrowPlacements };

    Object.entries(definitions).forEach(([word, data]) => {
        if (!data.placement) return;
        const { x, y, direction, anchorRole, wordDirection, anchor } = data.placement;
        const cell = grid.cells[y]?.[x];
        if (!cell || !cell.isBlack) return;

        const key = `${x}-${y}`;
        if (!definitionPlacements[key]) definitionPlacements[key] = [];
        definitionPlacements[key].push({ word, definition: data.definition });

        const target = {
            x: x + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0),
            y: y + (direction === 'down' ? 1 : direction === 'up' ? -1 : 0)
        };

        const withinBounds =
            target.x >= 0 &&
            target.y >= 0 &&
            target.y < grid.cells.length &&
            target.x < grid.cells[0].length;
        const playable = withinBounds && !grid.cells[target.y][target.x].isBlack;

        if (withinBounds && playable) {
            const arrowKey = `${target.x}-${target.y}`;
            if (!arrowPlacements[arrowKey]) arrowPlacements[arrowKey] = [];

            let variant: ArrowPlacement['variant'] = 'straight';
            if (wordDirection === 'horizontal' && (direction === 'down' || direction === 'up')) {
                variant = anchorRole === 'start' ? 'curved-right' : 'curved-left';
            }

            const attachment: ArrowPlacement['attachment'] =
                x < target.x ? 'left' : x > target.x ? 'right' : y < target.y ? 'top' : 'bottom';

            arrowPlacements[arrowKey].push({
                direction,
                variant,
                from: anchor,
                attachment
            });
        }
    });

    return { definitionPlacements, arrowPlacements };
};

const escapePdfText = (text: string) =>
    text.replace(/[\\()]/g, (char) => {
        if (char === '\\') return '\\';
        if (char === '(') return '\(';
        return '\)';
    });

const hexToRgb = (hex: string): [number, number, number] => {
    const normalized = hex.replace('#', '');
    const value = normalized.length === 3
        ? normalized
              .split('')
              .map((c) => c + c)
              .join('')
        : normalized.padEnd(6, '0');
    const intVal = parseInt(value, 16);
    return [((intVal >> 16) & 255) / 255, ((intVal >> 8) & 255) / 255, (intVal & 255) / 255];
};

type PdfPage = { width: number; height: number; content: string };

const renderGridPdfPage = (
    grid: Grid,
    definitions: Record<string, WordDefinitionData>,
    appearance: AppearanceSettings,
    label?: string
): PdfPage => {
    const baseCell = 40;
    const cellSize = baseCell;
    const boardWidth = grid.size.width * cellSize;
    const boardHeight = grid.size.height * cellSize;
    const labelHeight = label ? 28 : 0;
    const mediaHeight = boardHeight + labelHeight;

    const { definitionPlacements, arrowPlacements } = buildPlacementsForGrid(grid, definitions);
    const measureCtx = document.createElement('canvas').getContext('2d');

    const fitDefinitionSize = (text: string, slotCount: number) => {
        if (!measureCtx) return 12;
        const availableWidth = cellSize - 6;
        const availableHeight = (cellSize - 6) / Math.max(1, slotCount) - 2;
        const words = text.split(/\s+/).filter(Boolean);
        const longestWord = words.reduce((max, w) => Math.max(max, w.length), 0);
        const upperBound = Math.min(18, availableHeight, longestWord > 0 ? availableWidth / (longestWord * 0.65) : 18);

        for (let size = Math.floor(upperBound); size >= 4; size -= 1) {
            measureCtx.font = `${size}px ${appearance.definitionFont}`;
            const spaceWidth = measureCtx.measureText(' ').width;
            let lines = 1;
            let width = 0;
            let fits = true;
            for (const word of words) {
                const w = measureCtx.measureText(word).width;
                if (w > availableWidth) {
                    fits = false;
                    break;
                }
                if (width === 0) {
                    width = w;
                } else if (width + spaceWidth + w <= availableWidth) {
                    width += spaceWidth + w;
                } else {
                    lines += 1;
                    if (lines * size * 1.1 > availableHeight) {
                        fits = false;
                        break;
                    }
                    width = w;
                }
            }

            if (fits) return size;
        }

        return 4;
    };

    const rgbFill = (hex: string) => {
        const [r, g, b] = hexToRgb(hex);
        return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
    };
    const rgbStroke = (hex: string) => {
        const [r, g, b] = hexToRgb(hex);
        return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`;
    };

    const lines: string[] = [];

    if (label) {
        lines.push('/F1 12 Tf');
        lines.push(rgbFill(appearance.letterColor));
        lines.push('BT');
        lines.push(`12 ${(mediaHeight - 14).toFixed(2)} Td`);
        lines.push(`(${escapePdfText(label)}) Tj`);
        lines.push('ET');
    }

    lines.push('q');
    lines.push(`1 0 0 -1 0 ${mediaHeight} cm`);

    grid.cells.forEach((row, y) => {
        row.forEach((cell, x) => {
            const posX = x * cellSize;
            const posY = y * cellSize + labelHeight;

            lines.push(rgbFill(cell.isBlack ? appearance.blackCellColor : appearance.cellBackgroundColor));
            lines.push(`${posX.toFixed(2)} ${posY.toFixed(2)} ${cellSize.toFixed(2)} ${cellSize.toFixed(2)} re f`);

            if (cell.isBlack) {
                const key = `${x}-${y}`;
                const cellDefs = definitionPlacements[key];
                if (cellDefs && cellDefs.length > 0 && measureCtx) {
                    const slots = cellDefs.length;
                    cellDefs.forEach((def, index) => {
                        const startY = posY + (cellSize / slots) * index;
                        const areaHeight = cellSize / slots;
                        const content = (def.definition || def.word).toUpperCase();
                        const fontSize = fitDefinitionSize(content, slots);
                        const words = content.split(/\s+/).filter(Boolean);
                        const availableWidth = cellSize - 6;
                        const textLines: string[] = [];
                        let current = '';
                        measureCtx.font = `${fontSize}px ${appearance.definitionFont}`;
                        words.forEach((word) => {
                            const tentative = current ? `${current} ${word}` : word;
                            if (measureCtx.measureText(tentative).width <= availableWidth) {
                                current = tentative;
                            } else {
                                if (current) textLines.push(current);
                                current = word;
                            }
                        });
                        if (current) textLines.push(current);

                        lines.push(rgbFill(appearance.definitionTextColor));
                        lines.push(`/F1 ${fontSize.toFixed(2)} Tf`);
                        textLines.forEach((line, lineIndex) => {
                            const centerY = startY + areaHeight / 2 + (lineIndex - (textLines.length - 1) / 2) * (fontSize * 1.1);
                            lines.push('BT');
                            lines.push(`${(posX + cellSize / 2).toFixed(2)} ${centerY.toFixed(2)} Td`);
                            lines.push(`(${escapePdfText(line)}) Tj`);
                            lines.push('ET');
                        });
                    });

                    if (cellDefs.length > 1) {
                        lines.push(rgbStroke(appearance.separatorColor));
                        lines.push('1 w');
                        const sepY = posY + cellSize / 2;
                        lines.push(`${posX.toFixed(2)} ${sepY.toFixed(2)} m ${(posX + cellSize).toFixed(2)} ${sepY.toFixed(2)} l S`);
                    }
                }
            } else if (cell.value) {
                const fontSize = cellSize * 0.55;
                lines.push(rgbFill(appearance.letterColor));
                lines.push(`/F1 ${fontSize.toFixed(2)} Tf`);
                lines.push('BT');
                lines.push(`${(posX + cellSize / 2).toFixed(2)} ${(posY + cellSize / 2 + 1).toFixed(2)} Td`);
                lines.push(`(${escapePdfText(cell.value)}) Tj`);
                lines.push('ET');
            }
        });
    });

    lines.push(rgbStroke(appearance.borderColor));
    lines.push('1 w');
    for (let x = 0; x <= grid.size.width; x++) {
        const px = x * cellSize + 0.5;
        lines.push(`${px.toFixed(2)} ${labelHeight.toFixed(2)} m ${px.toFixed(2)} ${(boardHeight + labelHeight).toFixed(2)} l S`);
    }
    for (let y = 0; y <= grid.size.height; y++) {
        const py = y * cellSize + 0.5 + labelHeight;
        lines.push(`0 ${py.toFixed(2)} m ${boardWidth.toFixed(2)} ${py.toFixed(2)} l S`);
    }

    Object.entries(arrowPlacements).forEach(([key, arrows]) => {
        const [targetX, targetY] = key.split('-').map(Number);
        const centerX = targetX * cellSize + cellSize / 2;
        const centerY = targetY * cellSize + cellSize / 2 + labelHeight;
        const offset = cellSize * 0.35;
        const fontSize = cellSize * 0.32;
        lines.push(rgbFill(appearance.arrowColor));
        lines.push(`/F1 ${fontSize.toFixed(2)} Tf`);

        arrows.forEach((arrow) => {
            const dx = arrow.attachment === 'left' ? -offset : arrow.attachment === 'right' ? offset : 0;
            const dy = arrow.attachment === 'top' ? -offset : arrow.attachment === 'bottom' ? offset : 0;
            const char =
                arrow.variant === 'curved-left'
                    ? arrow.direction === 'down'
                        ? '↲'
                        : '↰'
                    : arrow.variant === 'curved-right'
                        ? arrow.direction === 'down'
                            ? '↳'
                            : '↱'
                        : arrow.direction === 'left'
                            ? '←'
                            : arrow.direction === 'right'
                                ? '→'
                                : arrow.direction === 'up'
                                    ? '↑'
                                    : '↓';
            lines.push('BT');
            lines.push(`${(centerX + dx).toFixed(2)} ${(centerY + dy).toFixed(2)} Td`);
            lines.push(`(${escapePdfText(char)}) Tj`);
            lines.push('ET');
        });
    });

    lines.push('Q');

    return { width: boardWidth, height: mediaHeight, content: lines.join('\n') };
};

const buildPdfDocument = (pages: PdfPage[]) => {
    const encoder = new TextEncoder();
    const chunks: (string | Uint8Array)[] = ['%PDF-1.4\n'];
    const offsets: Record<number, number> = {};
    const byteLength = () =>
        chunks.reduce((total, chunk) => total + (typeof chunk === 'string' ? encoder.encode(chunk).length : chunk.length), 0);

    const writeObject = (id: number, content: string) => {
        offsets[id] = byteLength();
        chunks.push(`${id} 0 obj\n${content}\nendobj\n`);
    };

    const writeStream = (id: number, dict: string, data: Uint8Array) => {
        offsets[id] = byteLength();
        chunks.push(`${id} 0 obj\n${dict}\nstream\n`);
        chunks.push(data);
        chunks.push('\nendstream\nendobj\n');
    };

    const catalogId = 1;
    const pagesId = 2;
    const fontId = 3;
    let nextId = 4;

    const preparedPages = pages.map((page) => ({
        ...page,
        pageId: nextId++,
        contentId: nextId++
    }));

    writeObject(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

    preparedPages.forEach((page) => {
        const contentBytes = encoder.encode(page.content);
        writeStream(page.contentId, `<< /Length ${contentBytes.length} >>`, contentBytes);

        const resources = ['/ProcSet [ /PDF /Text ]', `/Font << /F1 ${fontId} 0 R >>`];
        const pageDict = [
            '<<',
            '/Type /Page',
            `/Parent ${pagesId} 0 R`,
            `/Resources << ${resources.join(' ')} >>`,
            `/MediaBox [0 0 ${page.width} ${page.height}]`,
            `/Contents ${page.contentId} 0 R`,
            '>>'
        ].join(' ');

        writeObject(page.pageId, pageDict);
    });

    writeObject(
        pagesId,
        `<< /Type /Pages /Count ${preparedPages.length} /Kids [${preparedPages
            .map((page) => `${page.pageId} 0 R`)
            .join(' ')}] >>`
    );
    writeObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    const xrefStart = byteLength();
    chunks.push(`xref\n0 ${nextId}\n`);
    chunks.push('0000000000 65535 f \n');
    for (let i = 1; i < nextId; i++) {
        const offset = offsets[i] ?? 0;
        chunks.push(`${offset.toString().padStart(10, '0')} 00000 n \n`);
    }
    chunks.push(`trailer\n<< /Size ${nextId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    const total = byteLength();
    const buffer = new Uint8Array(total);
    let cursor = 0;
    chunks.forEach((chunk) => {
        if (typeof chunk === 'string') {
            const encoded = encoder.encode(chunk);
            buffer.set(encoded, cursor);
            cursor += encoded.length;
        } else {
            buffer.set(chunk, cursor);
            cursor += chunk.length;
        }
    });

    return new Blob([buffer], { type: 'application/pdf' });
};

const serializeSet = (set: GridSet, appearance: AppearanceSettings) => {
    const payload = {
        i: set.id,
        n: set.name,
        a: appearance,
        g: set.grids.map((g) => ({
            i: g.id,
            n: g.name,
            t: g.timestamp,
            r: packGrid(g.grid),
            d: packDefinitions(g.definitions || {})
        }))
    };

    return JSON.stringify(payload);
};

// Restaure un set sérialisé (local ou importé) en objets complets.
const deserializeSet = (raw: string): { set: GridSet; appearance: AppearanceSettings } => {
    const parsed = JSON.parse(raw);
    const appearance = { ...DEFAULT_APPEARANCE, ...(parsed.a || {}) };
    const set: GridSet = {
        id: parsed.i || Date.now().toString(),
        name: parsed.n || 'Set importé',
        appearance,
        grids: Array.isArray(parsed.g)
            ? parsed.g.map((g: any) => ({
                  id: g.i || Date.now().toString(),
                  name: g.n || 'Grille',
                  timestamp: g.t || Date.now(),
                  grid: unpackGrid(g.r),
                  definitions: unpackDefinitions(g.d || [])
              }))
            : []
    };

    return { set, appearance };
};

// -----------------------------------------------------------------------------
// Composant principal : gestion des états, des sauvegardes et du rendu.
// -----------------------------------------------------------------------------
export const CrosswordEditor: React.FC = () => {
    const { state, dispatch } = useCrossword();
    const [isToolbarInputActive, setIsToolbarInputActive] = useState(false);
    const gridAreaRef = React.useRef<HTMLDivElement | null>(null);
    const dialogSetFileInput = useRef<HTMLInputElement | null>(null);
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [wordDefinitions, setWordDefinitions] = useState<Record<string, WordDefinitionData>>({});
    const [placementTargetWord, setPlacementTargetWord] = useState<string | null>(null);
    const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
    const initialSets: GridSet[] = useMemo(() => {
        const storedSets = localStorage.getItem('gridSets');
        if (storedSets) {
            try {
                const parsed: GridSet[] = JSON.parse(storedSets);
                return parsed.map((set) => ({
                    ...set,
                    appearance: { ...DEFAULT_APPEARANCE, ...(set.appearance || {}) }
                }));
            } catch (error) {
                console.warn('Impossible de lire les sets sauvegardés', error);
            }
        }

        const legacyGrids = localStorage.getItem('savedGrids');
        if (legacyGrids) {
            const grids: SavedGrid[] = JSON.parse(legacyGrids);
            if (grids.length > 0) {
                return [{ id: 'legacy', name: 'Set local', grids, appearance: DEFAULT_APPEARANCE }];
            }
        }
        return [];
    }, []);
    const storedSetId = useMemo(() => localStorage.getItem('currentSetId'), []);
    const defaultSetId = storedSetId && initialSets.some((set) => set.id === storedSetId)
        ? storedSetId
        : initialSets[0]?.id || null;
    const [gridSets, setGridSets] = useState<GridSet[]>(initialSets);
    const [currentSetId, setCurrentSetId] = useState<string | null>(defaultSetId);
    const [currentSetName, setCurrentSetName] = useState<string>(
        initialSets.find((set) => set.id === defaultSetId)?.name || 'Nouveau set'
    );
    const [savedGrids, setSavedGrids] = useState<SavedGrid[]>(
        initialSets.find((set) => set.id === defaultSetId)?.grids || []
    );
    const [showSetDialog, setShowSetDialog] = useState(true);
    const [newSetName, setNewSetName] = useState('Nouveau set');

    const wordPositions = useMemo(() => {
        if (!state.currentGrid) return [];
        return extractWordPositions(state.currentGrid.cells);
    }, [state.currentGrid]);

    const filteredDefinitions = useMemo(() => {
        const validWords = new Set(wordPositions.map((pos) => pos.word));
        const next: Record<string, WordDefinitionData> = {};
        Object.entries(wordDefinitions).forEach(([word, data]) => {
            if (validWords.has(word)) {
                next[word] = data;
            }
        });
        return next;
    }, [wordDefinitions, wordPositions]);

    const appearanceVars = useMemo(
        () => ({
            ['--grid-black-color' as string]: appearance.blackCellColor,
            ['--grid-cell-color' as string]: appearance.cellBackgroundColor,
            ['--grid-arrow-color' as string]: appearance.arrowColor,
            ['--grid-letter-color' as string]: appearance.letterColor,
            ['--grid-definition-color' as string]: appearance.definitionTextColor,
            ['--grid-border-color' as string]: appearance.borderColor,
            ['--definition-separator-color' as string]: appearance.separatorColor,
            ['--grid-font-family' as string]: appearance.gridFont,
            ['--definition-font-family' as string]: appearance.definitionFont,
            ['--ui-font-family' as string]: appearance.gridFont
        }),
        [appearance]
    );

    useEffect(() => {
        localStorage.setItem('gridSets', JSON.stringify(gridSets));
        if (currentSetId) {
            localStorage.setItem('currentSetId', currentSetId);
        } else {
            localStorage.removeItem('currentSetId');
        }
    }, [gridSets, currentSetId]);

    useEffect(() => {
        const current = gridSets.find((set) => set.id === currentSetId);
        if (!current) return;

        setSavedGrids(current.grids);
        setCurrentSetName(current.name);

        const nextAppearance = { ...DEFAULT_APPEARANCE, ...(current.appearance || {}) };
        setAppearance((prev) => (areAppearancesEqual(prev, nextAppearance) ? prev : nextAppearance));
    }, [gridSets, currentSetId]);

    const applyAppearanceChanges = useCallback(
        (changes: Partial<AppearanceSettings>) => {
            setAppearance((prev) => {
                const next = { ...prev, ...changes };
                if (currentSetId) {
                    setGridSets((sets) =>
                        sets.map((set) =>
                            set.id === currentSetId
                                ? { ...set, appearance: next }
                                : set
                        )
                    );
                }
                return next;
            });
        },
        [currentSetId]
    );

    const resetEditingState = useCallback(() => {
        const size = state.currentGrid?.size || { width: 15, height: 15 };
        setWordDefinitions({});
        setSelectedWord(null);
        setPlacementTargetWord(null);
        dispatch({ type: 'LOAD_GRID', payload: buildEmptyGrid(size.width, size.height) });
    }, [dispatch, state.currentGrid]);

    const handleSavedGridsChange = useCallback((grids: SavedGrid[]) => {
        setSavedGrids(grids);
        if (currentSetId) {
            setGridSets((prev) => prev.map((set) => (set.id === currentSetId ? { ...set, grids } : set)));
        } else {
            const id = Date.now().toString();
            const name = currentSetName || 'Nouveau set';
            const newSet: GridSet = { id, name, grids, appearance };
            setGridSets([newSet]);
            setCurrentSetId(id);
            setCurrentSetName(name);
        }
    }, [appearance, currentSetId, currentSetName]);

    const handleSetNameChange = useCallback((name: string) => {
        setCurrentSetName(name);
        if (!currentSetId) return;
        setGridSets((prev) => prev.map((set) => (set.id === currentSetId ? { ...set, name } : set)));
    }, [currentSetId]);

    const handleSelectSet = useCallback((id: string) => {
        const target = gridSets.find((set) => set.id === id);
        if (!target) return;
        setCurrentSetId(id);
        setCurrentSetName(target.name);
        setSavedGrids(target.grids);
        setAppearance({ ...DEFAULT_APPEARANCE, ...(target.appearance || {}) });
        resetEditingState();
        setShowSetDialog(false);
    }, [gridSets, resetEditingState]);

    const handleDeleteSet = useCallback(
        (id: string) => {
            if (!window.confirm('Supprimer ce set de grilles ?')) return;
            setGridSets((prev) => prev.filter((set) => set.id !== id));

            if (currentSetId === id) {
                const size = state.currentGrid?.size || { width: 15, height: 15 };
                setCurrentSetId(null);
                setCurrentSetName('Nouveau set');
                setSavedGrids([]);
                setAppearance(DEFAULT_APPEARANCE);
                dispatch({ type: 'LOAD_GRID', payload: buildEmptyGrid(size.width, size.height) });
                setShowSetDialog(true);
            }
        },
        [currentSetId, dispatch, state.currentGrid]
    );

    const handleCreateNewSet = useCallback((nameOverride?: string) => {
        const name = (nameOverride ?? newSetName).trim() || 'Nouveau set';
        const id = Date.now().toString();
        const newSet: GridSet = { id, name, grids: [], appearance };
        setGridSets((prev) => [...prev, newSet]);
        setCurrentSetId(id);
        setCurrentSetName(name);
        setSavedGrids([]);
        setAppearance(DEFAULT_APPEARANCE);
        resetEditingState();
        setShowSetDialog(false);
    }, [appearance, newSetName, resetEditingState]);

    const handleExportSet = useCallback(() => {
        const exportName = (currentSetName || 'set-sans-nom').trim();
        const targetSet = currentSetId
            ? gridSets.find((set) => set.id === currentSetId) || { id: currentSetId, name: exportName, grids: savedGrids }
            : { id: Date.now().toString(), name: exportName, grids: savedGrids };

        const compact = serializeSet({ ...targetSet, grids: savedGrids, appearance }, appearance);
        const blob = new Blob([compact], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${exportName.replace(/\s+/g, '_').toLowerCase() || 'set'}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }, [appearance, currentSetId, currentSetName, gridSets, savedGrids]);

    const handleExportGridPdf = useCallback(async () => {
        if (!state.currentGrid) {
            window.alert('Aucune grille à exporter.');
            return;
        }
        try {
            const gridName = (state.currentGrid.name || 'grille').trim() || 'grille';
            const page = renderGridPdfPage(state.currentGrid, filteredDefinitions, appearance, gridName);
            downloadPdf([page], `${gridName.replace(/\s+/g, '_').toLowerCase()}.pdf`);
        } catch (error) {
            console.error('Export PDF', error);
            window.alert('Export PDF impossible : impossible de générer le fichier localement.');
        }
    }, [appearance, filteredDefinitions, state.currentGrid]);

    const handleExportSetPdf = useCallback(async () => {
        const targets = savedGrids.length > 0
            ? savedGrids
            : state.currentGrid
              ? [{ id: 'current', name: state.currentGrid.name || 'Grille', timestamp: Date.now(), grid: state.currentGrid, definitions: filteredDefinitions } as SavedGrid]
              : [];

        if (targets.length === 0) {
            window.alert('Aucune grille à exporter.');
            return;
        }

        try {
            const pages: PdfPage[] = targets.map((entry) =>
                renderGridPdfPage(entry.grid, entry.definitions || {}, appearance, entry.name)
            );

            const setLabel = (currentSetName || 'set').replace(/\s+/g, '_').toLowerCase();
            downloadPdf(pages, `${setLabel}-grilles.pdf`);
        } catch (error) {
            console.error('Export set PDF', error);
            window.alert('Export PDF impossible : impossible de générer le fichier localement.');
        }
    }, [appearance, currentSetName, filteredDefinitions, savedGrids, state.currentGrid]);

    const handleGridLoad = useCallback(
        (grid: Grid, definitions?: Record<string, WordDefinitionData>) => {
            setSelectedWord(null);
            setPlacementTargetWord(null);
            setWordDefinitions(definitions || {});
            dispatch({ type: 'LOAD_GRID', payload: grid });
        },
        [dispatch]
    );

    const handleImportSetData = useCallback(
        (content: string) => {
            try {
                const { set, appearance: importedAppearance } = deserializeSet(content);
                const id = set.id || Date.now().toString();
                const normalizedId = gridSets.some((s) => s.id === id) ? `${id}-${Date.now()}` : id;
                const normalizedSet = { ...set, id: normalizedId, appearance: importedAppearance };
                setGridSets((prev) => [...prev, normalizedSet]);
                setCurrentSetId(normalizedId);
                setCurrentSetName(normalizedSet.name);
                setSavedGrids(normalizedSet.grids || []);
                setAppearance({ ...DEFAULT_APPEARANCE, ...(importedAppearance || {}) });
                setShowSetDialog(false);
            } catch (error) {
                console.error('Import set error', error);
                window.alert('Impossible de charger ce set. Vérifiez le fichier.');
            }
        },
        [gridSets]
    );

    const readSetFile = useCallback((file?: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const content = typeof reader.result === 'string' ? reader.result : '';
            handleImportSetData(content);
        };
        reader.onerror = () => window.alert('Impossible de lire ce fichier.');
        reader.readAsText(file);
    }, [handleImportSetData]);
    
    const handleCellUpdate = useCallback((x: number, y: number, changes: Partial<Cell>) => {
        if (!state.currentGrid?.cells[y]?.[x]) return;

        const currentCell = state.currentGrid.cells[y][x];
        const newChanges = { ...changes };

        if ('isBlack' in changes) {
            if (changes.isBlack) {
                newChanges.value = '';
            }
        } else if ('value' in changes && currentCell.isBlack) {
            return;
        }

        dispatch({
            type: 'UPDATE_CELL',
            payload: { x, y, changes: newChanges }
        });
    }, [state.currentGrid, dispatch]);

    const moveSelection = (deltaX: number, deltaY: number, allowBlackSelection = false): boolean => {
        if (!state.selectedCell || !state.currentGrid) return false;
        const { x, y } = state.selectedCell;
        const { cells } = state.currentGrid;
        const targetX = x + deltaX;
        const targetY = y + deltaY;

        if (
            targetX < 0 ||
            targetY < 0 ||
            targetY >= cells.length ||
            targetX >= cells[0].length
        ) {
            return false;
        }

        const targetCell = cells[targetY][targetX];

        if (!allowBlackSelection && targetCell.isBlack) {
            return false;
        }

        dispatch({ type: 'SELECT_CELL', payload: { x: targetX, y: targetY } });
        return true;
    };

    const moveToPreviousCell = (): boolean => {
        if (state.selectedDirection === 'horizontal') {
            return moveSelection(-1, 0);
        }
        return moveSelection(0, -1);
    };

    const moveToNextCell = (): boolean => {
        if (state.selectedDirection === 'horizontal') {
            return moveSelection(1, 0);
        }
        return moveSelection(0, 1);
    };

    // Modifiez le handleKeyDown pour vérifier si le dialog est ouvert
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Si un input dans la toolbar est actif ou qu'aucun set n'est choisi, on ne gère pas les touches
        if (isToolbarInputActive || showSetDialog) return;

        if (!state.selectedCell || !state.currentGrid) return;

        const { x, y } = state.selectedCell;
        const { cells } = state.currentGrid;

        // Ajout de la gestion de la barre d'espace pour les cases noires
        if (event.key === ' ') {
            event.preventDefault();
            const isCurrentlyBlack = cells[y][x].isBlack;
            handleCellUpdate(x, y, {
                isBlack: !isCurrentlyBlack,
                value: '' // On efface la valeur quand on change en case noire
            });
            // On déplace automatiquement à la case suivante après avoir mis une case noire
            moveToNextCell();
            return;
        }

        if (event.key === 'Backspace' || event.key === 'Delete') {
            event.preventDefault();
            const currentCell = cells[y][x];

            if (!currentCell.isBlack) {
                if (currentCell.value) {
                    // Si la cellule actuelle contient une lettre, on la supprime
                    handleCellUpdate(x, y, { value: '' });
                    if (event.key === 'Backspace') {
                        // Pour Backspace, on recule après avoir effacé
                        moveToPreviousCell();
                    }
                } else {
                    // Si la cellule est vide
                    if (event.key === 'Backspace') {
                        // Pour Backspace, on recule et on efface la cellule précédente
                        if (moveToPreviousCell()) {
                            const newCell = state.selectedCell!;
                            handleCellUpdate(newCell.x, newCell.y, { value: '' });
                        }
                    }
                }
            }
            return;
        }

        if (event.key === 'Tab') {
            event.preventDefault();
            dispatch({
                type: 'SET_DIRECTION',
                payload: state.selectedDirection === 'horizontal' ? 'vertical' : 'horizontal'
            });
            return;
        }

        // Gestion des flèches directionnelles
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
                // Gestion des lettres
                if (event.key.length === 1 && event.key.match(/[a-zA-Z]/i)) {
                    event.preventDefault();
                    handleCellUpdate(x, y, { value: event.key.toUpperCase() });
                    moveToNextCell();
                }
        }
    }, [state.selectedCell, state.currentGrid, state.selectedDirection, handleCellUpdate, dispatch, isToolbarInputActive, showSetDialog]);

    React.useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const handleCellClick = (x: number, y: number) => {
        const isSameCell = state.selectedCell?.x === x && state.selectedCell?.y === y;
        dispatch({ type: 'SELECT_CELL', payload: isSameCell ? null : { x, y } });

        if (placementTargetWord) {
            attemptDefinitionPlacement(placementTargetWord, x, y);
        }
    };

    const handleResize = (width: number, height: number) => {
        dispatch({ type: 'RESIZE_GRID', payload: { width, height } });
    };

    const toggleDirection = () => {
        dispatch({
            type: 'SET_DIRECTION',
            payload: state.selectedDirection === 'horizontal' ? 'vertical' : 'horizontal'
        });
    };

    const isAdjacentTo = (cell: { x: number; y: number }, target: { x: number; y: number }) => {
        return Math.abs(cell.x - target.x) + Math.abs(cell.y - target.y) === 1;
    };

    React.useEffect(() => {
        if (!state.currentGrid) return;

        setWordDefinitions((prev) => {
            let hasChanges = false;
            const next = { ...prev };

            Object.entries(prev).forEach(([word, data]) => {
                const wordPosition = wordPositions.find((pos) => pos.word === word);

                if (!wordPosition) {
                    delete next[word];
                    hasChanges = true;
                    return;
                }

                if (data.placement) {
                    const cell = state.currentGrid!.cells[data.placement.y]?.[data.placement.x];
                    const stillBlack = cell?.isBlack;
                    const touchesStart = isAdjacentTo({ x: data.placement.x, y: data.placement.y }, wordPosition.start);
                    const touchesEnd = isAdjacentTo({ x: data.placement.x, y: data.placement.y }, wordPosition.end);

                    const anchorMatches =
                        data.placement.anchorRole === 'start'
                            ? touchesStart &&
                              data.placement.anchor.x === wordPosition.start.x &&
                              data.placement.anchor.y === wordPosition.start.y
                            : touchesEnd &&
                              data.placement.anchor.x === wordPosition.end.x &&
                              data.placement.anchor.y === wordPosition.end.y;

                    if (!stillBlack || !anchorMatches) {
                        next[word] = { ...data, placement: undefined };
                        hasChanges = true;
                    }
                }
            });

            return hasChanges ? next : prev;
        });
    }, [state.currentGrid, wordPositions]);

    const attemptDefinitionPlacement = useCallback((word: string, x: number, y: number) => {
        if (!state.currentGrid) return;

        const cell = state.currentGrid.cells[y][x];
        if (!cell.isBlack) {
            setPlacementTargetWord(null);
            return;
        }

        const placementsAtCell = Object.entries(wordDefinitions).filter(([, data]) =>
            data.placement && data.placement.x === x && data.placement.y === y
        );

        const alreadyPlacedHere = placementsAtCell.some(([placedWord]) => placedWord === word);
        if (placementsAtCell.length >= 2 && !alreadyPlacedHere) {
            setPlacementTargetWord(null);
            return;
        }

        const candidate = wordPositions.find((position) => {
            const touchesStart = isAdjacentTo({ x, y }, position.start);
            const touchesEnd = isAdjacentTo({ x, y }, position.end);
            return position.word === word && (touchesStart || touchesEnd);
        });

        if (!candidate) {
            setPlacementTargetWord(null);
            return;
        }

        const isStart = isAdjacentTo({ x, y }, candidate.start);
        const anchor = isStart ? candidate.start : candidate.end;
        const direction: 'up' | 'down' | 'left' | 'right' =
            anchor.x > x ? 'right' : anchor.x < x ? 'left' : anchor.y > y ? 'down' : 'up';

        setWordDefinitions((prev) => ({
            ...prev,
            [word]: {
                definition: prev[word]?.definition || '',
                placement: { x, y, direction, anchor, anchorRole: isStart ? 'start' : 'end', wordDirection: candidate.direction }
            }
        }));
        setSelectedWord(word);
        setPlacementTargetWord(null);
    }, [state.currentGrid, wordDefinitions, wordPositions]);

    const handleWordSelect = (word: string) => {
        setSelectedWord(word);
        setPlacementTargetWord(null);
    };

    const handleDefinitionChange = (value: string) => {
        if (!selectedWord) return;
        setWordDefinitions((prev) => ({
            ...prev,
            [selectedWord]: {
                ...prev[selectedWord],
                definition: value
            }
        }));
    };

    const handlePlacementRequest = () => {
        if (!selectedWord) return;
        setPlacementTargetWord(selectedWord);
    };

    const handleOutsideClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (gridAreaRef.current && !gridAreaRef.current.contains(event.target as Node)) {
            dispatch({ type: 'SELECT_CELL', payload: null });
            setPlacementTargetWord(null);
        }
    };

    const handleDirectionUpdate = (direction: 'up' | 'down' | 'left' | 'right') => {
        if (!selectedWord) return;
        setWordDefinitions((prev) => {
            const current = prev[selectedWord];
            if (!current?.placement) return prev;
            return {
                ...prev,
                [selectedWord]: {
                    ...current,
                    placement: { ...current.placement, direction }
                }
            };
        });
    };

    const { 
        wordsList,
        highlightedCells,
        definitionPlacements,
        arrowPlacements
    } = useMemo(() => {
        const words = new Set<string>();
        wordPositions.forEach((position) => words.add(position.word));

        let highlighted = new Set<string>();
        if (selectedWord) {
            const occurrence = wordPositions.find((pos) => pos.word === selectedWord);
            if (occurrence) {
                highlighted = new Set(occurrence.cells.map((cell) => `${cell.x}-${cell.y}`));
            }
        }

        const { definitionPlacements: placements, arrowPlacements: arrows } = buildPlacementsForGrid(
            state.currentGrid || undefined,
            filteredDefinitions
        );

        return {
            wordsList: Array.from(words).sort(),
            highlightedCells: highlighted,
            definitionPlacements: placements,
            arrowPlacements: arrows
        };
    }, [filteredDefinitions, selectedWord, wordPositions, state.currentGrid]);

    return (
        <div className="crossword-editor" onMouseDown={handleOutsideClick} style={appearanceVars}>
            {showSetDialog && (
                <div className="set-dialog-backdrop">
                    <div className="set-dialog">
                        <h3>Choisir ou créer un set de grilles</h3>
                        <div className="dialog-section">
                            <label className="input-label">Nom du nouveau set</label>
                            <input
                                type="text"
                                value={newSetName}
                                onChange={(e) => setNewSetName(e.target.value)}
                                className="grid-name-input"
                            />
                            <button className="action-button" onClick={() => handleCreateNewSet(newSetName)}>
                                Nouveau set de grille
                            </button>
                            <button
                                className="tool-button"
                                type="button"
                                onClick={() => dialogSetFileInput.current?.click()}
                            >
                                Charger un set local
                            </button>
                        </div>
                        <div className="dialog-section">
                            <label className="input-label">Charger un set existant</label>
                            <div className="dialog-set-list">
                                {gridSets.length > 0 ? (
                                    gridSets.map((set) => (
                                        <div
                                            key={set.id}
                                            className={`saved-grid-item ${set.id === currentSetId ? 'active' : ''}`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => handleSelectSet(set.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    handleSelectSet(set.id);
                                                }
                                            }}
                                        >
                                            <div className="saved-grid-labels">
                                                <div>{set.name}</div>
                                                <small>{set.grids.length} grilles</small>
                                            </div>
                                            <button
                                                type="button"
                                                className="tool-button"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    handleDeleteSet(set.id);
                                                }}
                                            >
                                                Supprimer
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="no-grids">Aucun set disponible</div>
                                )}
                            </div>
                        </div>
                        {currentSetId && (
                            <button className="tool-button" onClick={() => setShowSetDialog(false)}>
                                Continuer avec {currentSetName}
                            </button>
                        )}
                    </div>
                </div>
            )}
            <input
                ref={dialogSetFileInput}
                type="file"
                accept=".json,.txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    readSetFile(file);
                    e.target.value = '';
                }}
            />
            <Toolbar
                onResize={handleResize}
                currentGrid={state.currentGrid}
                definitions={filteredDefinitions}
                onInputFocus={setIsToolbarInputActive}
                appearance={appearance}
                onAppearanceChange={applyAppearanceChanges}
                savedGrids={savedGrids}
                onSavedGridsChange={handleSavedGridsChange}
                onGridLoad={handleGridLoad}
                gridSets={gridSets}
                currentSetName={currentSetName}
                onSetNameChange={handleSetNameChange}
                onNewSet={() => handleCreateNewSet()}
                onExportSet={handleExportSet}
                onImportSetData={handleImportSetData}
                onExportGridPdf={handleExportGridPdf}
                onExportSetPdf={handleExportSetPdf}
                onSelectSet={handleSelectSet}
                currentSetId={currentSetId}
            />
            <div className="editor-container">
                <div className="editor-main">
                    <div className="grid-area" ref={gridAreaRef}>
                        {state.currentGrid && (
                            <CrosswordGrid
                                cells={state.currentGrid.cells}
                                onCellClick={handleCellClick}
                                onCellUpdate={handleCellUpdate}
                                selectedCell={state.selectedCell}
                                selectedDirection={state.selectedDirection}
                                onDirectionChange={toggleDirection}
                                highlightedCells={highlightedCells}
                                definitionPlacements={definitionPlacements}
                                arrowPlacements={arrowPlacements}
                            />
                        )}
                    </div>
                </div>
                <div className="words-sidebar">
                    <h3>Mots trouvés ({wordsList.length})</h3>
                    <div className="words-list">
                        {wordsList.map((word, index) => {
                            const wordData = wordDefinitions[word];
                            return (
                                <button
                                    key={`${word}-${index}`}
                                    className={`word-item ${selectedWord === word ? 'active' : ''}`}
                                    onClick={() => handleWordSelect(word)}
                                >
                                    <span className="word-label">{word}</span>
                                    <span className="word-flags">
                                        {wordData?.definition && <span title="Définition ajoutée">📝</span>}
                                        {wordData?.placement && <span title="Emplacement choisi">📍</span>}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {selectedWord && (
                        <div className="word-details">
                            <div className="details-header">
                                <h4>{selectedWord}</h4>
                                {placementTargetWord === selectedWord && <span className="placement-hint">Cliquez sur une case noire adjacente au mot</span>}
                            </div>
                            <label className="input-label">Définition</label>
                            <textarea
                                value={wordDefinitions[selectedWord]?.definition || ''}
                                onChange={(e) => handleDefinitionChange(e.target.value)}
                                onFocus={() => dispatch({ type: 'SELECT_CELL', payload: null })}
                                placeholder="Écrire ou coller la définition du mot"
                            />
                            <div className="definition-actions">
                                <button
                                    type="button"
                                    className={placementTargetWord === selectedWord ? 'primary' : ''}
                                    onClick={handlePlacementRequest}
                                >
                                    Sélectionner l'emplacement de la définition
                                </button>
                            </div>
                            {wordDefinitions[selectedWord]?.placement && (
                                <div className="placement-summary">
                                    <div>
                                        Case noire : ({wordDefinitions[selectedWord]!.placement!.x + 1}, {wordDefinitions[selectedWord]!.placement!.y + 1})
                                    </div>
                                    <label className="input-label">Orientation de la flèche</label>
                                    <select
                                        value={wordDefinitions[selectedWord]!.placement!.direction}
                                        onChange={(e) => handleDirectionUpdate(e.target.value as 'up' | 'down' | 'left' | 'right')}
                                    >
                                        <option value="up">↑ Vers le haut</option>
                                        <option value="down">↓ Vers le bas</option>
                                        <option value="left">← Vers la gauche</option>
                                        <option value="right">→ Vers la droite</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};