<script lang="ts">
    import type { Cell } from '../../models/types';
    import type { ArrowPlacement, DefinitionMarker } from '../../lib/crossword';
    import './CrosswordGrid.css';

    const BASE_CELL_SIZE = 40;

    interface Props {
        cells: Cell[][];
        selectedCell: { x: number; y: number } | null;
        highlightedCells?: Set<string>;
        candidateCells?: Set<string>;
        duplicateCells?: Set<string>;
        separators?: Set<string>;
        pendingCell?: { x: number; y: number } | null;
        definitionPlacements?: Record<string, DefinitionMarker[]>;
        arrowPlacements?: Record<string, ArrowPlacement[]>;
        hideLetters?: boolean;
        onCellClick: (x: number, y: number) => void;
        onBlackCellClick?: (x: number, y: number) => void;
    }

    let {
        cells,
        selectedCell,
        highlightedCells,
        candidateCells,
        duplicateCells,
        separators,
        pendingCell,
        definitionPlacements,
        arrowPlacements,
        hideLetters = false,
        onCellClick,
        onBlackCellClick
    }: Props = $props();

    const computeFitFontSize = (text: string, slotCount: number) => {
        const availableWidth = BASE_CELL_SIZE - 6;
        const availableHeight = (BASE_CELL_SIZE - 6) / Math.max(1, slotCount) - 2;
        const words = text.split(/\s+/).filter(Boolean);
        const longestWord = words.reduce((max, w) => Math.max(max, w.length), 0);

        const maxHeightSize = availableHeight / Math.max(1, words.length) / 1.35;
        const maxWidthSize = longestWord > 0 ? availableWidth / (longestWord * 0.65) : 18;
        const slotPenalty = slotCount > 1 ? 0.86 : 1;
        const upperBound = Math.min(14, maxHeightSize, maxWidthSize) * slotPenalty;

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

    // Petit repère coudé près du bord d'entrée, sans recouvrir la lettre (repère 0..100, y vers le bas).
    const arrowGeom = (entry: ArrowPlacement['entry'], bodyDir: ArrowPlacement['bodyDir'], slotIndex = 0, slotCount = 1) => {
        const base = entry === 'left' ? [0, 50] : entry === 'right' ? [100, 50] : entry === 'top' ? [50, 0] : [50, 100];
        // Sur un bord vertical (gauche/droite), la flèche part du milieu de son
        // segment de définition ; sur un bord horizontal elle reste centrée.
        const vertical = entry === 'left' || entry === 'right';
        const shift = vertical && slotCount > 1 ? ((slotIndex + 0.5) / slotCount - 0.5) * 100 : 0;
        const edge = [base[0], base[1] + shift];
        const inw = entry === 'left' ? [1, 0] : entry === 'right' ? [-1, 0] : entry === 'top' ? [0, 1] : [0, -1];
        const bd = bodyDir === 'left' ? [-1, 0] : bodyDir === 'right' ? [1, 0] : bodyDir === 'up' ? [0, -1] : [0, 1];
        const straight = inw[0] === bd[0] && inw[1] === bd[1];
        const lenS = 20;
        const lenE = 13;
        const pts = straight
            ? [edge, [edge[0] + bd[0] * lenS, edge[1] + bd[1] * lenS]]
            : [
                  edge,
                  [edge[0] + inw[0] * lenE, edge[1] + inw[1] * lenE],
                  [edge[0] + inw[0] * lenE + bd[0] * lenE, edge[1] + inw[1] * lenE + bd[1] * lenE]
              ];
        const tip = pts[pts.length - 1];
        const perp = [-bd[1], bd[0]];
        const ah = 7;
        const back = [tip[0] - bd[0] * ah, tip[1] - bd[1] * ah];
        const w1 = [back[0] + perp[0] * ah * 0.6, back[1] + perp[1] * ah * 0.6];
        const w2 = [back[0] - perp[0] * ah * 0.6, back[1] - perp[1] * ah * 0.6];
        return {
            line: pts.map((p) => `${p[0]},${p[1]}`).join(' '),
            head: `${w1[0]},${w1[1]} ${tip[0]},${tip[1]} ${w2[0]},${w2[1]}`
        };
    };

    const gridWidth = $derived(cells[0]?.length || 0);
    const gridHeight = $derived(cells.length);
    const boardStyle = $derived(
        `grid-template-columns: repeat(${gridWidth}, var(--grid-cell-size, ${BASE_CELL_SIZE}px));` +
            `grid-template-rows: repeat(${gridHeight}, var(--grid-cell-size, ${BASE_CELL_SIZE}px));`
    );
</script>

<div class="crossword-grid-container">
    <div class="crossword-grid" style={boardStyle}>
        {#each cells as row, rowIndex (rowIndex)}
            {#each row as cell (`${cell.x}-${cell.y}`)}
                {@const key = `${cell.x}-${cell.y}`}
                {@const definitions = definitionPlacements?.[key]}
                {@const arrows = arrowPlacements?.[key]}
                {@const slotCount = definitions?.length ?? 1}
                <div
                    class="grid-cell"
                    class:black={cell.isBlack}
                    class:selected={selectedCell?.x === cell.x && selectedCell?.y === cell.y}
                    class:highlighted={highlightedCells?.has(key)}
                    class:candidate={candidateCells?.has(key)}
                    class:duplicate={duplicateCells?.has(key)}
                    class:pending={pendingCell?.x === cell.x && pendingCell?.y === cell.y}
                    class:sep-right={separators?.has(`${cell.x}-${cell.y}-r`)}
                    class:sep-bottom={separators?.has(`${cell.x}-${cell.y}-b`)}
                    onclick={() => {
                        onCellClick(cell.x, cell.y);
                        if (cell.isBlack && onBlackCellClick) onBlackCellClick(cell.x, cell.y);
                    }}
                    role="button"
                    tabindex="-1"
                    onkeydown={() => {}}
                >
                    {#if !cell.isBlack && !hideLetters}{cell.value}{/if}

                    {#if cell.isBlack && definitions && definitions.length > 0}
                        <div class="definition-markers" class:multiple={definitions.length > 1}>
                            {#each definitions as definition, index (`${definition.word}-${index}`)}
                                {@const markerText = (definition.definition || definition.word).toUpperCase()}
                                <div
                                    class="definition-marker"
                                    style:background-color={definition.segmentColor || 'var(--grid-black-color, #000)'}
                                >
                                    <span
                                        class="definition-text"
                                        style:--fit-size={`${definition.segmentFontSize || computeFitFontSize(markerText, slotCount)}px`}
                                        style:color={definition.segmentTextColor}
                                    >
                                        {markerText}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    {/if}

                    {#if !cell.isBlack && arrows && arrows.length > 0}
                        <svg class="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            {#each arrows as arrow, index (index)}
                                {@const geom = arrowGeom(arrow.entry, arrow.bodyDir, arrow.slotIndex, arrow.slotCount)}
                                <polyline points={geom.line} fill="none" stroke="var(--grid-arrow-color, #666)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
                                <polyline points={geom.head} fill="none" stroke="var(--grid-arrow-color, #666)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
                            {/each}
                        </svg>
                    {/if}
                </div>
            {/each}
        {/each}
    </div>
</div>
