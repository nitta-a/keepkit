"use client";

import type { KeepItem } from "@keepkit/core/core";
import { useKeepList } from "@keepkit/core/react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

const SESSION_VERSION = 1;

export type KeepTourPosition = "bottom-center" | "bottom-left" | "bottom-right";
export type KeepTourPersistenceStatus = "persistent" | "memory";
export type KeepTourStartOptions = { itemIds: readonly string[]; currentId?: string };
export type KeepTourContextValue<TMeta = Record<string, unknown>> = {
  active: boolean;
  itemIds: readonly string[];
  currentId: string | null;
  collapsed: boolean;
  persistenceStatus: KeepTourPersistenceStatus;
  getItemHref?: (item: KeepItem<TMeta>) => string;
  getBackHref?: () => string;
  onNavigate?: (direction: "prev" | "next", item: KeepItem<TMeta>) => void;
  start: (options: KeepTourStartOptions) => boolean;
  end: () => void;
  collapse: () => void;
  expand: () => void;
  goNext: () => KeepItem<TMeta> | null;
  goPrev: () => KeepItem<TMeta> | null;
  setCurrentId: (id: string) => void;
};

export type KeepTourProviderProps<TMeta = Record<string, unknown>> = {
  children?: ReactNode;
  sessionKey?: string;
  getItemHref?: (item: KeepItem<TMeta>) => string;
  getBackHref?: () => string;
  onNavigate?: (direction: "prev" | "next", item: KeepItem<TMeta>) => void;
};

type StoredTour = { version: number; itemIds: readonly string[]; currentId: string; collapsed: boolean };
const KeepTourContext = createContext<KeepTourContextValue<unknown> | null>(null);

export function KeepTourProvider<TMeta = Record<string, unknown>>({
  children,
  sessionKey = "keepkit:tour",
  getItemHref,
  getBackHref,
  onNavigate,
}: KeepTourProviderProps<TMeta>) {
  const list = useKeepList<TMeta>();
  const [tour, setTour] = useState<Pick<KeepTourContextValue<TMeta>, "itemIds" | "currentId" | "collapsed"> | null>(
    null,
  );
  const [persistenceStatus, setPersistenceStatus] = useState<KeepTourPersistenceStatus>("persistent");
  const itemsById = useMemo(() => new Map(list.items.map((item) => [item.id, item])), [list.items]);
  const readStorage = useCallback((): StoredTour | null => {
    try {
      const raw = window.sessionStorage.getItem(sessionKey);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const value = parsed as Partial<StoredTour>;
      if (value.version !== SESSION_VERSION || !Array.isArray(value.itemIds) || typeof value.currentId !== "string")
        return null;
      const ids = value.itemIds.filter((id): id is string => typeof id === "string");
      if (!ids.length || new Set(ids).size !== ids.length) return null;
      return {
        version: SESSION_VERSION,
        itemIds: ids,
        currentId: value.currentId,
        collapsed: value.collapsed === true,
      };
    } catch {
      setPersistenceStatus("memory");
      return null;
    }
  }, [sessionKey]);
  const writeStorage = useCallback(
    (value: Pick<StoredTour, "itemIds" | "currentId" | "collapsed"> | null) => {
      try {
        if (value) window.sessionStorage.setItem(sessionKey, JSON.stringify({ version: SESSION_VERSION, ...value }));
        else window.sessionStorage.removeItem(sessionKey);
        setPersistenceStatus("persistent");
      } catch {
        setPersistenceStatus("memory");
      }
    },
    [sessionKey],
  );

  useEffect(() => {
    if (!list.isHydrated || list.error || tour) return;
    const stored = typeof window === "undefined" ? null : readStorage();
    if (!stored) return;
    const ids = stored.itemIds.filter((id) => itemsById.has(id));
    if (!ids.length) {
      writeStorage(null);
      return;
    }
    const currentId = ids.includes(stored.currentId) ? stored.currentId : ids[0];
    setTour({ itemIds: ids, currentId, collapsed: stored.collapsed });
  }, [itemsById, list.error, list.isHydrated, readStorage, tour, writeStorage]);

  useEffect(() => {
    if (!tour || list.isLoading || list.error) return;
    const ids = tour.itemIds.filter((id) => itemsById.has(id));
    if (!ids.length) {
      setTour(null);
      writeStorage(null);
      return;
    }
    const currentId = tour.currentId && ids.includes(tour.currentId) ? tour.currentId : ids[0];
    if (ids.length !== tour.itemIds.length || currentId !== tour.currentId) {
      const next = { ...tour, itemIds: ids, currentId };
      setTour(next);
      writeStorage(next);
    }
  }, [itemsById, list.error, list.isLoading, tour, writeStorage]);

  const start = useCallback(
    (options: KeepTourStartOptions) => {
      const ids = [...options.itemIds];
      if (!ids.length || new Set(ids).size !== ids.length || ids.some((id) => !itemsById.has(id))) return false;
      const currentId = options.currentId ?? ids[0];
      if (!ids.includes(currentId)) return false;
      const next = { itemIds: ids, currentId, collapsed: false };
      setTour(next);
      writeStorage(next);
      return true;
    },
    [itemsById, writeStorage],
  );
  const end = useCallback(() => {
    setTour(null);
    writeStorage(null);
  }, [writeStorage]);
  const setCurrentId = useCallback(
    (id: string) => {
      setTour((current) => {
        if (!current?.currentId || current.currentId === id || !current.itemIds.includes(id)) return current;
        const next = { ...current, currentId: id };
        writeStorage(next);
        return next;
      });
    },
    [writeStorage],
  );
  const move = useCallback(
    (delta: number) => {
      if (!tour?.currentId) return null;
      const currentId = tour.currentId;
      const index = tour.itemIds.indexOf(currentId);
      const id = tour.itemIds[index + delta];
      if (!id) return null;
      setCurrentId(id);
      return itemsById.get(id) ?? null;
    },
    [itemsById, setCurrentId, tour],
  );
  const value = useMemo<KeepTourContextValue<TMeta>>(
    () => ({
      active: tour !== null,
      itemIds: tour?.itemIds ?? [],
      currentId: tour?.currentId ?? null,
      collapsed: tour?.collapsed ?? false,
      persistenceStatus,
      getItemHref,
      getBackHref,
      onNavigate,
      start,
      end,
      collapse: () => setTour((current) => (current ? { ...current, collapsed: true } : current)),
      expand: () => setTour((current) => (current ? { ...current, collapsed: false } : current)),
      goNext: () => move(1),
      goPrev: () => move(-1),
      setCurrentId,
    }),
    [end, getBackHref, getItemHref, move, onNavigate, persistenceStatus, setCurrentId, start, tour],
  );
  useEffect(() => {
    if (!tour) return;
    if (tour.currentId) writeStorage(tour as StoredTour);
  }, [tour, writeStorage]);
  return <KeepTourContext.Provider value={value as KeepTourContextValue<unknown>}>{children}</KeepTourContext.Provider>;
}

export function useKeepTour<TMeta = Record<string, unknown>>(options: { currentId?: string } = {}) {
  const context = useContext(KeepTourContext) as KeepTourContextValue<TMeta> | null;
  if (!context) throw new Error("useKeepTour must be used within KeepTourProvider.");
  useEffect(() => {
    if (options.currentId && context.active) context.setCurrentId(options.currentId);
  }, [context, options.currentId]);
  return context;
}
