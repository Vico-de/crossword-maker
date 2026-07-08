<script lang="ts">
    import type { AppearanceSettings, WordDefinitionPlacement } from '../../models/types';

    interface Props {
        selectedBlackCell: { x: number; y: number } | null;
        selectedBlackCellDefinitions: { word: string; placement: WordDefinitionPlacement; definition: string }[];
        appearance: AppearanceSettings;
        wordsList: string[];
        filteredWordsList: string[];
        duplicateWords: Set<string>;
        defPool: Record<string, string>;
        placements: Record<string, WordDefinitionPlacement>;
        selectedWord: string | null;
        candidateCount: number;
        wordSearch: string;
        onFocusInput: (focused: boolean) => void;
        onWordSelect: (word: string) => void;
        onDefinitionChange: (value: string) => void;
        onUpdatePlacement: (word: string, updater: (p: WordDefinitionPlacement) => WordDefinitionPlacement) => void;
        onRemovePlacement: (word: string) => void;
        onCloseBlackCell: () => void;
        onClearSelection: () => void;
    }

    let {
        selectedBlackCell,
        selectedBlackCellDefinitions,
        appearance,
        wordsList,
        filteredWordsList,
        duplicateWords,
        defPool,
        placements,
        selectedWord,
        candidateCount,
        wordSearch = $bindable(),
        onFocusInput,
        onWordSelect,
        onDefinitionChange,
        onUpdatePlacement,
        onRemovePlacement,
        onCloseBlackCell,
        onClearSelection
    }: Props = $props();

    let wordListEl = $state<HTMLElement | null>(null);

    // Fait défiler la liste jusqu'au mot sélectionné.
    $effect(() => {
        const word = selectedWord;
        const list = wordListEl;
        if (!word || !list) return;
        list.querySelector(`[data-word="${CSS.escape(word)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
</script>

<aside class="flex w-80 shrink-0 flex-col gap-3 overflow-hidden border-l border-base-300 bg-base-100 p-4">
    {#if selectedBlackCell}
        <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-auto pr-1">
            <div class="flex items-center justify-between">
                <h3 class="font-semibold">Case noire ({selectedBlackCell.x + 1}, {selectedBlackCell.y + 1})</h3>
                <button type="button" class="btn btn-xs btn-ghost" onclick={onCloseBlackCell}>Fermer</button>
            </div>
            {#if selectedBlackCellDefinitions.length === 0}
                <p class="text-sm opacity-60">Aucune définition associée à cette case noire.</p>
            {:else}
                {#each selectedBlackCellDefinitions as item (item.word)}
                    <div class="card card-border bg-base-100">
                        <div class="card-body gap-2 p-3">
                            <strong>{item.word}</strong>
                            <div class="text-sm opacity-80">
                                {#if item.definition}{item.definition}{:else}<em>Définition vide</em>{/if}
                            </div>
                            <label class="text-xs" for={`font-size-${item.word}`}>Taille de police</label>
                            <input
                                id={`font-size-${item.word}`}
                                type="range"
                                class="range range-xs"
                                min={3}
                                max={48}
                                value={item.placement.segmentFontSize ?? 10}
                                oninput={(e) => onUpdatePlacement(item.word, (p) => ({ ...p, segmentFontSize: Number(e.currentTarget.value) }))}
                            />
                            <div class="flex items-center gap-2 text-xs">
                                <label for={`seg-bg-${item.word}`}>Fond</label>
                                <input
                                    id={`seg-bg-${item.word}`}
                                    type="color"
                                    class="h-7 w-9 rounded border border-base-300 bg-base-100"
                                    value={item.placement.segmentColor || appearance.blackCellColor}
                                    oninput={(e) => onUpdatePlacement(item.word, (p) => ({ ...p, segmentColor: e.currentTarget.value }))}
                                />
                                <label for={`seg-text-${item.word}`}>Texte</label>
                                <input
                                    id={`seg-text-${item.word}`}
                                    type="color"
                                    class="h-7 w-9 rounded border border-base-300 bg-base-100"
                                    value={item.placement.segmentTextColor || appearance.definitionTextColor}
                                    oninput={(e) => onUpdatePlacement(item.word, (p) => ({ ...p, segmentTextColor: e.currentTarget.value }))}
                                />
                            </div>
                            <button type="button" class="btn btn-xs btn-ghost text-error self-start" onclick={() => onRemovePlacement(item.word)}>Retirer le placement</button>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    {:else}
        <h3 class="shrink-0 font-semibold">Mots trouvés ({wordsList.length})</h3>
        <input
            type="search"
            class="input input-sm w-full shrink-0"
            placeholder="Rechercher un mot…"
            bind:value={wordSearch}
            onfocus={() => onFocusInput(true)}
            onblur={() => onFocusInput(false)}
        />
        <ul bind:this={wordListEl} class="menu min-h-0 w-full flex-1 flex-nowrap gap-1 overflow-y-auto overflow-x-hidden p-0">
            {#each filteredWordsList as word, index (`${word}-${index}`)}
                <li>
                    <button data-word={word} class="flex w-full items-center justify-between" class:menu-active={selectedWord === word} onclick={() => onWordSelect(word)}>
                        <span class="truncate font-medium" class:text-error={duplicateWords.has(word)}>{word}</span>
                        <span class="flex items-center gap-1">
                            {#if duplicateWords.has(word)}<span class="badge badge-error badge-xs" title="Mot en double">2×</span>{/if}
                            {#if defPool[word]}<span title="Définition ajoutée">📝</span>{/if}
                            {#if placements[word]}<span title="Emplacement choisi">📍</span>{/if}
                        </span>
                    </button>
                </li>
            {:else}
                <li class="px-2 py-1 text-sm opacity-60">Aucun mot ne correspond.</li>
            {/each}
        </ul>

        {#if selectedWord}
            <div class="card card-border shrink-0 bg-base-100">
                <div class="card-body gap-2 p-3">
                    <h4 class="font-semibold">{selectedWord}</h4>
                    <label class="text-xs" for="definition-textarea">Définition</label>
                    <textarea
                        id="definition-textarea"
                        class="textarea w-full"
                        value={defPool[selectedWord] ?? ''}
                        oninput={(e) => onDefinitionChange(e.currentTarget.value)}
                        onfocus={onClearSelection}
                        placeholder="Écrire ou coller la définition du mot"
                    ></textarea>
                    {#if duplicateWords.has(selectedWord)}
                        <p class="text-sm text-error">Mot en double — placement de définition non géré.</p>
                    {:else if placements[selectedWord]}
                        <div class="flex items-center justify-between text-sm">
                            <span>Case noire : ({placements[selectedWord].x + 1}, {placements[selectedWord].y + 1})</span>
                            <button type="button" class="btn btn-xs btn-ghost text-error" onclick={() => onRemovePlacement(selectedWord!)}>Retirer</button>
                        </div>
                    {:else if candidateCount > 0}
                        <p class="text-sm opacity-70">Cliquez une case noire surlignée autour du mot pour y placer la définition.</p>
                    {:else}
                        <p class="text-sm opacity-60">Aucune case noire disponible autour de ce mot.</p>
                    {/if}
                </div>
            </div>
        {/if}
    {/if}
</aside>
