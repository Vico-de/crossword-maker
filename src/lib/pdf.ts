// Génération de PDF vectoriel (texte éditable, polices standard) sans dépendance.
import type { AppearanceSettings, Grid, WordDefinitionData } from '../models/types';
import { buildPlacementsForGrid } from './words';

const escapePdfText = (text: string) =>
    text.replace(/[\\()]/g, (char) => (char === '\\' ? '\\\\' : char === '(' ? '\\(' : '\\)'));

const hexToRgb = (hex: string): [number, number, number] => {
    const normalized = hex.replace('#', '');
    const value =
        normalized.length === 3
            ? normalized
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : normalized.padEnd(6, '0');
    const intVal = parseInt(value, 16);
    return [((intVal >> 16) & 255) / 255, ((intVal >> 8) & 255) / 255, (intVal & 255) / 255];
};

type PdfPage = { width: number; height: number; content: string; font: string; font2: string };

// Choisit l'une des polices standard PDF (toujours éditables) selon la famille.
const pdfBaseFont = (fontFamily: string) =>
    /courier|mono|consolas/i.test(fontFamily)
        ? 'Courier'
        : /georgia|times|garamond|playfair|serif/i.test(fontFamily)
          ? 'Times-Roman'
          : 'Helvetica';

export const renderGridPdfPage = (
    grid: Grid,
    definitions: Record<string, WordDefinitionData>,
    appearance: AppearanceSettings
): PdfPage => {
    const cellSize = 40;
    const boardWidth = grid.size.width * cellSize;
    const boardHeight = grid.size.height * cellSize;

    const { definitionPlacements, arrowPlacements } = buildPlacementsForGrid(grid, definitions);
    const measureCtx = document.createElement('canvas').getContext('2d');

    // Écran (origine haut-gauche) -> PDF (origine bas-gauche) : le texte reste à l'endroit.
    const py = (screenY: number) => boardHeight - screenY;
    const textWidth = (text: string, size: number) => {
        if (!measureCtx) return text.length * size * 0.5;
        measureCtx.font = `${size}px ${appearance.definitionFont}`;
        return measureCtx.measureText(text).width;
    };

    const fitDefinitionSize = (text: string, slotCount: number) => {
        if (!measureCtx) return 12;
        const availableWidth = cellSize - 6;
        const availableHeight = (cellSize - 6) / Math.max(1, slotCount) - 2;
        const words = text.split(/\s+/).filter(Boolean);
        const longestWord = words.reduce((max, w) => Math.max(max, w.length), 0);
        const slotPenalty = slotCount > 1 ? 0.86 : 1;
        const upperBound = Math.min(14, availableHeight, longestWord > 0 ? availableWidth / (longestWord * 0.65) : 14) * slotPenalty;

        for (let size = Math.floor(upperBound); size >= 4; size -= 1) {
            measureCtx.font = `${size}px ${appearance.definitionFont}`;
            const spaceWidth = measureCtx.measureText(' ').width;
            let lineCount = 1;
            let width = 0;
            let fits = true;
            for (const word of words) {
                const w = measureCtx.measureText(word).width;
                if (w > availableWidth) {
                    fits = false;
                    break;
                }
                if (width === 0) width = w;
                else if (width + spaceWidth + w <= availableWidth) width += spaceWidth + w;
                else {
                    lineCount += 1;
                    if (lineCount * size * 1.1 > availableHeight) {
                        fits = false;
                        break;
                    }
                    width = w;
                }
            }
            if (fits) return size;
        }
        return 4;
    };

    const rgbFill = (hex: string) => {
        const [r, g, b] = hexToRgb(hex);
        return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`;
    };
    const rgbStroke = (hex: string) => {
        const [r, g, b] = hexToRgb(hex);
        return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG`;
    };
    // Texte centré horizontalement sur centerX, ligne de base à baseline.
    const centeredText = (text: string, centerX: number, baseline: number, size: number) => {
        const startX = centerX - textWidth(text, size) / 2;
        return ['BT', `${startX.toFixed(2)} ${baseline.toFixed(2)} Td`, `(${escapePdfText(text)}) Tj`, 'ET'];
    };

    const lines: string[] = [];

    grid.cells.forEach((row, y) => {
        row.forEach((cell, x) => {
            const left = x * cellSize;
            const topScreen = y * cellSize;

            lines.push(rgbFill(cell.isBlack ? appearance.blackCellColor : appearance.cellBackgroundColor));
            lines.push(`${left.toFixed(2)} ${py(topScreen + cellSize).toFixed(2)} ${cellSize.toFixed(2)} ${cellSize.toFixed(2)} re f`);

            if (cell.isBlack) {
                const cellDefs = definitionPlacements[`${x}-${y}`];
                if (cellDefs && cellDefs.length > 0 && measureCtx) {
                    const slots = cellDefs.length;
                    const segH = cellSize / slots;
                    cellDefs.forEach((def, index) => {
                        const segTopScreen = topScreen + segH * index;
                        lines.push(rgbFill(def.segmentColor || appearance.blackCellColor));
                        lines.push(`${left.toFixed(2)} ${py(segTopScreen + segH).toFixed(2)} ${cellSize.toFixed(2)} ${segH.toFixed(2)} re f`);

                        const content = (def.definition || def.word).toUpperCase();
                        const fontSize = def.segmentFontSize || fitDefinitionSize(content, slots);
                        const words = content.split(/\s+/).filter(Boolean);
                        const availableWidth = cellSize - 6;
                        const textLines: string[] = [];
                        let current = '';
                        measureCtx.font = `${fontSize}px ${appearance.definitionFont}`;
                        words.forEach((word) => {
                            const tentative = current ? `${current} ${word}` : word;
                            if (measureCtx.measureText(tentative).width <= availableWidth) current = tentative;
                            else {
                                if (current) textLines.push(current);
                                current = word;
                            }
                        });
                        if (current) textLines.push(current);

                        lines.push(rgbFill(def.segmentTextColor || appearance.definitionTextColor));
                        lines.push(`/F1 ${fontSize.toFixed(2)} Tf`);
                        const segCenterScreen = segTopScreen + segH / 2;
                        textLines.forEach((line, lineIndex) => {
                            const lineScreenY = segCenterScreen + (lineIndex - (textLines.length - 1) / 2) * (fontSize * 1.1);
                            lines.push(...centeredText(line, left + cellSize / 2, py(lineScreenY) - fontSize * 0.35, fontSize));
                        });
                    });

                    if (slots > 1) {
                        lines.push(rgbStroke(appearance.separatorColor));
                        lines.push(`${appearance.separatorWidth.toFixed(2)} w`);
                        for (let i = 1; i < slots; i += 1) {
                            const sep = py(topScreen + segH * i);
                            lines.push(`${left.toFixed(2)} ${sep.toFixed(2)} m ${(left + cellSize).toFixed(2)} ${sep.toFixed(2)} l S`);
                        }
                    }
                }
            } else if (cell.value) {
                const fontSize = cellSize * 0.55;
                lines.push(rgbFill(appearance.letterColor));
                lines.push(`/F2 ${fontSize.toFixed(2)} Tf`);
                lines.push(...centeredText(cell.value, left + cellSize / 2, py(topScreen + cellSize / 2) - fontSize * 0.35, fontSize));
            }
        });
    });

    // Bordures : cadre extérieur + arêtes internes (en sautant celles qui portent
    // un séparateur pointillé, pour ne pas dessiner un trait plein dessous).
    const sepSet = new Set(grid.separators || []);
    lines.push(rgbStroke(appearance.borderColor));
    lines.push('1 w');
    lines.push(`0.5 0.5 ${(boardWidth - 1).toFixed(2)} ${(boardHeight - 1).toFixed(2)} re S`);
    for (let y = 0; y < grid.size.height; y++) {
        for (let x = 0; x < grid.size.width - 1; x++) {
            if (sepSet.has(`${x}-${y}-r`)) continue;
            const px = (x + 1) * cellSize;
            lines.push(`${px.toFixed(2)} ${py(y * cellSize).toFixed(2)} m ${px.toFixed(2)} ${py((y + 1) * cellSize).toFixed(2)} l S`);
        }
    }
    for (let x = 0; x < grid.size.width; x++) {
        for (let y = 0; y < grid.size.height - 1; y++) {
            if (sepSet.has(`${x}-${y}-b`)) continue;
            const line = py((y + 1) * cellSize);
            lines.push(`${(x * cellSize).toFixed(2)} ${line.toFixed(2)} m ${((x + 1) * cellSize).toFixed(2)} ${line.toFixed(2)} l S`);
        }
    }

    // Séparateurs pointillés (couleur des bordures).
    if (sepSet.size > 0) {
        lines.push(rgbStroke(appearance.borderColor));
        lines.push('2 w');
        lines.push('[3 3] 0 d');
        sepSet.forEach((sep) => {
            const m = /^(\d+)-(\d+)-([rb])$/.exec(sep);
            if (!m) return;
            const cx = Number(m[1]);
            const cy = Number(m[2]);
            if (m[3] === 'r') {
                const px = (cx + 1) * cellSize;
                lines.push(`${px.toFixed(2)} ${py(cy * cellSize).toFixed(2)} m ${px.toFixed(2)} ${py((cy + 1) * cellSize).toFixed(2)} l S`);
            } else {
                const line = py((cy + 1) * cellSize);
                lines.push(`${(cx * cellSize).toFixed(2)} ${line.toFixed(2)} m ${((cx + 1) * cellSize).toFixed(2)} ${line.toFixed(2)} l S`);
            }
        });
        lines.push('[] 0 d');
    }

    // Flèches : petit repère coudé collé au bord de la case noire.
    lines.push(rgbStroke(appearance.borderColor));
    lines.push('1.5 w');
    const S = cellSize;
    Object.entries(arrowPlacements).forEach(([key, arrows]) => {
        const [ax, ay] = key.split('-').map(Number);
        const left = ax * cellSize;
        const topScreen = ay * cellSize;
        arrows.forEach((arrow) => {
            // Bord vertical (gauche/droite) : la flèche part du milieu de son
            // segment de définition ; bord horizontal : elle reste centrée.
            const vertical = arrow.entry === 'left' || arrow.entry === 'right';
            const shift = vertical && arrow.slotCount > 1 ? ((arrow.slotIndex + 0.5) / arrow.slotCount - 0.5) * S : 0;
            const base =
                arrow.entry === 'left'
                    ? [0, 0.5 * S]
                    : arrow.entry === 'right'
                      ? [S, 0.5 * S]
                      : arrow.entry === 'top'
                        ? [0.5 * S, 0]
                        : [0.5 * S, S];
            const edge = [base[0], base[1] + shift];
            const inw = arrow.entry === 'left' ? [1, 0] : arrow.entry === 'right' ? [-1, 0] : arrow.entry === 'top' ? [0, 1] : [0, -1];
            const bd = arrow.bodyDir === 'left' ? [-1, 0] : arrow.bodyDir === 'right' ? [1, 0] : arrow.bodyDir === 'up' ? [0, -1] : [0, 1];
            const straight = inw[0] === bd[0] && inw[1] === bd[1];
            const lenS = 0.2 * S;
            const lenE = 0.13 * S;
            const pts = straight
                ? [edge, [edge[0] + bd[0] * lenS, edge[1] + bd[1] * lenS]]
                : [
                      edge,
                      [edge[0] + inw[0] * lenE, edge[1] + inw[1] * lenE],
                      [edge[0] + inw[0] * lenE + bd[0] * lenE, edge[1] + inw[1] * lenE + bd[1] * lenE]
                  ];
            const toPdf = (pt: number[]) => [left + pt[0], py(topScreen + pt[1])];
            const pdfPts = pts.map(toPdf);
            lines.push(pdfPts.map(([px, pyy], i) => `${px.toFixed(2)} ${pyy.toFixed(2)} ${i === 0 ? 'm' : 'l'}`).join(' ') + ' S');

            const [tx, ty] = pdfPts[pdfPts.length - 1];
            const ah = 0.13 * S;
            const pdfBd = [bd[0], -bd[1]];
            const perp = [-pdfBd[1], pdfBd[0]];
            const backX = tx - pdfBd[0] * ah;
            const backY = ty - pdfBd[1] * ah;
            const w1x = backX + perp[0] * ah * 0.6;
            const w1y = backY + perp[1] * ah * 0.6;
            const w2x = backX - perp[0] * ah * 0.6;
            const w2y = backY - perp[1] * ah * 0.6;
            lines.push(`${w1x.toFixed(2)} ${w1y.toFixed(2)} m ${tx.toFixed(2)} ${ty.toFixed(2)} l ${w2x.toFixed(2)} ${w2y.toFixed(2)} l S`);
        });
    });

    return {
        width: boardWidth,
        height: boardHeight,
        content: lines.join('\n'),
        font: pdfBaseFont(appearance.definitionFont),
        font2: pdfBaseFont(appearance.gridFont)
    };
};

const buildPdfDocument = (pages: PdfPage[]) => {
    const encoder = new TextEncoder();
    const chunks: (string | Uint8Array)[] = ['%PDF-1.4\n'];
    const offsets: Record<number, number> = {};
    const byteLength = () =>
        chunks.reduce((total, chunk) => total + (typeof chunk === 'string' ? encoder.encode(chunk).length : chunk.length), 0);

    const writeObject = (id: number, content: string) => {
        offsets[id] = byteLength();
        chunks.push(`${id} 0 obj\n${content}\nendobj\n`);
    };

    const writeStream = (id: number, dict: string, data: Uint8Array) => {
        offsets[id] = byteLength();
        chunks.push(`${id} 0 obj\n${dict}\nstream\n`);
        chunks.push(data);
        chunks.push('\nendstream\nendobj\n');
    };

    const catalogId = 1;
    const pagesId = 2;
    const fontId = 3;
    const fontId2 = 4;
    let nextId = 5;

    const preparedPages = pages.map((page) => ({ ...page, pageId: nextId++, contentId: nextId++ }));

    writeObject(fontId, `<< /Type /Font /Subtype /Type1 /BaseFont /${pages[0]?.font || 'Helvetica'} >>`);
    writeObject(fontId2, `<< /Type /Font /Subtype /Type1 /BaseFont /${pages[0]?.font2 || 'Helvetica'} >>`);

    preparedPages.forEach((page) => {
        const contentBytes = encoder.encode(page.content);
        writeStream(page.contentId, `<< /Length ${contentBytes.length} >>`, contentBytes);

        const resources = ['/ProcSet [ /PDF /Text ]', `/Font << /F1 ${fontId} 0 R /F2 ${fontId2} 0 R >>`];
        const pageDict = [
            '<<',
            '/Type /Page',
            `/Parent ${pagesId} 0 R`,
            `/Resources << ${resources.join(' ')} >>`,
            `/MediaBox [0 0 ${page.width} ${page.height}]`,
            `/Contents ${page.contentId} 0 R`,
            '>>'
        ].join(' ');

        writeObject(page.pageId, pageDict);
    });

    writeObject(
        pagesId,
        `<< /Type /Pages /Count ${preparedPages.length} /Kids [${preparedPages.map((page) => `${page.pageId} 0 R`).join(' ')}] >>`
    );
    writeObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    const xrefStart = byteLength();
    chunks.push(`xref\n0 ${nextId}\n`);
    chunks.push('0000000000 65535 f \n');
    for (let i = 1; i < nextId; i++) {
        const offset = offsets[i] ?? 0;
        chunks.push(`${offset.toString().padStart(10, '0')} 00000 n \n`);
    }
    chunks.push(`trailer\n<< /Size ${nextId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    const total = byteLength();
    const buffer = new Uint8Array(total);
    let cursor = 0;
    chunks.forEach((chunk) => {
        if (typeof chunk === 'string') {
            const encoded = encoder.encode(chunk);
            buffer.set(encoded, cursor);
            cursor += encoded.length;
        } else {
            buffer.set(chunk, cursor);
            cursor += chunk.length;
        }
    });

    return new Blob([buffer], { type: 'application/pdf' });
};

// Génère le PDF à partir des pages et déclenche son téléchargement.
export const downloadPdf = (pages: PdfPage[], filename: string) => {
    const blob = buildPdfDocument(pages);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};
