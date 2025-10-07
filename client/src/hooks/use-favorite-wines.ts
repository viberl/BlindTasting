import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'my-wines-favorites';

const readFavorites = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string');
    }
  } catch {
    // ignore
  }
  return [];
};

const writeFavorites = (favorites: string[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // ignore
  }
};

export const makeFavoriteKey = (tastingId: number | string, wineId: number | string) =>
  `${tastingId}-${wineId}`;

export function useFavoriteWines() {
  const [favoriteList, setFavoriteList] = useState<string[]>(() => readFavorites());

  const favorites = useMemo(() => new Set(favoriteList), [favoriteList]);

  const toggleFavorite = useCallback((key: string) => {
    setFavoriteList(prev => {
      const nextSet = new Set(prev);
      if (nextSet.has(key)) {
        nextSet.delete(key);
      } else {
        nextSet.add(key);
      }
      const nextList = Array.from(nextSet);
      writeFavorites(nextList);
      return nextList;
    });
  }, []);

  const isFavorite = useCallback((key: string) => favorites.has(key), [favorites]);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setFavoriteList(readFavorites());
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    }
    return undefined;
  }, []);

  return { favorites, toggleFavorite, isFavorite };
}
