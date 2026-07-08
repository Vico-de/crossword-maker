<script lang="ts">
    import type { Cell } from '../../models/types';
    import { renderPreview } from '../../lib/previewRenderer';

    interface Props {
        cells: Cell[][];
        cell?: number;
    }

    let { cells, cell = 16 }: Props = $props();

    // On rend à 3× la taille logique pour rester net sur écrans haute densité.
    const RES = 3;
    const cols = $derived(cells[0]?.length || 0);

    let url = $state<string | null>(null);
    let loading = $state(true);

    $effect(() => {
        const rows = cells.map((row) => row.map((c) => ({ b: c.isBlack, v: c.value })));
        loading = true;
        let cancelled = false;
        let created: string | null = null;
        renderPreview(rows, cell * RES).then((next) => {
            if (cancelled) {
                URL.revokeObjectURL(next);
                return;
            }
            if (url) URL.revokeObjectURL(url);
            created = next;
            url = next;
            loading = false;
        });
        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
    });
</script>

{#if loading || !url}
    <div class="flex items-center gap-2 p-4 text-sm opacity-70">
        <span class="loading loading-spinner loading-sm"></span>
        Génération de l'aperçu…
    </div>
{:else}
    <img src={url} alt="Aperçu de la grille" class="max-h-full max-w-full rounded-sm border border-base-300" style:width={`${cols * cell}px`} />
{/if}
