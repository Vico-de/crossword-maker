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

const directionSymbol: Record<DefinitionDirection, string> = {
    up: '↑',
    down: '↓',
    left: '←',
    right: '→'
};

const CrosswordCell: React.FC<CellProps> = ({
    value,
    isBlack,
    isSelected,
    isHighlighted,
    definitions,
    arrows,
    onClick,
    onChange
}) => {
    const cellClassName = `grid-cell ${isBlack ? 'black' : ''} ${
        isSelected ? 'selected' : ''
    } ${isHighlighted ? 'highlighted' : ''}`;

    const containerLayout = React.useMemo(() => {
        if (!definitions || definitions.length < 2) return '';
        return 'multiple';
    }, [definitions]);

    return (
        <div
            className={cellClassName}
            onClick={onClick}
        >
            {!isBlack && value}
            {isBlack && definitions && definitions.length > 0 && (
                <div className={`definition-markers ${containerLayout}`}>
                    {definitions.map((definition, index) => (
                        <div
                            key={`${definition.word}-${index}`}
                            className="definition-marker"
                        >
                            <span
                                className="definition-text"
                                style={{
                                    ['--fit-length' as string]: Math.max(
                                        4,
                                        (definition.definition || definition.word).length
                                    )
                                }}
                            >
                                {definition.definition || definition.word}
                            </span>
                        </div>
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