import React, { useState } from 'react';
import { useCrossword } from '../../context/CrosswordContext';
import type { Grid, SavedGrid } from '../../models/types';
import './Toolbar.css';

export interface AppearanceSettings {
    blackCellColor: string;
    arrowColor: string;
    letterColor: string;
    definitionTextColor: string;
    borderColor: string;
    separatorColor: string;
    gridFont: string;
    definitionFont: string;
}

interface ToolbarProps {
    onResize: (width: number, height: number) => void;
    currentGrid?: Grid;
    onInputFocus: (isFocused: boolean) => void;
    appearance: AppearanceSettings;
    onAppearanceChange: (changes: Partial<AppearanceSettings>) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    onResize,
    currentGrid,
    onInputFocus,
    appearance,
    onAppearanceChange
}) => {
    const { dispatch } = useCrossword();
    const [activePanel, setActivePanel] = useState<'info' | 'resize' | 'appearance' | null>(null);
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
    const [gridFontCustom, setGridFontCustom] = useState(appearance.gridFont);
    const [definitionFontCustom, setDefinitionFontCustom] = useState(appearance.definitionFont);

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

    const colorFields: { key: keyof AppearanceSettings; label: string }[] = [
        { key: 'blackCellColor', label: 'Couleur des cases noires' },
        { key: 'arrowColor', label: 'Couleur des flèches' },
        { key: 'letterColor', label: 'Couleur des lettres (grille)' },
        { key: 'definitionTextColor', label: 'Couleur des définitions' },
        { key: 'borderColor', label: 'Couleur des bordures de cases' },
        { key: 'separatorColor', label: 'Couleur de la barre de séparation' }
    ];

    const fontOptions = [
        { label: 'Charger une police…', value: 'custom' },
        { label: 'Inter', value: "'Inter', 'Segoe UI', system-ui, sans-serif" },
        { label: 'Arial', value: "Arial, 'Helvetica Neue', sans-serif" },
        { label: 'Roboto', value: "'Roboto', 'Segoe UI', system-ui, sans-serif" },
        { label: 'Lato', value: "'Lato', 'Segoe UI', system-ui, sans-serif" },
        { label: 'Open Sans', value: "'Open Sans', 'Segoe UI', system-ui, sans-serif" },
        { label: 'Montserrat', value: "'Montserrat', 'Segoe UI', system-ui, sans-serif" },
        { label: 'Georgia', value: "Georgia, 'Times New Roman', serif" },
        { label: 'Courier New', value: "'Courier New', monospace" }
    ];

    const handleAppearanceFieldChange = (key: keyof AppearanceSettings, value: string) => {
        onAppearanceChange({ [key]: value });
    };

    const selectedFontValue = (current: string) => {
        const match = fontOptions.find((opt) => opt.value === current);
        return match ? match.value : 'custom';
    };

    return (
        <div className="toolbar-container">
            <div className="toolbar-buttons">
                {['info', 'resize', 'appearance'].map((panel) => (
                    <button
                        key={panel}
                        className={`tool-button ${activePanel === panel ? 'active' : ''}`}
                        onClick={() =>
                            setActivePanel(
                                activePanel === panel ? null : (panel as 'info' | 'resize' | 'appearance')
                            )
                        }
                    >
                        {panel === 'info'
                            ? 'Infos'
                            : panel === 'resize'
                              ? 'Redimensionner'
                              : 'Apparence'}
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

            {activePanel === 'appearance' && (
                <div className="tool-content">
                    <div className="tool-panel appearance-panel">
                        {colorFields.map(({ key, label }) => (
                            <div key={key} className="color-field">
                                <label>{label}</label>
                                <div className="color-inputs">
                                    <input
                                        type="color"
                                        value={appearance[key]}
                                        onChange={(e) => handleAppearanceFieldChange(key, e.target.value)}
                                        onFocus={() => onInputFocus(true)}
                                        onBlur={() => onInputFocus(false)}
                                        aria-label={label}
                                    />
                                    <input
                                        type="text"
                                        value={appearance[key]}
                                        onChange={(e) => handleAppearanceFieldChange(key, e.target.value)}
                                        onFocus={() => onInputFocus(true)}
                                        onBlur={() => onInputFocus(false)}
                                        className="color-text-input"
                                        placeholder="#000000 ou rgb()"
                                    />
                                </div>
                            </div>
                        ))}

                        <div className="font-field">
                            <label>Police de la grille</label>
                            <select
                                className="font-select"
                                value={selectedFontValue(appearance.gridFont)}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === 'custom') {
                                        onAppearanceChange({ gridFont: gridFontCustom });
                                    } else {
                                        onAppearanceChange({ gridFont: value });
                                    }
                                }}
                                onFocus={() => onInputFocus(true)}
                                onBlur={() => onInputFocus(false)}
                            >
                                {fontOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {selectedFontValue(appearance.gridFont) === 'custom' && (
                                <input
                                    type="text"
                                    value={gridFontCustom}
                                    onChange={(e) => {
                                        setGridFontCustom(e.target.value);
                                        handleAppearanceFieldChange('gridFont', e.target.value);
                                    }}
                                    onFocus={() => onInputFocus(true)}
                                    onBlur={() => onInputFocus(false)}
                                    className="color-text-input"
                                    placeholder="Ex: Inter, Arial, sans-serif"
                                />
                            )}
                        </div>

                        <div className="font-field">
                            <label>Police des définitions</label>
                            <select
                                className="font-select"
                                value={selectedFontValue(appearance.definitionFont)}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === 'custom') {
                                        onAppearanceChange({ definitionFont: definitionFontCustom });
                                    } else {
                                        onAppearanceChange({ definitionFont: value });
                                    }
                                }}
                                onFocus={() => onInputFocus(true)}
                                onBlur={() => onInputFocus(false)}
                            >
                                {fontOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            {selectedFontValue(appearance.definitionFont) === 'custom' && (
                                <input
                                    type="text"
                                    value={definitionFontCustom}
                                    onChange={(e) => {
                                        setDefinitionFontCustom(e.target.value);
                                        handleAppearanceFieldChange('definitionFont', e.target.value);
                                    }}
                                    onFocus={() => onInputFocus(true)}
                                    onBlur={() => onInputFocus(false)}
                                    className="color-text-input"
                                    placeholder="Ex: Inter, Georgia"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};