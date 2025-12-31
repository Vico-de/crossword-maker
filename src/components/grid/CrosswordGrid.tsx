// components/grid/CrosswordGrid.tsx
import React from 'react';
import type { Cell as CellType } from '../../models/types';
import './CrosswordGrid.css';

interface CellProps {
    value: string;
    isBlack: boolean;
    isSelected: boolean;
    x: number;
    y: number;
    isHighlighted?: boolean;
    onClick: () => void;
    onChange: (changes: Partial<CellType>) => void;
}

const CrosswordCell: React.FC<CellProps> = ({
    value,
    isBlack,
    isSelected,
    isHighlighted,
    onClick,
    onChange
}) => {
    const cellClassName = `grid-cell ${isBlack ? 'black' : ''} ${
        isSelected ? 'selected' : ''
    } ${isHighlighted ? 'highlighted' : ''}`;

    return (
        <div
            className={cellClassName}
            onClick={onClick}
        >
            {!isBlack && value}
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
}

export const CrosswordGrid: React.FC<CrosswordGridProps> = ({
    cells,
    onCellClick,
    onCellUpdate,
    selectedCell,
    selectedDirection,
    onDirectionChange
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
                                onClick={() => onCellClick(x, y)}
                                onChange={(changes) => onCellUpdate(x, y, changes)}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};