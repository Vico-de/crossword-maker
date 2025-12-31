import type { Grid, GridWord, Cell } from '../models/types';

export class ValidationService {
    static validateGrid(grid: Grid): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Vérification des définitions
        const wordsWithoutDefinition = grid.words.filter(w => !w.selectedDefinition);
        if (wordsWithoutDefinition.length > 0) {
            errors.push(`${wordsWithoutDefinition.length} mot(s) sans définition`);
        }

        // Vérification de la cohérence des lettres
        const letterErrors = this.validateLetterConsistency(grid.cells, grid.words);
        errors.push(...letterErrors);

        // Vérification des cases noires
        const blackCellErrors = this.validateBlackCells(grid.cells);
        errors.push(...blackCellErrors);

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private static validateLetterConsistency(cells: Cell[][], words: GridWord[]): string[] {
        const errors: string[] = [];
        // TODO: Implémenter la vérification de cohérence des lettres
        return errors;
    }

    private static validateBlackCells(cells: Cell[][]): string[] {
        const errors: string[] = [];
        // TODO: Implémenter la vérification des cases noires
        return errors;
    }
}