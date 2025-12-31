// components/grid/CrosswordGrid.tsx
// Rendu de la grille : on utilise une grille CSS avec un espacement uniforme
// pour éviter les doubles bordures et garder des cellules strictement carrées.
import React from 'react';
import type { Cell as CellType } from '../../models/types';
import './CrosswordGrid.css';

type DefinitionDirection = 'up' | 'down' | 'left' | 'right';

interface DefinitionMarker {
    word: string;
    definition?: string;
}

interface ArrowMarker {
    direction: DefinitionDirection;
    variant?: 'straight' | 'curved-right' | 'curved-left';
    from: { x: number; y: number };
    attachment?: 'left' | 'right' | 'top' | 'bottom';
}

interface CellProps {
    value: string;
    isBlack: boolean;
    isSelected: boolean;
    x: number;
    y: number;
    isHighlighted?: boolean;
    definitions?: DefinitionMarker[];
    arrows?: ArrowMarker[];
    onClick: () => void;
    onChange: (changes: Partial<CellType>) => void;
}

const BASE_CELL_SIZE = 40;

const computeFitFontSize = (text: string, slotCount: number) => {
    const availableWidth = BASE_CELL_SIZE - 6;
    const availableHeight = (BASE_CELL_SIZE - 6) / Math.max(1, slotCount) - 2;
    const words = text.split(/\s+/).filter(Boolean);
    const longestWord = words.reduce((max, w) => Math.max(max, w.length), 0);

    const maxHeightSize = availableHeight / Math.max(1, words.length) / 1.15;
    const maxWidthSize = longestWord > 0 ? availableWidth / (longestWord * 0.65) : 18;
    const upperBound = Math.min(18, maxHeightSize, maxWidthSize);

    for (let size = Math.floor(upperBound); size >= 4; size -= 1) {
        const charWidth = 0.52 * size;
        const maxLineWidth = availableWidth;
        let currentLineWidth = 0;
        let lines = 1;
        let fits = true;

        for (const word of words) {
            const wordWidth = word.length * charWidth;
            if (wordWidth > maxLineWidth) {
                fits = false;
                break;
            }

            if (currentLineWidth === 0) {
                currentLineWidth = wordWidth;
            } else if (currentLineWidth + charWidth + wordWidth <= maxLineWidth) {
                currentLineWidth += charWidth + wordWidth;
            } else {
                lines += 1;
                if (lines * size * 1.1 > availableHeight) {
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

// Cellule individuelle de la grille (blanche ou noire).
const CrosswordCell: React.FC<CellProps> = ({
    value,
    isBlack,
    isSelected,
    isHighlighted,
    definitions,
    arrows,
    onClick,
    onChange,
    x,
    y
}) => {
    const cellClassName = `grid-cell ${isBlack ? 'black' : ''} ${
        isSelected ? 'selected' : ''
    } ${isHighlighted ? 'highlighted' : ''}`;

    const slotCount = definitions?.length ?? 1;

    return (
        <div className={cellClassName} onClick={onClick}>
            {!isBlack && value}
            {isBlack && definitions && definitions.length > 0 && (
                <div className={`definition-markers ${definitions.length > 1 ? 'multiple' : ''}`}>
                    {definitions.map((definition, index) => (
                        (() => {
                            const markerText = (definition.definition || definition.word).toUpperCase();
                            return (
                                <div key={`${definition.word}-${index}`} className="definition-marker">
                                    <span
                                        className="definition-text"
                                        style={{
                                            ['--fit-size' as string]: `${computeFitFontSize(
                                                markerText,
                                                slotCount
                                            )}px`
                                        }}
                                    >
                                        {markerText}
                                    </span>
                                </div>
                            );
                        })()
                    ))}
                </div>
            )}
            {!isBlack && arrows && arrows.length > 0 && (
                <div className="arrow-markers">
                    {arrows.map((arrow, index) => (
                        <span
                            key={`${arrow.direction}-${index}`}
                            className={`arrow-marker arrow-${arrow.direction} ${
                                arrow.variant === 'straight'
                                    ? ''
                                    : arrow.variant === 'curved-left'
                                      ? 'curved-left'
                                      : 'curved-right'
                            } ${arrow.attachment ? `attach-${arrow.attachment}` : ''}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface CrosswordGridProps {
    cells: CellType[][];
    onCellClick: (x: number, y: number) => void;
    onCellUpdate: (x: number, y: number, changes: Partial<CellType>) => void;
    selectedCell: { x: number; y: number } | null;
    selectedDirection: 'horizontal' | 'vertical';
    onDirectionChange: () => void;
    highlightedCells?: Set<string>;
    definitionPlacements?: Record<string, DefinitionMarker[]>;
    arrowPlacements?: Record<string, ArrowMarker[]>;
    onBlackCellClick?: (x: number, y: number) => void;
}

export const CrosswordGrid: React.FC<CrosswordGridProps> = ({
    cells,
    onCellClick,
    onCellUpdate,
    selectedCell,
    selectedDirection,
    onDirectionChange,
    highlightedCells,
    definitionPlacements,
    arrowPlacements,
    onBlackCellClick
}) => {
    const gridWidth = cells[0]?.length || 0;
    const gridHeight = cells.length;
    const boardStyle: React.CSSProperties = {
        gridTemplateColumns: `repeat(${gridWidth}, var(--grid-cell-size, ${BASE_CELL_SIZE}px))`,
        gridTemplateRows: `repeat(${gridHeight}, var(--grid-cell-size, ${BASE_CELL_SIZE}px))`
    };

    return (
        <div className="crossword-grid-container">
            <button
                className="direction-indicator"
                onClick={onDirectionChange}
                title="Changer de direction (Tab)"
            >
                {selectedDirection === 'horizontal' ? '→' : '↓'}
            </button>
            <div className="crossword-grid" style={boardStyle}>
                {cells.flatMap((row, y) =>
                    row.map((cell, x) => (
                        <CrosswordCell
                            key={`${x}-${y}`}
                            {...cell}
                            x={x}
                            y={y}
                            isSelected={selectedCell?.x === x && selectedCell?.y === y}
                            isHighlighted={highlightedCells?.has(`${x}-${y}`)}
                            definitions={definitionPlacements?.[`${x}-${y}`]}
                            arrows={arrowPlacements?.[`${x}-${y}`]}
                            onClick={() => {
                                onCellClick(x, y);
                                if (cell.isBlack && onBlackCellClick) {
                                    onBlackCellClick(x, y);
                                }
                            }}
                            onChange={(changes) => onCellUpdate(x, y, changes)}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
