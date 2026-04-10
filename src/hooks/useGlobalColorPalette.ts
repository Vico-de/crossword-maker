import { useCallback, useEffect, useState } from 'react';

const RECENT_KEY = 'globalRecentColors';
const SAVED_KEY = 'globalSavedPalette';
const EVENT_NAME = 'global-color-palette-updated';

const readColors = (key: string): string[] => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
    } catch {
        return [];
    }
};

export const useGlobalColorPalette = () => {
    const [recentColors, setRecentColors] = useState<string[]>(() => readColors(RECENT_KEY));
    const [savedPalette, setSavedPalette] = useState<string[]>(() => readColors(SAVED_KEY));

    const syncFromStorage = useCallback(() => {
        setRecentColors(readColors(RECENT_KEY));
        setSavedPalette(readColors(SAVED_KEY));
    }, []);

    useEffect(() => {
        const onStorage = () => syncFromStorage();
        const onCustom = () => syncFromStorage();
        window.addEventListener('storage', onStorage);
        window.addEventListener(EVENT_NAME, onCustom);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(EVENT_NAME, onCustom);
        };
    }, [syncFromStorage]);

    const persist = useCallback((nextRecent: string[], nextSaved: string[]) => {
        localStorage.setItem(RECENT_KEY, JSON.stringify(nextRecent));
        localStorage.setItem(SAVED_KEY, JSON.stringify(nextSaved));
        window.dispatchEvent(new Event(EVENT_NAME));
    }, []);

    const addRecentColor = useCallback(
        (color: string) => {
            const nextRecent = [color, ...recentColors.filter((c) => c !== color)].slice(0, 12);
            persist(nextRecent, savedPalette);
            setRecentColors(nextRecent);
        },
        [persist, recentColors, savedPalette]
    );

    const saveColor = useCallback(
        (color: string) => {
            const nextSaved = savedPalette.includes(color) ? savedPalette : [...savedPalette, color];
            persist(recentColors, nextSaved);
            setSavedPalette(nextSaved);
        },
        [persist, recentColors, savedPalette]
    );

    return { recentColors, savedPalette, addRecentColor, saveColor };
};
