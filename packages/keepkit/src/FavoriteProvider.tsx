import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LocalStorageAdapter } from "./storage";
import type { FavoriteInput, FavoriteItem, FavoriteStorage, FavoriteUpdate } from "./types";

export type UseFavoritesResult = {
  favorites: FavoriteItem[];
  isLoading: boolean;
  addFavorite: (input: FavoriteInput) => Promise<FavoriteItem>;
  updateFavorite: (id: string, item: FavoriteUpdate) => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
  isFavorite: (resourceId: string) => boolean;
};

const FavoritesContext = createContext<UseFavoritesResult | null>(null);
const defaultStorage = new LocalStorageAdapter();

export type FavoriteProviderProps = PropsWithChildren<{
  storage?: FavoriteStorage;
}>;

export function FavoriteProvider({ storage = defaultStorage, children }: FavoriteProviderProps) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const favoritesRef = useRef(favorites);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    storage
      .getAll()
      .then((items) => {
        if (!active) return;
        favoritesRef.current = items;
        setFavorites(items);
      })
      .catch(() => {
        if (active) {
          favoritesRef.current = [];
          setFavorites([]);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [storage]);

  const addFavorite = useCallback(
    async (input: FavoriteInput) => {
      const existing = favoritesRef.current.find((item) => item.resourceId === input.resourceId);
      if (existing) return existing;

      const now = new Date().toISOString();
      const item: FavoriteItem = {
        ...input,
        id: createId(),
        createdAt: now,
        updatedAt: now,
      };
      const next = [...favoritesRef.current, item];
      await storage.add(item);
      favoritesRef.current = next;
      setFavorites(next);
      return item;
    },
    [storage],
  );

  const updateFavorite = useCallback(
    async (id: string, patch: FavoriteUpdate) => {
      const current = favoritesRef.current.find((item) => item.id === id);
      if (!current) return;

      const updatedAt = new Date().toISOString();
      await storage.update(id, { ...patch, updatedAt });
      const next = favoritesRef.current.map((item) =>
        item.id === id ? { ...item, ...patch, updatedAt } : item,
      );
      favoritesRef.current = next;
      setFavorites(next);
    },
    [storage],
  );

  const removeFavorite = useCallback(
    async (id: string) => {
      await storage.remove(id);
      const next = favoritesRef.current.filter((item) => item.id !== id);
      favoritesRef.current = next;
      setFavorites(next);
    },
    [storage],
  );

  const value = useMemo<UseFavoritesResult>(
    () => ({
      favorites,
      isLoading,
      addFavorite,
      updateFavorite,
      removeFavorite,
      isFavorite: (resourceId) => favorites.some((item) => item.resourceId === resourceId),
    }),
    [addFavorite, favorites, isLoading, removeFavorite, updateFavorite],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): UseFavoritesResult {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used inside a FavoriteProvider");
  return context;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
