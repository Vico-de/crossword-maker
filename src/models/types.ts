export type Direction = 'horizontal' | 'vertical';

// Une cellule individuelle de la grille.
export interface Cell {
    value: string;
    isBlack: boolean;
    x: number;
    y: number;
    isHighlighted?: boolean;
}

// La grille complète.
export interface Grid {
    cells: Cell[][];
    size: { width: number; height: number };
    name?: string;
    set?: string;
    words?: GridWord[];
    status?: 'initial' | 'loaded';
    // Séparateurs pointillés entre deux cases voisines. Clé : `${x}-${y}-r`
    // (bord droit) ou `${x}-${y}-b` (bord bas) de la case (x, y).
    separators?: string[];
}

// Un mot placé dans la grille.
export interface GridWord {
    word: string;
    x: number;
    y: number;
    direction: Direction;
}

// Où et comment afficher la flèche d'une définition.
export interface WordDefinitionPlacement {
    x: number;
    y: number;
    direction: 'up' | 'down' | 'left' | 'right';
    anchor: { x: number; y: number };
    anchorRole: 'start' | 'end';
    wordDirection: Direction;
    arrowStyle?: 'auto' | 'curved';
    curvedVariant?: 'curved-right' | 'curved-left';
    attachment?: 'left' | 'right' | 'top' | 'bottom';
    order?: number;
    segmentColor?: string;
    segmentTextColor?: string;
    segmentFontSize?: number;
}

export interface WordDefinitionData {
    definition: string;
    placement?: WordDefinitionPlacement;
}

// Une grille sauvegardée par l'utilisateur.
export interface SavedGrid {
    id: string;
    name: string;
    timestamp: number;
    grid: Grid;
    definitions?: Record<string, WordDefinitionData>;
    // Pool de définitions (par mot), conservé même si le mot disparaît de la grille.
    pool?: Record<string, string>;
}

// Un ensemble de grilles partageant une apparence.
export interface GridSet {
    id: string;
    name: string;
    grids: SavedGrid[];
    appearance?: AppearanceSettings;
}

export interface AppearanceSettings {
    blackCellColor: string;
    cellBackgroundColor: string;
    arrowColor: string;
    letterColor: string;
    definitionTextColor: string;
    borderColor: string;
    separatorColor: string;
    separatorWidth: number;
    gridFont: string;
    gridFontWeight: 'normal' | 'bold';
    gridFontStyle: 'normal' | 'italic';
    definitionFont: string;
    definitionFontWeight: 'normal' | 'bold';
    definitionFontStyle: 'normal' | 'italic';
    // Data URLs des polices chargées par l'utilisateur. Elles sont conservées
    // avec les réglages afin de pouvoir être incorporées à l'export PDF.
    gridFontData?: string;
    definitionFontData?: string;
    backgroundImage?: string;
}
