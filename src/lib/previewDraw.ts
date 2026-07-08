// Dessin d'un aperçu de grille sur un canvas (partagé entre le worker et le
// rendu principal de secours). Volontairement simple : cases + lettres + lignes.
export type PreviewRow = { b: boolean; v: string }[];

export function drawPreview(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    rows: PreviewRow[],
    cellPx: number
) {
    const cols = rows[0]?.length || 0;
    const height = rows.length;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cols * cellPx, height * cellPx);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.floor(cellPx * 0.62)}px sans-serif`;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < cols; x++) {
            const c = rows[y][x];
            if (c.b) {
                ctx.fillStyle = '#111827';
                ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
            } else if (c.v) {
                ctx.fillStyle = '#111827';
                ctx.fillText(c.v, x * cellPx + cellPx / 2, y * cellPx + cellPx / 2 + 1);
            }
        }
    }

    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) {
        const px = Math.min(x * cellPx + 0.5, cols * cellPx - 0.5);
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height * cellPx);
    }
    for (let y = 0; y <= height; y++) {
        const py = Math.min(y * cellPx + 0.5, height * cellPx - 0.5);
        ctx.moveTo(0, py);
        ctx.lineTo(cols * cellPx, py);
    }
    ctx.stroke();
}
