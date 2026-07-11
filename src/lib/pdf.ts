// Génération de PDF vectoriel (texte éditable, polices standard) sans dépendance.
import type { AppearanceSettings, Grid, WordDefinitionData } from '../models/types';
import { buildPlacementsForGrid } from './words';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFHexString, PDFName, StandardFonts, type PDFFont, type PDFRef } from 'pdf-lib';
import interUrl from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import robotoUrl from '@fontsource/roboto/files/roboto-latin-400-normal.woff?url';
import latoUrl from '@fontsource/lato/files/lato-latin-400-normal.woff?url';
import openSansUrl from '@fontsource/open-sans/files/open-sans-latin-400-normal.woff?url';
import montserratUrl from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url';

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

type LayerName = 'Background' | 'Grid' | 'Letters' | 'Definitions' | 'Borders' | 'Arrows';
type PdfPage = {
    width: number;
    height: number;
    layers: Record<LayerName, string[]>;
    definitionFont: string;
    gridFont: string;
    definitionFontData?: string;
    gridFontData?: string;
};

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
    appearance: AppearanceSettings,
    options: { includeLetters?: boolean } = {}
): PdfPage => {
    const { includeLetters = true } = options;
    const cellSize = 40;
    const boardWidth = grid.size.width * cellSize;
    const boardHeight = grid.size.height * cellSize;

    const { definitionPlacements, arrowPlacements } = buildPlacementsForGrid(grid, definitions);
    const measureCtx = document.createElement('canvas').getContext('2d');

    // Écran (origine haut-gauche) -> PDF (origine bas-gauche) : le texte reste à l'endroit.
    const py = (screenY: number) => boardHeight - screenY;
    const textWidth = (text: string, size: number, family = appearance.definitionFont) => {
        if (!measureCtx) return text.length * size * 0.5;
        measureCtx.font = `${size}px ${family}`;
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
    const centeredText = (text: string, centerX: number, baseline: number, size: number, family?: string) => {
        const startX = centerX - textWidth(text, size, family) / 2;
        const encoded = btoa(unescape(encodeURIComponent(text)));
        return ['BT', `${startX.toFixed(2)} ${baseline.toFixed(2)} Td`, `{{TEXT:${encoded}}} Tj`, 'ET'];
    };

    // Structured layers for better PDF editing
    const layers = {
        background: [] as string[],
        grid: [] as string[],
        definitions: [] as string[],
        letters: [] as string[],
        borders: [] as string[],
        arrows: [] as string[]
    };

    // Layer 1: Background cells
    grid.cells.forEach((row, y) => {
        row.forEach((cell, x) => {
            const left = x * cellSize;
            const topScreen = y * cellSize;

            layers.background.push(rgbFill(cell.isBlack ? appearance.blackCellColor : appearance.cellBackgroundColor));
            layers.background.push(`${left.toFixed(2)} ${py(topScreen + cellSize).toFixed(2)} ${cellSize.toFixed(2)} ${cellSize.toFixed(2)} re f`);
        });
    });

    // Layer 2: Grid structure (definition backgrounds and separators)
    grid.cells.forEach((row, y) => {
        row.forEach((cell, x) => {
            const left = x * cellSize;
            const topScreen = y * cellSize;

            if (cell.isBlack) {
                const cellDefs = definitionPlacements[`${x}-${y}`];
                if (cellDefs && cellDefs.length > 0 && measureCtx) {
                    const slots = cellDefs.length;
                    const segH = cellSize / slots;
                    cellDefs.forEach((def, index) => {
                        const segTopScreen = topScreen + segH * index;
                        layers.grid.push(rgbFill(def.segmentColor || appearance.blackCellColor));
                        layers.grid.push(`${left.toFixed(2)} ${py(segTopScreen + segH).toFixed(2)} ${cellSize.toFixed(2)} ${segH.toFixed(2)} re f`);
                    });

                    if (slots > 1) {
                        layers.grid.push(rgbStroke(appearance.separatorColor));
                        layers.grid.push(`${appearance.separatorWidth.toFixed(2)} w`);
                        for (let i = 1; i < slots; i += 1) {
                            const sep = py(topScreen + segH * i);
                            layers.grid.push(`${left.toFixed(2)} ${sep.toFixed(2)} m ${(left + cellSize).toFixed(2)} ${sep.toFixed(2)} l S`);
                        }
                    }
                }
            }
        });
    });

    // Layer 3: Definitions text
    grid.cells.forEach((row, y) => {
        row.forEach((cell, x) => {
            const left = x * cellSize;
            const topScreen = y * cellSize;

            if (cell.isBlack) {
                const cellDefs = definitionPlacements[`${x}-${y}`];
                if (cellDefs && cellDefs.length > 0 && measureCtx) {
                    const slots = cellDefs.length;
                    const segH = cellSize / slots;
                    cellDefs.forEach((def, index) => {
                        const segTopScreen = topScreen + segH * index;

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

                        layers.definitions.push(rgbFill(def.segmentTextColor || appearance.definitionTextColor));
                        layers.definitions.push(`/F1 ${fontSize.toFixed(2)} Tf`);
                        const segCenterScreen = segTopScreen + segH / 2;
                        textLines.forEach((line, lineIndex) => {
                            const lineScreenY = segCenterScreen + (lineIndex - (textLines.length - 1) / 2) * (fontSize * 1.1);
                            layers.definitions.push(...centeredText(line, left + cellSize / 2, py(lineScreenY) - fontSize * 0.35, fontSize));
                        });
                    });
                }
            }
        });
    });

    // Layer 4: Letters (conditionally included)
    if (includeLetters) {
        grid.cells.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (!cell.isBlack && cell.value) {
                    const left = x * cellSize;
                    const topScreen = y * cellSize;
                    const fontSize = cellSize * 0.55;
                    layers.letters.push(rgbFill(appearance.letterColor));
                    layers.letters.push(`/F2 ${fontSize.toFixed(2)} Tf`);
                    layers.letters.push(
                        ...centeredText(
                            cell.value,
                            left + cellSize / 2,
                            py(topScreen + cellSize / 2) - fontSize * 0.35,
                            fontSize,
                            appearance.gridFont
                        )
                    );
                }
            });
        });
    }

    // Layer 5: Borders (outer frame and inner grid lines)
    const sepSet = new Set(grid.separators || []);
    layers.borders.push(rgbStroke(appearance.borderColor));
    layers.borders.push('1 w');
    layers.borders.push(`0.5 0.5 ${(boardWidth - 1).toFixed(2)} ${(boardHeight - 1).toFixed(2)} re S`);
    for (let y = 0; y < grid.size.height; y++) {
        for (let x = 0; x < grid.size.width - 1; x++) {
            if (sepSet.has(`${x}-${y}-r`)) continue;
            const px = (x + 1) * cellSize;
            layers.borders.push(`${px.toFixed(2)} ${py(y * cellSize).toFixed(2)} m ${px.toFixed(2)} ${py((y + 1) * cellSize).toFixed(2)} l S`);
        }
    }
    for (let x = 0; x < grid.size.width; x++) {
        for (let y = 0; y < grid.size.height - 1; y++) {
            if (sepSet.has(`${x}-${y}-b`)) continue;
            const line = py((y + 1) * cellSize);
            layers.borders.push(`${(x * cellSize).toFixed(2)} ${line.toFixed(2)} m ${((x + 1) * cellSize).toFixed(2)} ${line.toFixed(2)} l S`);
        }
    }

    // Dashed separators
    if (sepSet.size > 0) {
        layers.borders.push(rgbStroke(appearance.borderColor));
        layers.borders.push('2 w');
        layers.borders.push('[3 3] 0 d');
        sepSet.forEach((sep) => {
            const m = /^(\d+)-(\d+)-([rb])$/.exec(sep);
            if (!m) return;
            const cx = Number(m[1]);
            const cy = Number(m[2]);
            if (m[3] === 'r') {
                const px = (cx + 1) * cellSize;
                layers.borders.push(`${px.toFixed(2)} ${py(cy * cellSize).toFixed(2)} m ${px.toFixed(2)} ${py((cy + 1) * cellSize).toFixed(2)} l S`);
            } else {
                const line = py((cy + 1) * cellSize);
                layers.borders.push(`${(cx * cellSize).toFixed(2)} ${line.toFixed(2)} m ${((cx + 1) * cellSize).toFixed(2)} ${line.toFixed(2)} l S`);
            }
        });
        layers.borders.push('[] 0 d');
    }

    // Layer 6: Arrows
    layers.arrows.push(rgbStroke(appearance.borderColor));
    layers.arrows.push('1.5 w');
    const S = cellSize;
    Object.entries(arrowPlacements).forEach(([key, arrows]) => {
        const [ax, ay] = key.split('-').map(Number);
        const left = ax * cellSize;
        const topScreen = ay * cellSize;
        arrows.forEach((arrow) => {
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
            layers.arrows.push(pdfPts.map(([px, pyy], i) => `${px.toFixed(2)} ${pyy.toFixed(2)} ${i === 0 ? 'm' : 'l'}`).join(' ') + ' S');

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
            layers.arrows.push(`${w1x.toFixed(2)} ${w1y.toFixed(2)} m ${tx.toFixed(2)} ${ty.toFixed(2)} l ${w2x.toFixed(2)} ${w2y.toFixed(2)} l S`);
        });
    });

    return {
        width: boardWidth,
        height: boardHeight,
        layers: {
            Background: layers.background,
            Grid: layers.grid,
            Letters: includeLetters ? layers.letters : [],
            Definitions: layers.definitions,
            Borders: layers.borders,
            Arrows: layers.arrows
        },
        definitionFont: appearance.definitionFont,
        gridFont: appearance.gridFont,
        definitionFontData: appearance.definitionFontData,
        gridFontData: appearance.gridFontData
    };
};

const dataUrlBytes = (dataUrl: string) => {
    const encoded = dataUrl.split(',')[1] || '';
    return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
};

const standardFont = (family: string) => {
    const base = pdfBaseFont(family);
    return base === 'Courier' ? StandardFonts.Courier : base === 'Times-Roman' ? StandardFonts.TimesRoman : StandardFonts.Helvetica;
};

const bundledFontUrl = (family: string) =>
    /montserrat/i.test(family)
        ? montserratUrl
        : /open sans/i.test(family)
          ? openSansUrl
          : /roboto/i.test(family)
            ? robotoUrl
            : /lato/i.test(family)
              ? latoUrl
              : /inter/i.test(family)
                ? interUrl
                : undefined;

const buildPdfDocument = async (pages: PdfPage[]) => {
    const document = await PDFDocument.create();
    document.registerFontkit(fontkit);
    const first = pages[0];
    const embed = async (family: string, data?: string) => {
        if (data) return document.embedFont(dataUrlBytes(data), { subset: true });
        const url = bundledFontUrl(family);
        if (url) return document.embedFont(await fetch(url).then((response) => response.arrayBuffer()), { subset: true });
        return document.embedFont(standardFont(family));
    };
    const definitionFont = await embed(first?.definitionFont || 'Helvetica', first?.definitionFontData);
    const gridFont = await embed(first?.gridFont || 'Helvetica', first?.gridFontData);

    const layerNames: LayerName[] = ['Grid', 'Letters', 'Definitions', 'Background', 'Borders', 'Arrows'];
    const layerRefs = new Map<LayerName, PDFRef>();
    for (const name of layerNames) {
        layerRefs.set(name, document.context.register(document.context.obj({ Type: 'OCG', Name: PDFHexString.fromText(name) })));
    }
    const refs = layerNames.map((name) => layerRefs.get(name)!);
    document.catalog.set(
        PDFName.of('OCProperties'),
        document.context.obj({ OCGs: refs, D: { Name: PDFHexString.fromText('Crossword layers'), Order: refs, ON: refs } })
    );

    const decodeTextMarkers = (content: string, font: PDFFont) =>
        content.replace(/\{\{TEXT:([^}]+)\}\}/g, (_match, encoded: string) => {
            const text = decodeURIComponent(escape(atob(encoded)));
            return font.encodeText(text).toString();
        });

    for (const source of pages) {
        const page = document.addPage([source.width, source.height]);
        const properties: Record<string, PDFRef> = {};
        const paintOrder: LayerName[] = ['Background', 'Grid', 'Definitions', 'Letters', 'Borders', 'Arrows'];
        const content = paintOrder
            .map((name, index) => {
                const propertyName = `Layer${index + 1}`;
                properties[propertyName] = layerRefs.get(name)!;
                let body = source.layers[name].join('\n');
                body = decodeTextMarkers(body, name === 'Letters' ? gridFont : definitionFont);
                return `/OC /${propertyName} BDC\n${body}\nEMC`;
            })
            .join('\n');
        const streamRef = document.context.register(document.context.flateStream(content));
        page.node.set(PDFName.of('Contents'), streamRef);
        page.node.set(
            PDFName.of('Resources'),
            document.context.obj({
                ProcSet: ['PDF', 'Text'],
                Font: { F1: definitionFont.ref, F2: gridFont.ref },
                Properties: properties
            })
        );
    }

    return new Blob([await document.save()], { type: 'application/pdf' });
};

// Génère le PDF à partir des pages et déclenche son téléchargement.
export const downloadPdf = async (pages: PdfPage[], filename: string) => {
    const blob = await buildPdfDocument(pages);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};
