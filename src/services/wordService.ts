export class WordService {
    static normalizeWord(word: string): string {
        return word
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
    }

    static validateWord(word: string): boolean {
        // Vérification basique - à étendre selon les besoins
        return /^[A-ZÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ]+$/i.test(word);
    }

    static findMatchingWords(pattern: string, dictionary: string[]): string[] {
        const regexPattern = pattern
            .split('')
            .map(char => (char === '?' ? '.' : char))
            .join('');
        const regex = new RegExp(`^${regexPattern}$`, 'i');

        return dictionary.filter(word => regex.test(word));
    }
}