<script lang="ts">
    import type { SavedGrid } from '../../models/types';
    import GridPreviewAsync from '../grid/GridPreviewAsync.svelte';

    interface Props {
        gridsBySet: { set: string; list: SavedGrid[] }[];
        hasGrids: boolean;
        selectedId: string | null;
        selectedGrid: SavedGrid | null;
        openSet: string | null;
        currentGridId: string | null;
        onClose: () => void;
        onImport: () => void;
        onExportDatabase: () => void;
        onExportSetJson: () => void;
        onExportSetPdf: () => void;
        onExportGridJson: () => void;
        onExportGridPdf: () => void;
        onOpen: (grid: SavedGrid) => void;
        onDelete: (id: string) => void;
        onRenameSet: (key: string) => void;
    }

    let {
        gridsBySet,
        hasGrids,
        selectedId = $bindable(),
        selectedGrid,
        openSet,
        currentGridId,
        onClose,
        onImport,
        onExportDatabase,
        onExportSetJson,
        onExportSetPdf,
        onExportGridJson,
        onExportGridPdf,
        onOpen,
        onDelete,
        onRenameSet
    }: Props = $props();
</script>

{#snippet iconDl()}
    <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
{/snippet}
{#snippet iconUp()}
    <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9" /><path d="m7 14 5-5 5 5" /><path d="M5 3h14" /></svg>
{/snippet}
{#snippet iconPdf()}
    <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v5h5" /><path d="M12 11v6" /><path d="m9.5 14.5 2.5 2.5 2.5-2.5" /></svg>
{/snippet}

<div class="modal modal-open">
    <div class="modal-box flex h-[80vh] max-w-4xl flex-col">
        <!-- Actions de données (haut) -->
        <div class="flex flex-wrap items-center gap-1">
            <h3 class="mr-2 text-lg font-bold">Grilles</h3>
            <button class="btn btn-sm btn-ghost gap-1" onclick={onImport} title="Importer un .json (base ou ancien set)">{@render iconUp()} Importer</button>
            <div class="divider divider-horizontal mx-0"></div>
            <button class="btn btn-sm btn-ghost gap-1" onclick={onExportDatabase} title="Exporter toute la base (.json)">{@render iconDl()} Base</button>
            <div class="divider divider-horizontal mx-0"></div>
            <button class="btn btn-sm btn-ghost gap-1" disabled={!selectedGrid} onclick={onExportSetJson} title="Exporter le set (.json)">{@render iconDl()} Set</button>
            <button class="btn btn-sm btn-ghost gap-1" disabled={!selectedGrid} onclick={onExportSetPdf} title="Exporter le set (PDF)">{@render iconPdf()} Set</button>
            <div class="divider divider-horizontal mx-0"></div>
            <button class="btn btn-sm btn-ghost gap-1" disabled={!selectedGrid} onclick={onExportGridJson} title="Exporter la grille (.json)">{@render iconDl()} Grille</button>
            <button class="btn btn-sm btn-ghost gap-1" disabled={!selectedGrid} onclick={onExportGridPdf} title="Exporter la grille (PDF)">{@render iconPdf()} Grille</button>
            <button class="btn btn-sm btn-circle btn-ghost ml-auto" onclick={onClose} aria-label="Fermer">✕</button>
        </div>

        {#if !hasGrids}
            <p class="my-auto text-center opacity-60">Aucune grille enregistrée. Créez-en une puis enregistrez-la, ou importez une base / un ancien set.</p>
        {:else}
            <!-- Maître / détail -->
            <div class="mt-4 flex min-h-0 flex-1 gap-4">
                <div class="w-1/2 overflow-y-auto overflow-x-hidden rounded-box border border-base-300">
                    {#each gridsBySet as group (group.set)}
                        <details class="border-b border-base-200 last:border-0" open={group.set === openSet}>
                            <summary class="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-base font-semibold hover:bg-base-200">
                                <span>{group.set}</span>
                                <span class="text-xs font-normal opacity-60">({group.list.length})</span>
                                <button
                                    type="button"
                                    class="btn btn-ghost btn-xs btn-square ml-auto"
                                    title="Renommer le set"
                                    aria-label="Renommer le set"
                                    onclick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onRenameSet(group.set);
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                                </button>
                            </summary>
                            <ul class="menu w-full flex-nowrap gap-0.5 p-1">
                                {#each group.list as g (g.id)}
                                    <li>
                                        <button
                                            class="flex w-full items-center justify-between"
                                            class:menu-active={g.id === selectedId}
                                            onclick={() => (selectedId = g.id)}
                                            ondblclick={() => onOpen(g)}
                                        >
                                            <span class="truncate">{g.name}</span>
                                            {#if g.id === currentGridId}<span class="badge badge-xs badge-primary">actuelle</span>{/if}
                                        </button>
                                    </li>
                                {/each}
                            </ul>
                        </details>
                    {/each}
                </div>

                <div class="flex w-1/2 flex-col items-center justify-center overflow-hidden rounded-box border border-base-300 bg-base-200 p-4">
                    {#if selectedGrid}
                        <div class="mb-2 shrink-0 text-center">
                            <div class="font-semibold">{selectedGrid.name}</div>
                            <div class="text-xs opacity-60">{(selectedGrid.grid.set || '').trim() || 'Sans set'}</div>
                        </div>
                        <div class="flex min-h-0 flex-1 items-center justify-center overflow-auto">
                            <GridPreviewAsync cells={selectedGrid.grid.cells} cell={16} />
                        </div>
                    {:else}
                        <p class="opacity-60">Sélectionnez une grille.</p>
                    {/if}
                </div>
            </div>

            <!-- Actions (bas) -->
            <div class="mt-4 flex shrink-0 justify-end gap-2">
                <button class="btn btn-sm btn-ghost text-error" disabled={!selectedGrid} onclick={() => selectedId && onDelete(selectedId)}>Supprimer</button>
                <button class="btn btn-sm btn-primary" disabled={!selectedGrid} onclick={() => selectedGrid && onOpen(selectedGrid)}>Ouvrir</button>
            </div>
        {/if}
    </div>
    <button type="button" class="modal-backdrop" onclick={onClose} aria-label="Fermer"></button>
</div>
