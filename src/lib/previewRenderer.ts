import { drawPreview, type PreviewRow } from './previewDraw';

// Rend l'aperçu hors du thread principal via un worker + OffscreenCanvas ;
// repli sur un canvas classique si indisponible. Renvoie une URL d'objet.
let worker: Worker | null = null;
let workerBroken = false;
const pending = new Map<number, (url: string) => void>();
let nextId = 1;

const getWorker = (): Worker | null => {
    if (workerBroken) return null;
    if (worker) return worker;
    try {
        worker = new Worker(new URL('./previewWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e: MessageEvent<{ id: number; blob: Blob }>) => {
            const resolve = pending.get(e.data.id);
            if (resolve) {
                pending.delete(e.data.id);
                resolve(URL.createObjectURL(e.data.blob));
            }
        };
        worker.onerror = () => {
            workerBroken = true;
        };
    } catch {
        workerBroken = true;
        worker = null;
    }
    return worker;
};

const drawOnMainThread = (rows: PreviewRow[], cellPx: number): Promise<string> => {
    const cols = rows[0]?.length || 0;
    const height = rows.length;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, cols * cellPx);
    canvas.height = Math.max(1, height * cellPx);
    const ctx = canvas.getContext('2d');
    if (ctx) drawPreview(ctx, rows, cellPx);
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL()), 'image/png');
    });
};

export const renderPreview = (rows: PreviewRow[], cellPx: number): Promise<string> => {
    const w = getWorker();
    if (!w) return drawOnMainThread(rows, cellPx);
    return new Promise((resolve) => {
        const id = nextId++;
        pending.set(id, resolve);
        w.postMessage({ id, rows, cellPx });
    });
};
