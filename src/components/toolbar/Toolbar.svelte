<script lang="ts">
    import { onMount } from 'svelte';
    import { themeChange } from 'theme-change';
    import type { AppearanceSettings, Grid } from '../../models/types';

    interface Props {
        onResize: (width: number, height: number) => void;
        currentGrid?: Grid;
        onInputFocus: (isFocused: boolean) => void;
        appearance: AppearanceSettings;
        onAppearanceChange: (changes: Partial<AppearanceSettings>) => void;
        onGridNameChange: (name: string) => void;
        onGridSetChange: (set: string) => void;
        saveStatus: 'empty' | 'saved' | 'modified';
        onSave: () => void;
        onNewGrid: () => void;
        onShowGrids: () => void;
        selectedDirection?: 'horizontal' | 'vertical';
        onDirectionToggle?: () => void;
        editMode: 'normal' | 'separator';
        onToggleEditMode: () => void;
        previewAppearance: boolean;
        onTogglePreviewAppearance: () => void;
        previewWithoutLetters: boolean;
        onTogglePreviewWithoutLetters: () => void;
        showSidebar: boolean;
        onToggleSidebar: () => void;
    }

    let {
        onResize,
        currentGrid,
        onInputFocus,
        appearance,
        onAppearanceChange,
        onGridNameChange,
        onGridSetChange,
        saveStatus,
        onSave,
        onNewGrid,
        onShowGrids,
        selectedDirection = 'horizontal',
        onDirectionToggle,
        editMode,
        onToggleEditMode,
        previewAppearance,
        onTogglePreviewAppearance,
        previewWithoutLetters,
        onTogglePreviewWithoutLetters,
        showSidebar,
        onToggleSidebar
    }: Props = $props();

    type ColorKey =
        | 'blackCellColor'
        | 'cellBackgroundColor'
        | 'arrowColor'
        | 'letterColor'
        | 'definitionTextColor'
        | 'borderColor'
        | 'separatorColor';

    let activePanel = $state<'info' | 'appearance' | null>(null);
    let dimensions = $state({
        width: currentGrid?.size.width || 15,
        height: currentGrid?.size.height || 15
    });
    let gridFontCustom = $state(appearance.gridFont);
    let gridFontWeight = $state<'normal' | 'bold'>(appearance.gridFontWeight);
    let gridFontStyle = $state<'normal' | 'italic'>(appearance.gridFontStyle);
    let definitionFontCustom = $state(appearance.definitionFont);
    let definitionFontWeight = $state<'normal' | 'bold'>(appearance.definitionFontWeight);
    let definitionFontStyle = $state<'normal' | 'italic'>(appearance.definitionFontStyle);
    let colorDrafts = $state<Record<ColorKey, string>>({
        blackCellColor: appearance.blackCellColor,
        cellBackgroundColor: appearance.cellBackgroundColor,
        arrowColor: appearance.arrowColor,
        letterColor: appearance.letterColor,
        definitionTextColor: appearance.definitionTextColor,
        borderColor: appearance.borderColor,
        separatorColor: appearance.separatorColor
    });

    let isDark = $state((localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme')) === 'dark');

    let gridFontFileInput = $state<HTMLInputElement | null>(null);
    let definitionFontFileInput = $state<HTMLInputElement | null>(null);

    // theme-change gère le basculement de thème et le mémorise dans localStorage.
    onMount(() => themeChange(false));

    // Recopie la taille de la grille active dans les champs locaux.
    $effect(() => {
        dimensions = {
            width: currentGrid?.size.width || 15,
            height: currentGrid?.size.height || 15
        };
    });

    // Recopie l'apparence courante dans les brouillons éditables.
    $effect(() => {
        colorDrafts = {
            blackCellColor: appearance.blackCellColor,
            cellBackgroundColor: appearance.cellBackgroundColor,
            arrowColor: appearance.arrowColor,
            letterColor: appearance.letterColor,
            definitionTextColor: appearance.definitionTextColor,
            borderColor: appearance.borderColor,
            separatorColor: appearance.separatorColor
        };
        gridFontCustom = appearance.gridFont;
        gridFontWeight = appearance.gridFontWeight;
        gridFontStyle = appearance.gridFontStyle;
        definitionFontCustom = appearance.definitionFont;
        definitionFontWeight = appearance.definitionFontWeight;
        definitionFontStyle = appearance.definitionFontStyle;
    });

    const handleResize = () => {
        onResize(dimensions.width, dimensions.height);
        activePanel = null;
    };

    const colorFields: { key: ColorKey; label: string }[] = [
        { key: 'blackCellColor', label: 'Cases noires' },
        { key: 'cellBackgroundColor', label: 'Cases blanches' },
        { key: 'letterColor', label: 'Lettres (grille)' },
        { key: 'definitionTextColor', label: 'Définitions' },
        { key: 'borderColor', label: 'Bordures & flèches' },
        { key: 'separatorColor', label: 'Barre de séparation' }
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

    const normalizeHex = (value: string): string | null => {
        const trimmed = value.trim();
        const short = trimmed.match(/^#([0-9a-fA-F]{3})$/);
        if (short) {
            const rgb = short[1];
            return `#${rgb[0]}${rgb[0]}${rgb[1]}${rgb[1]}${rgb[2]}${rgb[2]}`.toLowerCase();
        }
        if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) return trimmed.toLowerCase();
        return null;
    };

    const isValidColor = (value: string) =>
        normalizeHex(value) !== null || /^rgb(a)?\(/i.test(value.trim()) || /^hsl(a)?\(/i.test(value.trim());

    const sanitizeColor = (value: string, fallback: string) => {
        const normalized = normalizeHex(value);
        if (normalized) return normalized;
        const trimmed = value.trim();
        if (isValidColor(trimmed)) return trimmed;
        return fallback;
    };

    const commitColor = (key: ColorKey, value: string) => {
        const sanitized = sanitizeColor(value, appearance[key]);
        colorDrafts = { ...colorDrafts, [key]: sanitized };
        if (sanitized !== appearance[key]) onAppearanceChange({ [key]: sanitized });
    };

    const resolveColorValue = (key: ColorKey) =>
        normalizeHex(colorDrafts[key]) ?? normalizeHex(appearance[key]) ?? '#000000';

    const applyFontChange = (key: 'gridFont' | 'definitionFont', value: string) => {
        const dataKey = key === 'gridFont' ? 'gridFontData' : 'definitionFontData';
        const weightKey = key === 'gridFont' ? 'gridFontWeight' : 'definitionFontWeight';
        const styleKey = key === 'gridFont' ? 'gridFontStyle' : 'definitionFontStyle';
        onAppearanceChange({ [key]: value.trim() || appearance[key], [dataKey]: undefined, [weightKey]: 'normal', [styleKey]: 'normal' });
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
            document.fonts.add(fontFace);

            const fontValue = `'${fontName}'`;
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
            if (target === 'grid') {
                gridFontCustom = fontValue;
                onAppearanceChange({ gridFont: fontValue, gridFontData: dataUrl, gridFontWeight: 'normal', gridFontStyle: 'normal' });
            } else {
                definitionFontCustom = fontValue;
                onAppearanceChange({ definitionFont: fontValue, definitionFontData: dataUrl, definitionFontWeight: 'normal', definitionFontStyle: 'normal' });
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la police :', error);
            window.alert('Impossible de charger cette police. Merci de réessayer.');
        }
    };

    const triggerFontUpload = (target: 'grid' | 'definition') => {
        (target === 'grid' ? gridFontFileInput : definitionFontFileInput)?.click();
    };

</script>

<div class="navbar min-h-14 gap-2 border-b border-base-300 bg-base-100 px-3">
    <div class="navbar-start gap-1">
        <button class="btn btn-sm btn-primary btn-square" onclick={onShowGrids} title="Toutes les grilles" aria-label="Grilles">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
        </button>
        <button class="btn btn-sm btn-ghost btn-square" onclick={onNewGrid} title="Nouvelle grille" aria-label="Nouvelle grille">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
        </button>
        <button class="btn btn-sm btn-ghost btn-square" onclick={() => (activePanel = 'info')} title="Infos de la grille" aria-label="Infos">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16" /><line x1="12" y1="8" x2="12" y2="8" />
            </svg>
        </button>
        {#if onDirectionToggle}
            <button class="btn btn-sm btn-ghost btn-square" onclick={onDirectionToggle} title={`Direction : ${selectedDirection === 'horizontal' ? 'horizontale' : 'verticale'} (Tab)`} aria-label="Changer la direction">
                <span class="text-lg leading-none">{selectedDirection === 'horizontal' ? '→' : '↓'}</span>
            </button>
        {/if}
        <button
            class="btn btn-sm btn-square {editMode === 'separator' ? 'btn-secondary' : 'btn-ghost'}"
            onclick={onToggleEditMode}
            title="Mode séparateur : relier deux cases voisines par un trait pointillé"
            aria-label="Mode séparateur"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="6" width="6" height="12" rx="1" /><rect x="15" y="6" width="6" height="12" rx="1" /><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="3 3" />
            </svg>
        </button>
    </div>

    <div class="navbar-center hidden lg:flex">
        <div class="flex gap-4 text-sm text-base-content/70">
            <span>Grille : <span class="font-medium text-base-content">{currentGrid?.name || 'Sans nom'}</span></span>
            {#if currentGrid?.set}
                <span>Set : <span class="font-medium text-base-content">{currentGrid.set}</span></span>
            {/if}
        </div>
    </div>

    <div class="navbar-end gap-1">
        {#snippet diskIcon()}
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
            </svg>
        {/snippet}
        {#if saveStatus === 'empty'}
            <span class="btn btn-sm btn-ghost btn-square btn-disabled" title="Grille vide">{@render diskIcon()}</span>
        {:else}
            <button
                class="btn btn-sm btn-ghost btn-square {saveStatus === 'modified' ? 'text-warning' : 'text-success'}"
                onclick={onSave}
                title={saveStatus === 'modified' ? 'Modifications non enregistrées — cliquez pour enregistrer' : 'Grille enregistrée'}
                aria-label="Enregistrer la grille"
            >
                {@render diskIcon()}
            </button>
        {/if}

        <button
            class="btn btn-sm btn-ghost btn-square"
            onclick={onToggleSidebar}
            title={showSidebar ? "Masquer le panneau 'Mots trouvés'" : "Afficher le panneau 'Mots trouvés'"}
            aria-label="Basculer le panneau des mots"
        >
            {#if showSidebar}
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="15" y1="4" x2="15" y2="20" />
                </svg>
            {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="2" />
                </svg>
            {/if}
        </button>

        <button
            class="btn btn-sm btn-square {previewAppearance ? 'btn-secondary' : 'btn-ghost'}"
            onclick={onTogglePreviewAppearance}
            title="Aperçu avec les couleurs d'export (rendu du PDF)"
            aria-label="Aperçu des couleurs d'export"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
            </svg>
        </button>
        <button
            class="btn btn-sm btn-square {previewWithoutLetters ? 'btn-secondary' : 'btn-ghost'}"
            onclick={onTogglePreviewWithoutLetters}
            title="Aperçu sans lettres (comme puzzle vide)"
            aria-label="Aperçu sans lettres"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <text x="12" y="17" text-anchor="middle" font-size="16" font-weight="bold" stroke-dasharray="2,2" stroke-width="1.5" fill="none">A</text>
            </svg>
        </button>
        <button class="btn btn-sm btn-ghost btn-square" onclick={() => (activePanel = 'appearance')} title="Apparence (export)" aria-label="Apparence">
            <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="17.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="8.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" /><circle cx="6.5" cy="12.5" r="1.5" fill="currentColor" stroke="none" /><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 1 2-4h1a5 5 0 0 0 5-5c0-4.5-4.5-7-10-7z" />
            </svg>
        </button>

        <label class="swap swap-rotate btn btn-sm btn-ghost btn-square" title="Basculer le thème clair / sombre">
            <input type="checkbox" data-toggle-theme="dark,light" bind:checked={isDark} aria-label="Mode sombre" />
            <svg class="swap-off size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm0 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 1a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1zM4 12a1 1 0 0 1-1 1H2a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1zm18 0a1 1 0 0 1-1 1h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 1 1zM5.6 5.6a1 1 0 0 1 1.4 0l.7.7a1 1 0 1 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4zm11 11a1 1 0 0 1 1.4 0l.7.7a1 1 0 0 1-1.4 1.4l-.7-.7a1 1 0 0 1 0-1.4zm1.4-11a1 1 0 0 1 0 1.4l-.7.7a1 1 0 1 1-1.4-1.4l.7-.7a1 1 0 0 1 1.4 0zm-11 11a1 1 0 0 1 0 1.4l-.7.7a1 1 0 0 1-1.4-1.4l.7-.7a1 1 0 0 1 1.4 0z"/></svg>
            <svg class="swap-on size-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 14.1A8.5 8.5 0 0 1 9.9 2.5a1 1 0 0 0-1.3-1.3A10.5 10.5 0 1 0 22.8 15.4a1 1 0 0 0-1.3-1.3z"/></svg>
        </label>
    </div>
</div>

{#if activePanel === 'info'}
    <div class="modal modal-open">
        <div class="modal-box max-w-xl">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold">Infos</h3>
                <button class="btn btn-sm btn-circle btn-ghost" onclick={() => (activePanel = null)} aria-label="Fermer">✕</button>
            </div>

            <div class="mt-4 flex flex-col gap-3">
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Nom
                    <input
                        type="text"
                        class="input input-sm w-full"
                        placeholder="Nom de la grille"
                        value={currentGrid?.name || ''}
                        oninput={(e) => onGridNameChange(e.currentTarget.value)}
                        onfocus={() => onInputFocus(true)}
                        onblur={() => onInputFocus(false)}
                    />
                </label>
                <label class="flex flex-col gap-1 text-sm font-medium">
                    Set
                    <input
                        type="text"
                        class="input input-sm w-full"
                        placeholder="Set (tag, ex: Août 2026)"
                        value={currentGrid?.set || ''}
                        oninput={(e) => onGridSetChange(e.currentTarget.value)}
                        onfocus={() => onInputFocus(true)}
                        onblur={() => onInputFocus(false)}
                    />
                </label>
                <div class="flex flex-col gap-1 text-sm font-medium">
                    Taille
                    <div class="join">
                        <input type="number" class="input input-sm join-item w-20" bind:value={dimensions.width} min="5" max="25" />
                        <span class="join-item flex items-center border border-base-300 bg-base-200 px-2">×</span>
                        <input type="number" class="input input-sm join-item w-20" bind:value={dimensions.height} min="5" max="25" />
                        <button class="btn btn-sm join-item" onclick={handleResize}>Appliquer</button>
                    </div>
                </div>
            </div>
        </div>
        <button type="button" class="modal-backdrop" onclick={() => (activePanel = null)} aria-label="Fermer"></button>
    </div>
{/if}

{#if activePanel === 'appearance'}
    <div class="modal modal-open">
        <div class="modal-box max-w-2xl">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-bold">Apparence</h3>
                <button class="btn btn-sm btn-circle btn-ghost" onclick={() => (activePanel = null)} aria-label="Fermer">✕</button>
            </div>

            <div class="mt-4 grid gap-4 sm:grid-cols-2">
                {#each colorFields as { key, label } (key)}
                    <label class="flex items-center justify-between gap-2 text-sm">
                        <span>{label}</span>
                        <span class="flex items-center gap-1">
                            <input
                                type="color"
                                class="h-8 w-10 rounded border border-base-300 bg-base-100"
                                value={resolveColorValue(key)}
                                oninput={(e) => commitColor(key, e.currentTarget.value)}
                                onfocus={() => onInputFocus(true)}
                                onblur={() => onInputFocus(false)}
                                aria-label={label}
                            />
                            <input
                                type="text"
                                class="input input-xs w-24"
                                bind:value={colorDrafts[key]}
                                onfocus={() => onInputFocus(true)}
                                onblur={() => {
                                    commitColor(key, colorDrafts[key]);
                                    onInputFocus(false);
                                }}
                                placeholder="#000000"
                            />
                        </span>
                    </label>
                {/each}

                <label class="flex items-center justify-between gap-2 text-sm">
                    <span>Épaisseur de la grille</span>
                    <input
                        type="number"
                        class="input input-xs w-24"
                        min={0.5}
                        max={3}
                        step={0.25}
                        value={appearance.gridLineWidth}
                        oninput={(e) => onAppearanceChange({ gridLineWidth: Math.max(0.5, Math.min(3, Number(e.currentTarget.value) || 1)) })}
                        onfocus={() => onInputFocus(true)}
                        onblur={() => onInputFocus(false)}
                    />
                </label>

                <label class="flex items-center justify-between gap-2 text-sm">
                    <span>Épaisseur séparateur pointillé</span>
                    <input
                        type="number"
                        class="input input-xs w-24"
                        min={0.5}
                        max={3}
                        step={0.25}
                        value={appearance.dashedSeparatorWidth}
                        oninput={(e) => onAppearanceChange({ dashedSeparatorWidth: Math.max(0.5, Math.min(3, Number(e.currentTarget.value) || 1)) })}
                        onfocus={() => onInputFocus(true)}
                        onblur={() => onInputFocus(false)}
                    />
                </label>

                <label class="flex items-center justify-between gap-2 text-sm">
                    <span>Épaisseur séparation définition</span>
                    <input
                        type="number"
                        class="input input-xs w-24"
                        min={0.5}
                        max={3}
                        step={0.25}
                        value={appearance.definitionSeparatorWidth}
                        oninput={(e) => onAppearanceChange({ definitionSeparatorWidth: Math.max(0.5, Math.min(3, Number(e.currentTarget.value) || 1)) })}
                        onfocus={() => onInputFocus(true)}
                        onblur={() => onInputFocus(false)}
                    />
                </label>

                <label class="flex flex-col gap-1 text-sm">
                    <span>Police de la grille</span>
                    <select
                        class="select select-sm w-full"
                        value={selectedFontValue(appearance.gridFont)}
                        onchange={(e) => {
                            const value = e.currentTarget.value;
                            if (value === 'custom') triggerFontUpload('grid');
                            else applyFontChange('gridFont', value);
                        }}
                        onfocus={() => onInputFocus(true)}
                        onblur={() => onInputFocus(false)}
                    >
                        {#each fontOptions as option (option.value)}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                    <div class="flex items-center gap-1">
                        <button
                            type="button"
                            class="btn btn-xs {gridFontWeight === 'bold' ? 'btn-primary' : 'btn-ghost'}"
                            onclick={() => { gridFontWeight = gridFontWeight === 'bold' ? 'normal' : 'bold'; onAppearanceChange({ gridFontWeight }); }}
                            title="Gras (Bold)"
                            aria-label="Gras"
                        ><b>B</b></button>
                        <button
                            type="button"
                            class="btn btn-xs {gridFontStyle === 'italic' ? 'btn-primary' : 'btn-ghost'}"
                            onclick={() => { gridFontStyle = gridFontStyle === 'italic' ? 'normal' : 'italic'; onAppearanceChange({ gridFontStyle }); }}
                            title="Italique (Italic)"
                            aria-label="Italique"
                        ><i>I</i></button>
                        {#if selectedFontValue(appearance.gridFont) === 'custom'}
                            <input
                                type="text"
                                class="input input-xs grow"
                                bind:value={gridFontCustom}
                                oninput={(e) => applyFontChange('gridFont', e.currentTarget.value)}
                                onfocus={() => onInputFocus(true)}
                                onblur={() => onInputFocus(false)}
                                placeholder="Ex: Inter, Arial"
                            />
                            <button type="button" class="btn btn-xs" onclick={() => triggerFontUpload('grid')}>Charger</button>
                        {/if}
                    </div>
                </label>

                <label class="flex flex-col gap-1 text-sm">
                    <span>Police des définitions</span>
                    <select
                        class="select select-sm w-full"
                        value={selectedFontValue(appearance.definitionFont)}
                        onchange={(e) => {
                            const value = e.currentTarget.value;
                            if (value === 'custom') triggerFontUpload('definition');
                            else applyFontChange('definitionFont', value);
                        }}
                        onfocus={() => onInputFocus(true)}
                        onblur={() => onInputFocus(false)}
                    >
                        {#each fontOptions as option (option.value)}
                            <option value={option.value}>{option.label}</option>
                        {/each}
                    </select>
                    <div class="flex items-center gap-1">
                        <button
                            type="button"
                            class="btn btn-xs {definitionFontWeight === 'bold' ? 'btn-primary' : 'btn-ghost'}"
                            onclick={() => { definitionFontWeight = definitionFontWeight === 'bold' ? 'normal' : 'bold'; onAppearanceChange({ definitionFontWeight }); }}
                            title="Gras (Bold)"
                            aria-label="Gras"
                        ><b>B</b></button>
                        <button
                            type="button"
                            class="btn btn-xs {definitionFontStyle === 'italic' ? 'btn-primary' : 'btn-ghost'}"
                            onclick={() => { definitionFontStyle = definitionFontStyle === 'italic' ? 'normal' : 'italic'; onAppearanceChange({ definitionFontStyle }); }}
                            title="Italique (Italic)"
                            aria-label="Italique"
                        ><i>I</i></button>
                        {#if selectedFontValue(appearance.definitionFont) === 'custom'}
                            <input
                                type="text"
                                class="input input-xs grow"
                                bind:value={definitionFontCustom}
                                oninput={(e) => applyFontChange('definitionFont', e.currentTarget.value)}
                                onfocus={() => onInputFocus(true)}
                                onblur={() => onInputFocus(false)}
                                placeholder="Ex: Inter, Georgia"
                            />
                            <button type="button" class="btn btn-xs" onclick={() => triggerFontUpload('definition')}>Charger</button>
                        {/if}
                    </div>
                </label>
            </div>
        </div>
        <button type="button" class="modal-backdrop" onclick={() => (activePanel = null)} aria-label="Fermer"></button>
    </div>
{/if}

<input
    bind:this={gridFontFileInput}
    type="file"
    accept=".ttf,.otf,.woff,.woff2"
    class="hidden"
    onchange={(e) => {
        const file = e.currentTarget.files?.[0];
        if (file) {
            loadFontFile(file, 'grid');
            e.currentTarget.value = '';
        }
    }}
/>
<input
    bind:this={definitionFontFileInput}
    type="file"
    accept=".ttf,.otf,.woff,.woff2"
    class="hidden"
    onchange={(e) => {
        const file = e.currentTarget.files?.[0];
        if (file) {
            loadFontFile(file, 'definition');
            e.currentTarget.value = '';
        }
    }}
/>
