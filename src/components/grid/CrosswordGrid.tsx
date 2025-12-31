// components/grid/CrosswordGrid.tsx
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

    const lineCountForSize = (size: number) => {
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length === 0) return 1;

        const charWidth = 0.55 * size;
        const maxLineWidth = availableWidth;
        let currentLineWidth = 0;
        let lines = 1;

        for (const word of words) {
            const wordWidth = word.length * charWidth;
            if (wordWidth > maxLineWidth) return Number.POSITIVE_INFINITY;

            if (currentLineWidth === 0) {
                currentLineWidth = wordWidth;
            } else if (currentLineWidth + charWidth + wordWidth <= maxLineWidth) {
                currentLineWidth += charWidth + wordWidth;
            } else {
                lines += 1;
                currentLineWidth = wordWidth;
            }
        }

        return lines;
    };

    for (let size = 18; size >= 6; size -= 1) {
        const lines = lineCountForSize(size);
        const totalHeight = lines * size * 1.1;

        if (lines !== Number.POSITIVE_INFINITY && totalHeight <= availableHeight) {
            return size;
        }
    }

    return 6;
};

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
    const borderColor = 'var(--grid-border-color, #ccc)';
    const cellStyle: React.CSSProperties = {
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        borderTop: y === 0 ? `1px solid ${borderColor}` : 'none',
        borderLeft: x === 0 ? `1px solid ${borderColor}` : 'none'
    };

    return (
        <div
            className={cellClassName}
            onClick={onClick}
            style={cellStyle}
        >
            {!isBlack && value}
            {isBlack && definitions && definitions.length > 0 && (
                <div className={`definition-markers ${definitions.length > 1 ? 'multiple' : ''}`}>
                    {definitions.map((definition, index) => (
                        (() => {
                            const markerText = (definition.definition || definition.word).toUpperCase();
                            return (
                        <div
                            key={`${definition.word}-${index}`}
                            className="definition-marker"
                        >
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
    return (
        <div className="crossword-grid-container">
            <button 
                className="direction-indicator"
                onClick={onDirectionChange}
                title="Changer de direction (Tab)"
            >
                {selectedDirection === 'horizontal' ? '→' : '↓'}
            </button>
            <div className="crossword-grid">
                {cells.map((row, y) => (
                    <div key={y} className="grid-row">
                        {row.map((cell, x) => (
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
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};