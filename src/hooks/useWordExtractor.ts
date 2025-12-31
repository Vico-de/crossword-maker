// src/hooks/useWordExtractor.ts
import { useMemo } from 'react';
import type { Cell } from '../models/types';

export const useWordExtractor = (cells: Cell[][]) => {
  return useMemo(() => {
    const words: string[] = [];
    const minWordLength = 2; // Longueur minimale d'un mot

    // Extraire les mots horizontaux
    for (let y = 0; y < cells.length; y++) {
      let currentWord = '';
      for (let x = 0; x < cells[y].length; x++) {
        if (!cells[y][x].isBlack && cells[y][x].value) {
          currentWord += cells[y][x].value;
        } else if (currentWord.length >= minWordLength) {
          words.push(currentWord);
          currentWord = '';
        } else {
          currentWord = '';
        }
      }
      if (currentWord.length >= minWordLength) {
        words.push(currentWord);
      }
    }

    // Extraire les mots verticaux
    for (let x = 0; x < cells[0].length; x++) {
      let currentWord = '';
      for (let y = 0; y < cells.length; y++) {
        if (!cells[y][x].isBlack && cells[y][x].value) {
          currentWord += cells[y][x].value;
        } else if (currentWord.length >= minWordLength) {
          words.push(currentWord);
          currentWord = '';
        } else {
          currentWord = '';
        }
      }
      if (currentWord.length >= minWordLength) {
        words.push(currentWord);
      }
    }

    // Trier les mots par ordre alphabétique et supprimer les doublons
    return [...new Set(words)].sort();
  }, [cells]);
};