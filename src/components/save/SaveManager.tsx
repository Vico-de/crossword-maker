import React, { useState } from 'react';
import type { Cell, GridWord } from '../../models/types';

interface SaveManagerProps {
    currentGrid?: {
        name: string;
        cells: Cell[][];
        size: { width: number; height: number };
        words: GridWord[];
    };
    onSave?: (grid: SavedGrid) => void;
    onLoad?: (grid: SavedGrid['grid']) => void;
    onDialogOpen?: (isOpen: boolean) => void;
}

const dialogStyles: React.CSSProperties = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    zIndex: 1000
};

const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999
};

const dropdownStyles: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    backgroundColor: 'white',
    borderRadius: '4px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    padding: '8px',
    zIndex: 1000,
    minWidth: '200px',
    maxHeight: '300px',
    overflowY: 'auto'
};

export const SaveManager: React.FC<SaveManagerProps> = ({ 
    currentGrid, 
    onSave, 
    onLoad,
    onDialogOpen 
}) => {
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [showLoadDropdown, setShowLoadDropdown] = useState(false);
    const [gridName, setGridName] = useState('');
    const [savedGrids, setSavedGrids] = useState<SavedGrid[]>(() => {
        const saved = localStorage.getItem('savedGrids');
        return saved ? JSON.parse(saved) : [];
    });

    React.useEffect(() => {
        onDialogOpen?.(showSaveDialog);
    }, [showSaveDialog, onDialogOpen]);

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
        onSave?.(newSavedGrid);
        
        setGridName('');
        setShowSaveDialog(false);
    };

    const handleLoad = (savedGrid: SavedGrid) => {
        if (window.confirm(`Charger la grille "${savedGrid.name}" ?`)) {
            onLoad?.(savedGrid.grid);
            setShowLoadDropdown(false);
        }
    };

    const handleDelete = (id: string, event: React.MouseEvent) => {
        // Empêcher la propagation de l'événement
        event.preventDefault();
        event.stopPropagation();

        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette grille ?')) return;

        const updatedGrids = savedGrids.filter(g => g.id !== id);
        localStorage.setItem('savedGrids', JSON.stringify(updatedGrids));
        setSavedGrids(updatedGrids);
    };

    return (
        <div className="save-manager" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                    className="save-button"
                    onClick={() => setShowSaveDialog(true)}
                >
                    Sauvegarder
                </button>
                <button 
                    className="load-button"
                    onClick={() => setShowLoadDropdown(!showLoadDropdown)}
                >
                    Charger ▼
                </button>
            </div>

            {showSaveDialog && (
                <>
                    <div style={overlayStyles} onClick={() => setShowSaveDialog(false)} />
                    <div style={dialogStyles}>
                        <h3>Sauvegarder la grille</h3>
                        <input
                            type="text"
                            value={gridName}
                            onChange={(e) => setGridName(e.target.value)}
                            placeholder="Nom de la grille"
                            autoFocus
                        />
                        <div className="dialog-buttons">
                            <button onClick={handleSave}>Sauvegarder</button>
                            <button onClick={() => setShowSaveDialog(false)}>Annuler</button>
                        </div>
                    </div>
                </>
            )}

            {showLoadDropdown && (
                <div style={dropdownStyles}>
                    <h4>Grilles sauvegardées</h4>
                    {savedGrids.length > 0 ? (
                        savedGrids.map((savedGrid) => (
                            <div
                                key={savedGrid.id}
                                className="saved-grid-item"
                                onClick={() => handleLoad(savedGrid)}
                                style={{
                                    padding: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    borderBottom: '1px solid #eee'
                                }}
                            >
                                <div>
                                    <div>{savedGrid.name}</div>
                                    <small>{new Date(savedGrid.timestamp).toLocaleDateString()}</small>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(savedGrid.id, e)}
                                    className="delete-button"
                                    style={{ padding: '4px 8px' }}
                                >
                                    ×
                                </button>
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '8px', color: '#666' }}>
                            Aucune grille sauvegardée
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};