// Génération de PDF vectoriel (texte éditable, polices embarquées) via pdf-lib.
import type { AppearanceSettings, Grid, WordDefinitionData } from '../models/types';
import { buildPlacementsForGrid } from './words';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFHexString, PDFName, StandardFonts, type PDFFont, type PDFRef } from 'pdf-lib';

import interNormal from '@fontsource/inter/files/inter-latin-400-normal.woff?url';
import interBold from '@fontsource/inter/files/inter-latin-700-normal.woff?url';
import interItalic from '@fontsource/inter/files/inter-latin-400-italic.woff?url';
import interBoldItalic from '@fontsource/inter/files/inter-latin-700-italic.woff?url';
import robotoNormal from '@fontsource/roboto/files/roboto-latin-400-normal.woff?url';
import robotoBold from '@fontsource/roboto/files/roboto-latin-700-normal.woff?url';
import robotoItalic from '@fontsource/roboto/files/roboto-latin-400-italic.woff?url';
import robotoBoldItalic from '@fontsource/roboto/files/roboto-latin-700-italic.woff?url';
import latoNormal from '@fontsource/lato/files/lato-latin-400-normal.woff?url';
import latoBold from '@fontsource/lato/files/lato-latin-700-normal.woff?url';
import latoItalic from '@fontsource/lato/files/lato-latin-400-italic.woff?url';
import latoBoldItalic from '@fontsource/lato/files/lato-latin-700-italic.woff?url';
import openSansNormal from '@fontsource/open-sans/files/open-sans-latin-400-normal.woff?url';
import openSansBold from '@fontsource/open-sans/files/open-sans-latin-700-normal.woff?url';
import openSansItalic from '@fontsource/open-sans/files/open-sans-latin-400-italic.woff?url';
import openSansBoldItalic from '@fontsource/open-sans/files/open-sans-latin-700-italic.woff?url';
import montserratNormal from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url';
import montserratBold from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff?url';
import montserratItalic from '@fontsource/montserrat/files/montserrat-latin-400-italic.woff?url';
import montserratBoldItalic from '@fontsource/montserrat/files/montserrat-latin-700-italic.woff?url';

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
    definitionFontWeight: 'normal' | 'bold';
    definitionFontStyle: 'normal' | 'italic';
    gridFont: string;
    gridFontWeight: 'normal' | 'bold';
    gridFontStyle: 'normal' | 'italic';
    definitionFontData?: string;
    gridFontData?: string;
};

// ── Font mapping ──────────────────────────────────────────────────────────────

const pdfBaseFont = (fontFamily: string) =>
    /courier|mono|consolas/i.test(fontFamily)
        ? 'Courier'
        : /georgia|times|garamond|playfair|serif/i.test(fontFamily)
          ? 'Times-Roman'
          : 'Helvetica';

const standardFontWithVariant = (family: string, weight: 'normal' | 'bold', style: 'normal' | 'italic') => {
    const base = pdfBaseFont(family);
    const bold = weight === 'bold';
    const italic = style === 'italic';

    if (base === 'Courier') {
        if (bold && italic) return StandardFonts.CourierBoldOblique;
        if (bold) return StandardFonts.CourierBold;
        if (italic) return StandardFonts.CourierOblique;
        return StandardFonts.Courier;
    }
    if (base === 'Times-Roman') {
        if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
        if (bold) return StandardFonts.TimesRomanBold;
        if (italic) return StandardFonts.TimesRomanItalic;
        return StandardFonts.TimesRoman;
    }
    if (bold && italic) return StandardFonts.HelveticaBoldOblique;
    if (bold) return StandardFonts.HelveticaBold;
    if (italic) return StandardFonts.HelveticaOblique;
    return StandardFonts.Helvetica;
};

const standardFont = (family: string) => {
    const base = pdfBaseFont(family);
    return base === 'Courier' ? StandardFonts.Courier : base === 'Times-Roman' ? StandardFonts.TimesRoman : StandardFonts.Helvetica;
};

const bundledFontUrl = (family: string, weight: 'normal' | 'bold', style: 'normal' | 'italic') => {
    const bold = weight === 'bold';
    const italic = style === 'italic';

    if (/montserrat/i.test(family)) return bold ? (italic ? montserratBoldItalic : montserratBold) : (italic ? montserratItalic : montserratNormal);
    if (/open sans/i.test(family)) return bold ? (italic ? openSansBoldItalic : openSansBold) : (italic ? openSansItalic : openSansNormal);
    if (/roboto/i.test(family)) return bold ? (italic ? robotoBoldItalic : robotoBold) : (italic ? robotoItalic : robotoNormal);
    if (/lato/i.test(family)) return bold ? (italic ? latoBoldItalic : latoBold) : (italic ? latoItalic : latoNormal);
    if (/inter/i.test(family)) return bold ? (italic ? interBoldItalic : interBold) : (italic ? interItalic : interNormal);
    return undefined;
};

const dataUrlBytes = (dataUrl: string) => {
    const encoded = dataUrl.split(',')[1] || '';
    return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
};

// ── Rendering ─────────────────────────────────────────────────────────────────

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

    const py = (screenY: number) => boardHeight - screenY;

    const cssWeight = (w: 'normal' | 'bold') => (w === 'bold' ? 'bold' : 'normal');
    const cssStyle = (s: 'normal' | 'italic') => (s === 'italic' ? 'italic' : 'normal');
    const measureFont = (size: number, family: string, weight: string, style: string) =>
        `${style} ${weight} ${size}px ${family}`;

    // Text width via canvas (used for layout calculations during rendering).
    const textWidth = (text: string, size: number, family = appearance.definitionFont, weight = 'normal', style = 'normal') => {
        if (!measureCtx) return text.length * size * 0.5;
        measureCtx.font = measureFont(size, family, weight, style);
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

        const defWeight = cssWeight(appearance.definitionFontWeight);
        const defStyle = cssStyle(appearance.definitionFontStyle);

        for (let size = Math.floor(upperBound); size >= 4; size -= 1) {
            measureCtx.font = measureFont(size, appearance.definitionFont, defWeight, defStyle);
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

    // Text marker: embeds layout info resolved later by decodeTextMarkers
    // using the actual PDF font metrics for perfect centering.
    const centeredText = (text: string, centerX: number, baseline: number, size: number) => {
        const encoded = btoa(unescape(encodeURIComponent(text)));
        return ['BT', `{{TEXT:centerX=${centerX.toFixed(4)}|baseline=${baseline.toFixed(4)}|size=${size.toFixed(4)}|text=${encoded}}}`, 'ET'];
    };

    const defWeight = cssWeight(appearance.definitionFontWeight);
    const defStyle = cssStyle(appearance.definitionFontStyle);
    const gridWeight = cssWeight(appearance.gridFontWeight);
    const gridStyle = cssStyle(appearance.gridFontStyle);

    // Structured layers for the PDF.
    const layers = {
        background: [] as string[],
        grid: [] as string[],
        definitions: [] as string[],
        letters: [] as string[],
        borders: [] as string[],
        arrows: [] as string[]
    };

    // ── Layer 1: Background cells ────────────────────────────────────────────
    grid.cells.forEach((row, y) => {
        row.forEach((cell, x) => {
            const left = x * cellSize;
            const topScreen = y * cellSize;

            layers.background.push(rgbFill(cell.isBlack ? appearance.blackCellColor : appearance.cellBackgroundColor));
            layers.background.push(`${left.toFixed(2)} ${py(topScreen + cellSize).toFixed(2)} ${cellSize.toFixed(2)} ${cellSize.toFixed(2)} re f`);
        });
    });

    // ── Layer 2: Grid structure (definition backgrounds + segment separators) ─
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
                        layers.grid.push(`${appearance.gridLineWidth.toFixed(2)} w`);
                        for (let i = 1; i < slots; i += 1) {
                            const sep = py(topScreen + segH * i);
                            layers.grid.push(`${left.toFixed(2)} ${sep.toFixed(2)} m ${(left + cellSize).toFixed(2)} ${sep.toFixed(2)} l S`);
                        }
                    }
                }
            }
        });
    });

    // ── Layer 3: Definitions text ─────────────────────────────────────────────
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
                        measureCtx.font = measureFont(fontSize, appearance.definitionFont, defWeight, defStyle);
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

    // ── Layer 4: Letters (conditionally included) ─────────────────────────────
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
                            fontSize
                        )
                    );
                }
            });
        });
    }

    // ── Layer 5: Borders (outer frame + inner grid lines + dashed separators) ─
    const sepSet = new Set(grid.separators || []);
    layers.borders.push(rgbStroke(appearance.borderColor));
    layers.borders.push(`${appearance.gridLineWidth.toFixed(2)} w`);
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

    if (sepSet.size > 0) {
        layers.borders.push(rgbStroke(appearance.borderColor));
        layers.borders.push(`${appearance.gridLineWidth.toFixed(2)} w`);
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

    // ── Layer 6: Arrows (flattened from SVG geometry, round caps/joins) ───────
    const S = cellSize;
    layers.arrows.push(rgbStroke(appearance.arrowColor));
    layers.arrows.push(`${(0.04 * S).toFixed(2)} w`);
    layers.arrows.push('1 j');
    layers.arrows.push('1 J');
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

            // Arrowhead
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
    layers.arrows.push('0 j');
    layers.arrows.push('0 J');

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
        definitionFontWeight: appearance.definitionFontWeight,
        definitionFontStyle: appearance.definitionFontStyle,
        gridFont: appearance.gridFont,
        gridFontWeight: appearance.gridFontWeight,
        gridFontStyle: appearance.gridFontStyle,
        definitionFontData: appearance.definitionFontData,
        gridFontData: appearance.gridFontData
    };
};

// ── PDF document builder ──────────────────────────────────────────────────────

const buildPdfDocument = async (pages: PdfPage[]) => {
    const document = await PDFDocument.create();
    document.registerFontkit(fontkit);
    const first = pages[0];

    const embed = async (family: string, weight: 'normal' | 'bold', style: 'normal' | 'italic', data?: string) => {
        if (data) return document.embedFont(dataUrlBytes(data), { subset: true });
        const url = bundledFontUrl(family, weight, style);
        if (url) return document.embedFont(await fetch(url).then((response) => response.arrayBuffer()), { subset: true });
        return document.embedFont(standardFontWithVariant(family, weight, style));
    };

    const definitionFont = await embed(
        first?.definitionFont || 'Helvetica',
        first?.definitionFontWeight || 'normal',
        first?.definitionFontStyle || 'normal',
        first?.definitionFontData
    );
    const gridFont = await embed(
        first?.gridFont || 'Helvetica',
        first?.gridFontWeight || 'normal',
        first?.gridFontStyle || 'normal',
        first?.gridFontData
    );

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

    // Resolve centered text markers using actual PDF font metrics.
    const decodeTextMarkers = (content: string, font: PDFFont) =>
        content.replace(
            /\{\{TEXT:centerX=([0-9.]+)\|baseline=([0-9.]+)\|size=([0-9.]+)\|text=([^}]+)\}\}/g,
            (_match, cx: string, baseline: string, size: string, encoded: string) => {
                const text = decodeURIComponent(escape(atob(encoded)));
                const fontSize = Number(size);
                const centerX = Number(cx);
                const tw = font.widthOfTextAtSize(text, fontSize);
                const startX = centerX - tw / 2;
                return `${startX.toFixed(2)} ${baseline} Td ${font.encodeText(text).toString()} Tj`;
            }
        );

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

export const downloadPdf = async (pages: PdfPage[], filename: string) => {
    const blob = await buildPdfDocument(pages);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};
