// src/context/CrosswordContext.tsx
import React, { createContext, useContext, useReducer } from 'react';
import type {
    Grid, 
    Cell, 
    Direction,
    GameState,
    GameConfig 
} from '../models/types';

const createEmptyGrid = (width: number, height: number): Cell[][] => {
    return Array(height).fill(null).map((_, y) =>
        Array(width).fill(null).map((_, x) => ({
            value: '',
            isBlack: false,
            x,
            y,
            isHighlighted: false
        }))
    );
};

interface CrosswordState {
    currentGrid: Grid | null;
    gameState: GameState;
    config: GameConfig;
    selectedCell: { x: number; y: number } | null;
    selectedDirection: Direction;
}

const initialState: CrosswordState = {
    currentGrid: {
        cells: createEmptyGrid(15, 15),
        size: {
            width: 15,
            height: 15
        },
        words: [],
        status: 'initial'
    },
    gameState: {
        isEditing: true,
        isComplete: false,
        timer: 0,
        score: 0
    },
    config: {
        allowHints: true,
        timerEnabled: true,
        difficulty: 'medium',
        language: 'fr',
        gridSize: {
            width: 15,
            height: 15
        }
    },
    selectedCell: null,
    selectedDirection: 'horizontal'
};

// Modifier la définition de CrosswordAction pour ajouter l'action LOAD_GRID
export type CrosswordAction =
    | { type: 'SELECT_CELL'; payload: { x: number; y: number } | null }
    | { type: 'UPDATE_CELL'; payload: { x: number; y: number; changes: Partial<Cell> } }
    | { type: 'RESIZE_GRID'; payload: { width: number; height: number } }
    | { type: 'SET_DIRECTION'; payload: Direction }
    | { type: 'LOAD_GRID'; payload: Grid }; // Ajout de cette ligne

interface CrosswordContextType {
    state: CrosswordState;
    dispatch: React.Dispatch<CrosswordAction>;
}

const CrosswordContext = createContext<CrosswordContextType | undefined>(undefined);

// Dans le reducer, ajouter le case pour LOAD_GRID
function crosswordReducer(state: CrosswordState, action: CrosswordAction): CrosswordState {
    switch (action.type) {
        case 'SELECT_CELL':
            return {
                ...state,
                selectedCell: action.payload
            };
            
        case 'UPDATE_CELL': {
            if (!state.currentGrid) return state;
            
            const newCells = state.currentGrid.cells.map((row, y) =>
                row.map((cell, x) => {
                    if (x === action.payload.x && y === action.payload.y) {
                        return { ...cell, ...action.payload.changes };
                    }
                    return cell;
                })
            );
            
            return {
                ...state,
                currentGrid: {
                    ...state.currentGrid,
                    cells: newCells
                }
            };
        }
            
        case 'RESIZE_GRID': {
            const { width, height } = action.payload;
            if (width <= 0 || height <= 0) return state;
            
            return {
                ...state,
                currentGrid: {
                    ...state.currentGrid!,
                    cells: createEmptyGrid(width, height),
                    size: { width, height }
                },
                config: {
                    ...state.config,
                    gridSize: { width, height }
                }
            };
        }
            
        case 'SET_DIRECTION':
            return {
                ...state,
                selectedDirection: action.payload
            };
            
        // ... autres cases existants ...
        
        case 'LOAD_GRID':
            return {
                ...state,
                currentGrid: action.payload
            };
            
        default:
            return state;
    }
}

export const CrosswordProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(crosswordReducer, initialState);
    return (
        <CrosswordContext.Provider value={{ state, dispatch }}>
            {children}
        </CrosswordContext.Provider>
    );
};

// Déplacer le hook dans un fichier séparé pour éviter l'erreur react-refresh
// src/hooks/useCrossword.ts
export const useCrossword = (): CrosswordContextType => {
    const context = useContext(CrosswordContext);
    if (!context) {
        throw new Error('useCrossword must be used within a CrosswordProvider');
    }
    return context;
};