// Sérialisation compacte de la base de grilles (et import de l'ancien format set).
import type { Cell, Grid, SavedGrid, WordDefinitionData, WordDefinitionPlacement } from '../models/types';
import type {WordDirection} from "./words"

type PackedDefinition = [
    string,
    string,
    (
        | [
              number,
              number,
              WordDefinitionPlacement['direction'],
              [number, number],
              WordDefinitionPlacement['anchorRole'],
              WordDirection,
              WordDefinitionPlacement['arrowStyle']?,
              WordDefinitionPlacement['curvedVariant']?,
              WordDefinitionPlacement['attachment']?
          ]
        | undefined
    )
];

const packDefinitions = (definitions: Record<string, WordDefinitionData>): PackedDefinition[] =>
    Object.entries(definitions).map(([word, data]) => [
        word,
        data.definition,
        data.placement
            ? [
                  data.placement.x,
                  data.placement.y,
                  data.placement.direction,
                  [data.placement.anchor.x, data.placement.anchor.y],
                  data.placement.anchorRole,
                  data.placement.wordDirection,
                  data.placement.arrowStyle,
                  data.placement.curvedVariant,
                  data.placement.attachment
              ]
            : undefined
    ]);

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
                          wordDirection: placement[5],
                          arrowStyle: placement[6] || 'auto',
                          curvedVariant: placement[7],
                          attachment: placement[8]
                      }
                    : undefined
        };
    });
    return result;
};

// Sérialise la grille en notation compacte (lettre, # pour noire, . pour vide).
const packGrid = (grid: Grid) => ({
    n: grid.name || '',
    s: [grid.size.width, grid.size.height],
    r: grid.cells.map((row) => row.map((cell) => (cell.isBlack ? '#' : cell.value || '.')).join(''))
});

const unpackGrid = (packed: { n?: string; s: [number, number]; r: string[] }): Grid => {
    const [width, height] = packed.s;
    const cells: Cell[][] = Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (__, x) => {
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

    return { name: packed.n || '', size: { width, height }, cells, words: [], status: 'loaded' };
};

// Sérialise toute la base de grilles (le tag de set est stocké par grille).
export const serializeDatabase = (grids: SavedGrid[]) =>
    JSON.stringify({
        v: 2,
        g: grids.map((g) => ({
            i: g.id,
            n: g.name,
            s: g.grid.set || '',
            t: g.timestamp,
            r: packGrid(g.grid),
            d: packDefinitions(g.definitions || {}),
            p: g.pool || {},
            sep: g.grid.separators || []
        }))
    });

// Restaure soit une base exportée (nouveau format v2), soit un ancien set
// exporté (ancien format) — dans ce cas les grilles reçoivent le nom du set
// comme tag. Renvoie toujours une liste de grilles.
export const deserializeDatabase = (raw: string): SavedGrid[] => {
    const parsed = JSON.parse(raw);
    const toGrid = (e: any, fallbackSet: string): SavedGrid => ({
        id: String(e.i ?? Date.now().toString()),
        name: e.n || 'Grille',
        timestamp: e.t || Date.now(),
        grid: { ...unpackGrid(e.r), set: (e.s ?? fallbackSet) || '', separators: Array.isArray(e.sep) ? e.sep : [] },
        definitions: unpackDefinitions(e.d || []),
        pool: e.p && typeof e.p === 'object' ? e.p : undefined
    });

    if (parsed && parsed.v === 2 && Array.isArray(parsed.g)) {
        return parsed.g.map((e: any) => toGrid(e, ''));
    }
    // Ancien format : un set unique { i, n, a, g: [...] }
    if (parsed && Array.isArray(parsed.g)) {
        return parsed.g.map((e: any) => toGrid(e, parsed.n || 'Set importé'));
    }
    return [];
};
