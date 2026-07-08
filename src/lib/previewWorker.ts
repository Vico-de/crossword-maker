import { drawPreview, type PreviewRow } from './previewDraw';

self.onmessage = async (e: MessageEvent<{ id: number; rows: PreviewRow[]; cellPx: number }>) => {
    const { id, rows, cellPx } = e.data;
    const cols = rows[0]?.length || 0;
    const height = rows.length;
    const canvas = new OffscreenCanvas(Math.max(1, cols * cellPx), Math.max(1, height * cellPx));
    const ctx = canvas.getContext('2d');
    if (ctx) drawPreview(ctx, rows, cellPx);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    (self as unknown as Worker).postMessage({ id, blob });
};
