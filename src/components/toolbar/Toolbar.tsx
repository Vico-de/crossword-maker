import React, { useState } from 'react';
import { useCrossword } from '../../context/CrosswordContext';
import type { Grid, SavedGrid } from '../../models/types';
import './Toolbar.css';

interface ToolbarProps {
    onResize: (width: number, height: number) => void;
    currentGrid?: Grid;
    onInputFocus: (isFocused: boolean) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onResize, currentGrid, onInputFocus }) => {
    const { dispatch } = useCrossword();
    const [activePanel, setActivePanel] = useState<'info' | 'resize' | null>(null);
    const [gridName, setGridName] = useState(currentGrid?.name || '');
    const [showLoadDropdown, setShowLoadDropdown] = useState(false);
    const [dimensions, setDimensions] = useState({
        width: currentGrid?.size.width || 15,
        height: currentGrid?.size.height || 15
    });
    const [savedGrids, setSavedGrids] = useState<SavedGrid[]>(() => {
        const saved = localStorage.getItem('savedGrids');
        return saved ? JSON.parse(saved) : [];
    });

    const handleSave = () => {
        if (!gridName.trim() || !currentGrid) return;

        const newSavedGrid: SavedGrid = {
            id: Date.now().toString(),
            name: gridName.trim(),
            timestamp: Date.now(),
            grid: {
                ...currentGrid,
                name: gridName.trim()
            }
        };

        const updatedGrids = [...savedGrids, newSavedGrid];
        localStorage.setItem('savedGrids', JSON.stringify(updatedGrids));
        setSavedGrids(updatedGrids);
    };

    const handleLoad = (savedGrid: SavedGrid) => {
        if (window.confirm(`Charger la grille "${savedGrid.name}" ?`)) {
            dispatch({
                type: 'LOAD_GRID',
                payload: savedGrid.grid
            });
            setShowLoadDropdown(false);
        }
    };

    const handleDelete = (id: string, event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette grille ?')) return;

        const updatedGrids = savedGrids.filter(g => g.id !== id);
        localStorage.setItem('savedGrids', JSON.stringify(updatedGrids));
        setSavedGrids(updatedGrids);
    };

    const handleResize = () => {
        onResize(dimensions.width, dimensions.height);
        setActivePanel(null);
    };

    return (
        <div className="toolbar-container">
            <div className="toolbar-buttons">
                {['info', 'resize'].map((panel) => (
                    <button
                        key={panel}
                        className={`tool-button ${activePanel === panel ? 'active' : ''}`}
                        onClick={() => setActivePanel(activePanel === panel ? null : panel as 'info' | 'resize')}
                    >
                        {panel === 'info' ? 'Infos' : 'Redimensionner'}
                    </button>
                ))}
            </div>

            {activePanel === 'info' && (
                <div className="tool-content">
                    <div className="tool-panel">
                        <input
                            type="text"
                            className="grid-name-input"
                            placeholder="Nom de la grille"
                            value={gridName}
                            onChange={(e) => setGridName(e.target.value)}
                            onFocus={() => onInputFocus(true)}
                            onBlur={() => onInputFocus(false)}
                        />
                        <div className="action-group">
                            <button className="action-button" onClick={handleSave}>
                                Sauvegarder
                            </button>
                            <div className="load-dropdown">
                                <button
                                    className="action-button"
                                    onClick={() => setShowLoadDropdown(!showLoadDropdown)}
                                >
                                    Charger ▼
                                </button>
                                {showLoadDropdown && (
                                    <div className="dropdown-content">
                                        {savedGrids.length > 0 ? (
                                            savedGrids.map((savedGrid) => (
                                                <div
                                                    key={savedGrid.id}
                                                    className="saved-grid-item"
                                                    onClick={() => handleLoad(savedGrid)}
                                                >
                                                    <div>
                                                        <div>{savedGrid.name}</div>
                                                        <small>
                                                            {new Date(savedGrid.timestamp).toLocaleDateString()}
                                                        </small>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDelete(savedGrid.id, e)}
                                                        className="tool-button"
                                                        aria-label="Supprimer"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="no-grids">
                                                Aucune grille sauvegardée
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activePanel === 'resize' && (
                <div className="tool-content">
                    <div className="tool-panel">
                        <div className="resize-controls">
                            <input
                                type="number"
                                className="size-input"
                                value={dimensions.width}
                                onChange={(e) => setDimensions({ ...dimensions, width: parseInt(e.target.value) || 15 })}
                                min="5"
                                max="25"
                            />
                            <span>×</span>
                            <input
                                type="number"
                                className="size-input"
                                value={dimensions.height}
                                onChange={(e) => setDimensions({ ...dimensions, height: parseInt(e.target.value) || 15 })}
                                min="5"
                                max="25"
                            />
                        </div>
                        <button className="action-button" onClick={handleResize}>
                            Appliquer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};