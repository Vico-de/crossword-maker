import { Grid, UserWord, Definition } from '../models/types';

export class ApiService {
    private static baseUrl = '/api';

    static async saveGrid(grid: Grid, asDraft: boolean): Promise<Grid> {
        const response = await fetch(`${this.baseUrl}/grids`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...grid, status: asDraft ? 'draft' : 'published' })
        });

        if (!response.ok) {
            throw new Error('Failed to save grid');
        }

        return response.json();
    }

    static async getUserDictionary(): Promise<UserWord[]> {
        const response = await fetch(`${this.baseUrl}/dictionary/user`);
        if (!response.ok) {
            throw new Error('Failed to fetch user dictionary');
        }
        return response.json();
    }

    static async addWordToDictionary(word: Omit<UserWord, 'id'>): Promise<UserWord> {
        const response = await fetch(`${this.baseUrl}/dictionary/user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(word)
        });

        if (!response.ok) {
            throw new Error('Failed to add word to dictionary');
        }

        return response.json();
    }
}