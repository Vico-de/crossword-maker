// components/grid/CrosswordGrid.tsx
import React from 'react';
import type { Cell as CellType } from '../../models/types';
import './CrosswordGrid.css';

type DefinitionDirection = 'up' | 'down' | 'left' | 'right';

interface DefinitionMarker {
    word: string;
    definition?: string;
    direction: DefinitionDirection;
}

interface CellProps {
    value: string;
    isBlack: boolean;
    isSelected: boolean;
    x: number;
    y: number;
    isHighlighted?: boolean;
    definitions?: DefinitionMarker[];
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
    onClick,
    onChange
}) => {
    const cellClassName = `grid-cell ${isBlack ? 'black' : ''} ${
        isSelected ? 'selected' : ''
    } ${isHighlighted ? 'highlighted' : ''}`;

    const containerLayout = React.useMemo(() => {
        if (!definitions || definitions.length < 2) return '';
        const hasHorizontal = definitions.some(def => def.direction === 'left' || def.direction === 'right');
        const hasVertical = definitions.some(def => def.direction === 'up' || def.direction === 'down');

        if (hasHorizontal && !hasVertical) return 'split-vertical';
        if (hasVertical && !hasHorizontal) return 'split-horizontal';
        return 'split-mixed';
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
                            className={`definition-marker direction-${definition.direction}`}
                        >
                            <span className="arrow">{directionSymbol[definition.direction]}</span>
                            <span className="definition-text">{definition.definition || definition.word}</span>
                        </div>
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