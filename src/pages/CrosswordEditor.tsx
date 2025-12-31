import React, { useCallback, useMemo, useState } from 'react';
import { CrosswordGrid } from '../components/grid/CrosswordGrid';
import { Toolbar } from '../components/toolbar/Toolbar';
import { useCrossword } from '../context/CrosswordContext';
import type { Cell } from '../models/types';
import './CrosswordEditor.css';

// Supprimez l'import de SaveManager et SavedGrid s'ils existent

// Ajoutez cette fonction helper avant le composant CrosswordEditor
type WordDirection = 'horizontal' | 'vertical';

interface WordPosition {
    word: string;
    direction: WordDirection;
    start: { x: number; y: number };
    end: { x: number; y: number };
    cells: { x: number; y: number }[];
}

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

export const CrosswordEditor: React.FC = () => {
    const { state, dispatch } = useCrossword();
    const [isToolbarInputActive, setIsToolbarInputActive] = useState(false);
    const gridAreaRef = React.useRef<HTMLDivElement | null>(null);
    const [selectedWord, setSelectedWord] = useState<string | null>(null);
    const [wordDefinitions, setWordDefinitions] = useState<Record<string, {
        definition: string;
        placement?: { x: number; y: number; direction: 'up' | 'down' | 'left' | 'right'; anchor: { x: number; y: number }; wordDirection: WordDirection };
    }>>({});
    const [placementTargetWord, setPlacementTargetWord] = useState<string | null>(null);
    // Supprimez la ligne avec setIsSaveDialogOpen si elle existe

    const wordPositions = useMemo(() => {
        if (!state.currentGrid) return [];
        return extractWordPositions(state.currentGrid.cells);
    }, [state.currentGrid]);
    
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
    }, [state.selectedCell, state.currentGrid, state.selectedDirection, handleCellUpdate, dispatch, isToolbarInputActive]);

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
                placement: { x, y, direction, anchor, wordDirection: candidate.direction }
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

        const placements: Record<string, { word: string; definition?: string }[]> = {};
        const arrows: Record<string, { direction: 'up' | 'down' | 'left' | 'right'; variant?: 'straight' | 'curved-right'; from: { x: number; y: number } }[]> = {};

        Object.entries(wordDefinitions).forEach(([word, data]) => {
            if (!data.placement) return;
            const key = `${data.placement.x}-${data.placement.y}`;
            if (!placements[key]) placements[key] = [];
            placements[key].push({ word, definition: data.definition });

            const target = {
                x: data.placement.x + (data.placement.direction === 'right' ? 1 : data.placement.direction === 'left' ? -1 : 0),
                y: data.placement.y + (data.placement.direction === 'down' ? 1 : data.placement.direction === 'up' ? -1 : 0)
            };

            const withinBounds = !!(state.currentGrid && target.y >= 0 && target.x >= 0 && target.y < state.currentGrid.cells.length && target.x < state.currentGrid.cells[0].length);
            const isTargetPlayable = !!(state.currentGrid && withinBounds && !state.currentGrid.cells[target.y][target.x].isBlack);

            if (withinBounds && isTargetPlayable) {
                const arrowKey = `${target.x}-${target.y}`;
                if (!arrows[arrowKey]) arrows[arrowKey] = [];
                const variant = data.placement.wordDirection === 'horizontal' && (data.placement.direction === 'down' || data.placement.direction === 'up')
                    ? 'curved-right'
                    : 'straight';

                arrows[arrowKey].push({
                    direction: data.placement.direction,
                    variant,
                    from: { x: data.placement.x, y: data.placement.y }
                });
            }
        });

        return {
            wordsList: Array.from(words).sort(),
            highlightedCells: highlighted,
            definitionPlacements: placements,
            arrowPlacements: arrows
        };
    }, [selectedWord, wordPositions, wordDefinitions, state.currentGrid]);

    return (
        <div className="crossword-editor" onMouseDown={handleOutsideClick}>
            <Toolbar
                onResize={handleResize}
                currentGrid={state.currentGrid}
                onInputFocus={setIsToolbarInputActive}
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