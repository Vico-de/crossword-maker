import React, { useEffect, useRef, useState } from 'react';
import type { Grid, GridSet, SavedGrid, WordDefinitionData } from '../../models/types';
import './Toolbar.css';

export interface AppearanceSettings {
    blackCellColor: string;
    cellBackgroundColor: string;
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
    definitions: Record<string, WordDefinitionData>;
    onInputFocus: (isFocused: boolean) => void;
    appearance: AppearanceSettings;
    onAppearanceChange: (changes: Partial<AppearanceSettings>) => void;
    savedGrids: SavedGrid[];
    onSavedGridsChange: (grids: SavedGrid[]) => void;
    onGridLoad: (grid: Grid, definitions?: Record<string, WordDefinitionData>) => void;
    gridSets: GridSet[];
    currentSetName: string;
    onSetNameChange: (name: string) => void;
    onNewSet: () => void;
    onExportSet: () => void;
    onImportSetData: (content: string) => void;
    onExportGridPdf: () => void;
    onExportSetPdf: () => void;
    onSelectSet: (id: string) => void;
    currentSetId: string | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({
    onResize,
    currentGrid,
    definitions,
    onInputFocus,
    appearance,
    onAppearanceChange,
    savedGrids,
    onSavedGridsChange,
    onGridLoad,
    gridSets,
    currentSetName,
    onSetNameChange,
    onNewSet,
    onExportSet,
    onImportSetData,
    onExportGridPdf,
    onExportSetPdf,
    onSelectSet,
    currentSetId
}) => {
    const [activePanel, setActivePanel] = useState<'info' | 'appearance' | null>(null);
    const [gridName, setGridName] = useState(currentGrid?.name || '');
    const [showLoadDropdown, setShowLoadDropdown] = useState(false);
    const [dimensions, setDimensions] = useState({
        width: currentGrid?.size.width || 15,
        height: currentGrid?.size.height || 15
    });
    const [gridFontCustom, setGridFontCustom] = useState(appearance.gridFont);
    const [definitionFontCustom, setDefinitionFontCustom] = useState(appearance.definitionFont);
    const [showSetDropdown, setShowSetDropdown] = useState(false);
    const gridFontFileInput = useRef<HTMLInputElement | null>(null);
    const definitionFontFileInput = useRef<HTMLInputElement | null>(null);
    const setFileInput = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setGridName(currentGrid?.name || '');
    }, [currentGrid]);

    useEffect(() => {
        setDimensions({
            width: currentGrid?.size.width || 15,
            height: currentGrid?.size.height || 15
        });
    }, [currentGrid]);

    const handleSave = () => {
        if (!gridName.trim() || !currentGrid) return;
        const baseName = gridName.trim();
        const existingIndex = savedGrids.findIndex((g) => g.name === baseName);
        const newSavedGrid: SavedGrid = {
            id: Date.now().toString(),
            name: baseName,
            timestamp: Date.now(),
            grid: {
                ...currentGrid,
                name: baseName
            },
            definitions
        };

        if (existingIndex >= 0) {
            const replace = window.confirm(
                'Une grille porte déjà ce nom. OK pour la remplacer, Annuler pour créer une copie.'
            );

            if (replace) {
                const updatedGrids = savedGrids.map((grid, index) =>
                    index === existingIndex
                        ? { ...newSavedGrid, id: grid.id, timestamp: Date.now() }
                        : grid
                );
                onSavedGridsChange(updatedGrids);
                return;
            }

            let copyIndex = 1;
            let copyName = `${baseName} (copie)`;
            const existingNames = new Set(savedGrids.map((g) => g.name));
            while (existingNames.has(copyName)) {
                copyIndex += 1;
                copyName = `${baseName} (copie ${copyIndex})`;
            }

            onSavedGridsChange([
                ...savedGrids,
                { ...newSavedGrid, name: copyName, grid: { ...newSavedGrid.grid, name: copyName } }
            ]);
            setGridName(copyName);
            return;
        }

        onSavedGridsChange([...savedGrids, newSavedGrid]);
    };

    const handleLoad = (savedGrid: SavedGrid) => {
        if (window.confirm(`Charger la grille "${savedGrid.name}" ?`)) {
            onGridLoad(savedGrid.grid, savedGrid.definitions);
            setShowLoadDropdown(false);
        }
    };

    const handleDelete = (id: string, event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette grille ?')) return;

        const updatedGrids = savedGrids.filter(g => g.id !== id);
        onSavedGridsChange(updatedGrids);
    };

    const handleResize = () => {
        onResize(dimensions.width, dimensions.height);
        setActivePanel(null);
    };

    const handleSetFile = (file?: File | null) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
                onImportSetData(content);
            }
        };
        reader.readAsText(file);
    };

    const colorFields: { key: keyof AppearanceSettings; label: string }[] = [
        { key: 'blackCellColor', label: 'Couleur des cases noires' },
        { key: 'cellBackgroundColor', label: 'Couleur des cases blanches' },
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

    const loadFontFile = async (file: File, target: 'grid' | 'definition') => {
        try {
            const fontName = file.name.replace(/\.[^/.]+$/, '') || 'CustomFont';
            const fontData = await file.arrayBuffer();
            const fontFace = new FontFace(fontName, fontData);
            await fontFace.load();
            (document as Document).fonts.add(fontFace);

            const fontValue = `'${fontName}'`;
            if (target === 'grid') {
                setGridFontCustom(fontValue);
                handleAppearanceFieldChange('gridFont', fontValue);
            } else {
                setDefinitionFontCustom(fontValue);
                handleAppearanceFieldChange('definitionFont', fontValue);
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la police :', error);
            window.alert('Impossible de charger cette police. Merci de réessayer.');
        }
    };

    const triggerFontUpload = (target: 'grid' | 'definition') => {
        const input = target === 'grid' ? gridFontFileInput.current : definitionFontFileInput.current;
        input?.click();
    };

    return (
        <div className="toolbar-container">
            <div className="toolbar-buttons">
                {['info', 'appearance'].map((panel) => (
                    <button
                        key={panel}
                        className={`tool-button ${activePanel === panel ? 'active' : ''}`}
                        onClick={() =>
                            setActivePanel(
                                activePanel === panel ? null : (panel as 'info' | 'appearance')
                            )
                        }
                    >
                        {panel === 'info'
                            ? 'Infos'
                            : 'Apparence'}
                    </button>
                ))}
            </div>
            <div className="toolbar-status">
                <span className="status-item">Set : {currentSetName || 'Nouveau set'}</span>
                <span className="status-item">Grille : {gridName || 'Sans nom'}</span>
            </div>

            {activePanel === 'info' && (
                <div className="tool-content">
                    <div className="tool-panel info-panel">
                        <div className="set-column">
                            <label className="input-label">Set de grilles</label>
                            <input
                                type="text"
                                className="grid-name-input"
                                placeholder="Nom du set"
                                value={currentSetName}
                                onChange={(e) => onSetNameChange(e.target.value)}
                                onFocus={() => onInputFocus(true)}
                                onBlur={() => onInputFocus(false)}
                            />
                            <div className="action-group">
                                <button className="action-button" type="button" onClick={onExportSet}>
                                    Exporter le set
                                </button>
                                <button className="action-button" type="button" onClick={onExportSetPdf}>
                                    Exporter le set (PDF)
                                </button>
                                <button className="tool-button" type="button" onClick={onNewSet}>
                                    Nouveau set de grille
                                </button>
                                <div className="load-dropdown">
                                    <button
                                        className="tool-button"
                                        onClick={() => setShowSetDropdown(!showSetDropdown)}
                                        type="button"
                                    >
                                        Charger un set ▼
                                    </button>
                                    {showSetDropdown && (
                                        <div className="dropdown-content">
                                            <button
                                                className="tool-button full-width"
                                                type="button"
                                                onClick={() => {
                                                    setShowSetDropdown(false);
                                                    setFileInput.current?.click();
                                                }}
                                            >
                                                Importer un set local
                                            </button>
                                            {gridSets.length > 0 ? (
                                                gridSets.map((set) => (
                                                    <div
                                                        key={set.id}
                                                        className={`saved-grid-item ${set.id === currentSetId ? 'active' : ''}`}
                                                        onClick={() => {
                                                            onSelectSet(set.id);
                                                            setShowSetDropdown(false);
                                                        }}
                                                    >
                                                        <div>
                                                            <div>{set.name}</div>
                                                            <small>{set.grids.length} grilles</small>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="no-grids">Aucun set enregistré</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid-column">
                            <label className="input-label">Grille active</label>
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
                                <button className="action-button" type="button" onClick={onExportGridPdf}>
                                    Exporter la grille (PDF)
                                </button>
                            </div>

                            <label className="input-label">Redimensionner</label>
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
                                <button className="tool-button" onClick={handleResize}>
                                    Appliquer sans effacer
                                </button>
                            </div>
                        </div>
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
                                        triggerFontUpload('grid');
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
                                <div className="custom-font-row">
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
                                    <button
                                        type="button"
                                        className="tool-button"
                                        onClick={() => triggerFontUpload('grid')}
                                    >
                                        Charger une police
                                    </button>
                                </div>
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
                                        triggerFontUpload('definition');
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
                                <div className="custom-font-row">
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
                                    <button
                                        type="button"
                                        className="tool-button"
                                        onClick={() => triggerFontUpload('definition')}
                                    >
                                        Charger une police
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <input
                ref={gridFontFileInput}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        loadFontFile(file, 'grid');
                        e.target.value = '';
                    }
                }}
            />
            <input
                ref={setFileInput}
                type="file"
                accept=".json,.txt"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    handleSetFile(file);
                    e.target.value = '';
                }}
            />
            <input
                ref={definitionFontFileInput}
                type="file"
                accept=".ttf,.otf,.woff,.woff2"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        loadFontFile(file, 'definition');
                        e.target.value = '';
                    }
                }}
            />
        </div>
    );
};