export interface CrosswordState {
    currentGrid?: {
        name: string;
        cells: Cell[][];
        size: { width: number; height: number };
        words: GridWord[];
    };
    selectedCell: { x: number; y: number } | null;
    selectedDirection: 'horizontal' | 'vertical';
    userDictionary: Dictionary;
    savedGrids: SavedGrid[];  // Ajout de cette ligne
}

export interface Word {
    id: string;
    definition?: string;
    // autres propriétés nécessaires
}

export interface Dictionary {
    // définir la structure de votre dictionnaire
}
// Représente une cellule individuelle dans la grille
export interface Cell {
    value: string;
    isBlack: boolean;
    definition?: string;  // La définition à afficher dans la case noire
    hasValidBlackCell?: boolean;  // Pour indiquer si le mot a une case noire valide pour la définition
    x: number;
    y: number;
    // ajoutez d'autres propriétés si nécessaire
}

// Représente la grille complète
export interface Grid {
    cells: Cell[][];
    size: {
        width: number;
        height: number;
    };
    name?: string;
    words?: GridWord[];
}

// Représente une définition de mot
export interface Definition {
    text: string;           // Le texte de la définition
    hint?: string;          // Indice optionnel
    difficulty?: number;    // Niveau de difficulté (1-5)
    category?: string;      // Catégorie (ex: "Histoire", "Géographie", etc.)
}

// Représente un mot sauvegardé par l'utilisateur
export interface UserWord {
    id: string;            // Identifiant unique
    word: string;          // Le mot
    definition: Definition;// Sa définition
    language?: string;     // Langue du mot
    dateAdded?: Date;     // Date d'ajout
    timesUsed?: number;   // Nombre d'utilisations
}

// Représente un mot placé dans la grille
export interface GridWord {
    word: string;
    x: number;
    y: number;
    direction: 'horizontal' | 'vertical';
}

// Types d'actions possibles dans le jeu
export type Direction = 'horizontal' | 'vertical';

// État du jeu
export interface GameState {
    isEditing: boolean;    // Mode édition ou jeu
    isComplete: boolean;   // Si la grille est complétée
    timer?: number;        // Temps écoulé en secondes
    score?: number;        // Score du joueur
}

// Configuration du jeu
export interface GameConfig {
    allowHints: boolean;   // Si les indices sont autorisés
    timerEnabled: boolean; // Si le chronomètre est activé
    difficulty: 'easy' | 'medium' | 'hard'; // Niveau de difficulté
    language: string;      // Langue du jeu
    gridSize: {
        width: number;
        height: number;
    };
}

// Stats du joueur
export interface PlayerStats {
    gamesCompleted: number;
    averageTime: number;
    bestTime: number;
    totalScore: number;
    wordsFound: number;
}
// Modifions aussi l'interface SavedGrid pour utiliser le bon type
export interface SavedGrid {
    id: string;
    name: string;
    timestamp: number;
    grid: Grid;
}