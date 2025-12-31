import React, { useCallback, useMemo, useState } from 'react';
import { CrosswordGrid } from '../components/grid/CrosswordGrid';
import { Toolbar } from '../components/toolbar/Toolbar';
import { useCrossword } from '../context/CrosswordContext';
import type { Cell } from '../models/types';

// Supprimez l'import de SaveManager et SavedGrid s'ils existent

// Ajoutez cette fonction helper avant le composant CrosswordEditor
const extractWords = (cells: Cell[][]) => {
    const words = new Set<string>();
    
    // Extraction des mots horizontaux
    for (let y = 0; y < cells.length; y++) {
        let currentWord = '';
        for (let x = 0; x < cells[0].length; x++) {
            if (!cells[y][x].isBlack && cells[y][x].value) {
                currentWord += cells[y][x].value;
            } else if (currentWord.length > 1) {
                words.add(currentWord);
                currentWord = '';
            } else {
                currentWord = '';
            }
        }
        if (currentWord.length > 1) {
            words.add(currentWord);
        }
    }

    // Extraction des mots verticaux
    for (let x = 0; x < cells[0].length; x++) {
        let currentWord = '';
        for (let y = 0; y < cells.length; y++) {
            if (!cells[y][x].isBlack && cells[y][x].value) {
                currentWord += cells[y][x].value;
            } else if (currentWord.length > 1) {
                words.add(currentWord);
                currentWord = '';
            } else {
                currentWord = '';
            }
        }
        if (currentWord.length > 1) {
            words.add(currentWord);
        }
    }

    return Array.from(words).sort();
};

export const CrosswordEditor: React.FC = () => {
    const { state, dispatch } = useCrossword();
    const [isToolbarInputActive, setIsToolbarInputActive] = useState(false);
    // Supprimez la ligne avec setIsSaveDialogOpen si elle existe
    
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

    // Déplacez la déclaration de moveToNextCell avant son utilisation
    const moveToPreviousCell = (): boolean => {
        if (!state.selectedCell || !state.currentGrid) return false;
        const { x, y } = state.selectedCell;
        const { cells } = state.currentGrid;
        
        if (state.selectedDirection === 'horizontal') {
            let newX = x;
            while (newX > 0) {
                newX--;
                if (!cells[y][newX].isBlack) {
                    dispatch({ type: 'SELECT_CELL', payload: { x: newX, y } });
                    return true;
                }
            }
        } else {
            let newY = y;
            while (newY > 0) {
                newY--;
                if (!cells[newY][x].isBlack) {
                    dispatch({ type: 'SELECT_CELL', payload: { x, y: newY } });
                    return true;
                }
            }
        }
        return false;
    };

    const moveToNextCell = (): boolean => {
        if (!state.selectedCell || !state.currentGrid) return false;
        const { x, y } = state.selectedCell;
        const { cells } = state.currentGrid;
        
        if (state.selectedDirection === 'horizontal') {
            let newX = x;
            while (newX < cells[0].length - 1) {
                newX++;
                if (!cells[y][newX].isBlack) {
                    dispatch({ type: 'SELECT_CELL', payload: { x: newX, y } });
                    return true;
                }
            }
        } else {
            let newY = y;
            while (newY < cells.length - 1) {
                newY++;
                if (!cells[newY][x].isBlack) {
                    dispatch({ type: 'SELECT_CELL', payload: { x, y: newY } });
                    return true;
                }
            }
        }
        return false;
    };

    // Modifiez le handleKeyDown pour vérifier si le dialog est ouvert
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Si un input dans la toolbar est actif, on ne gère pas les touches
        if (isToolbarInputActive) return;

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
                if (state.selectedDirection === 'horizontal') {
                    moveToPreviousCell();
                }
                break;
            case 'ArrowRight':
                event.preventDefault();
                if (state.selectedDirection === 'horizontal') {
                    moveToNextCell();
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (state.selectedDirection === 'vertical') {
                    moveToPreviousCell();
                }
                break;
            case 'ArrowDown':
                event.preventDefault();
                if (state.selectedDirection === 'vertical') {
                    moveToNextCell();
                }
                break;
            default:
                // Gestion des lettres
                if (event.key.length === 1 && event.key.match(/[a-zA-Z]/i)) {
                    event.preventDefault();
                    handleCellUpdate(x, y, { value: event.key.toUpperCase() });
                    moveToNextCell();
                }
        }
    }, [state.selectedCell, state.currentGrid, state.selectedDirection, handleCellUpdate, dispatch, isToolbarInputActive]);

    React.useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const handleCellClick = (x: number, y: number) => {
        dispatch({ type: 'SELECT_CELL', payload: { x, y } });
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

    // Ajoutez ce hook useMemo avant le return
    const wordsList = useMemo(() => {
        if (!state.currentGrid) return [];
        return extractWords(state.currentGrid.cells);
    }, [state.currentGrid]);

    return (
        <div className="crossword-editor">
            <Toolbar 
                onResize={handleResize}
                currentGrid={state.currentGrid}
                onInputFocus={setIsToolbarInputActive}
            />
            <div className="editor-container">
                <div className="editor-main">
                    {state.currentGrid && (
                        <CrosswordGrid
                            cells={state.currentGrid.cells}
                            onCellClick={handleCellClick}
                            onCellUpdate={handleCellUpdate}
                            selectedCell={state.selectedCell}
                            selectedDirection={state.selectedDirection}
                            onDirectionChange={toggleDirection}
                        />
                    )}
                </div>
                <div className="words-sidebar">
                    <h3>Mots trouvés ({wordsList.length})</h3>
                    <div className="words-list">
                        {wordsList.map((word, index) => (
                            <div key={`${word}-${index}`} className="word-item">
                                {word}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};