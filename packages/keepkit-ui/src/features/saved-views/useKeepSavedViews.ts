import type { KeepListQuery, KeepSavedView, KeepSavedViewStorage } from "@keepkit/core/core";
import { LocalStorageKeepSavedViewStorage } from "@keepkit/core/core";
import { useCallback, useEffect, useMemo, useState } from "react";

const changeEvent = "keepkit:saved-views:change";

export type UseKeepSavedViewsResult<TMeta = Record<string, unknown>> = {
  views: KeepSavedView<TMeta>[];
  error: unknown;
  refresh: () => Promise<void>;
  createView: (name: string, query: KeepListQuery<TMeta>) => Promise<KeepSavedView<TMeta>>;
  updateView: (id: string, update: Partial<Pick<KeepSavedView<TMeta>, "name" | "query" | "pinned">>) => Promise<void>;
  removeView: (id: string) => Promise<void>;
  applyView: (id: string) => Promise<KeepListQuery<TMeta> | undefined>;
};

export function useKeepSavedViews<TMeta = Record<string, unknown>>(
  storage?: KeepSavedViewStorage<TMeta>,
): UseKeepSavedViewsResult<TMeta> {
  const resolvedStorage = useMemo(() => storage ?? new LocalStorageKeepSavedViewStorage<TMeta>(), [storage]);
  const [views, setViews] = useState<KeepSavedView<TMeta>[]>([]);
  const [error, setError] = useState<unknown>();
  const refresh = useCallback(async () => {
    try {
      setViews(sortViews(await resolvedStorage.getAll()));
      setError(undefined);
    } catch (cause) {
      setError(cause);
    }
  }, [resolvedStorage]);
  useEffect(() => {
    void refresh();
    if (typeof window === "undefined") return;
    window.addEventListener(changeEvent, refresh);
    return () => window.removeEventListener(changeEvent, refresh);
  }, [refresh]);
  const createView = useCallback(
    async (name: string, query: KeepListQuery<TMeta>) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Saved View name is required.");
      if (query.filter) throw new Error("Saved Views require a serializable query; query.filter cannot be saved.");
      const now = Date.now();
      const view = { id: createId(), name: trimmed, query: normalizeQuery(query), createdAt: now, updatedAt: now };
      try {
        await resolvedStorage.set(view);
        notifyChange();
        return view;
      } catch (cause) {
        setError(cause);
        throw cause;
      }
    },
    [resolvedStorage],
  );
  const updateView = useCallback(
    async (id: string, update: Partial<Pick<KeepSavedView<TMeta>, "name" | "query" | "pinned">>) => {
      try {
        const current = await resolvedStorage.get(id);
        if (!current) return;
        const name = update.name?.trim() ?? current.name;
        if (!name) throw new Error("Saved View name is required.");
        if (update.query?.filter)
          throw new Error("Saved Views require a serializable query; query.filter cannot be saved.");
        const view = {
          ...current,
          ...update,
          ...(update.query ? { query: normalizeQuery(update.query) } : {}),
          name,
          updatedAt: Date.now(),
        };
        await resolvedStorage.set(view);
        notifyChange();
      } catch (cause) {
        setError(cause);
        throw cause;
      }
    },
    [resolvedStorage],
  );
  const removeView = useCallback(
    async (id: string) => {
      try {
        await resolvedStorage.remove(id);
        notifyChange();
      } catch (cause) {
        setError(cause);
        throw cause;
      }
    },
    [resolvedStorage],
  );
  const applyView = useCallback(
    async (id: string) => {
      try {
        return (await resolvedStorage.get(id))?.query;
      } catch (cause) {
        setError(cause);
        throw cause;
      }
    },
    [resolvedStorage],
  );
  return { views, error, refresh, createView, updateView, removeView, applyView };
}

function sortViews<TMeta>(views: KeepSavedView<TMeta>[]): KeepSavedView<TMeta>[] {
  return [...views].sort(
    (a, b) => Number(b.pinned === true) - Number(a.pinned === true) || a.name.localeCompare(b.name),
  );
}

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function normalizeQuery<TMeta>(query: KeepListQuery<TMeta>): KeepListQuery<TMeta> {
  const range = query.savedBetween;
  const savedBetween: readonly [number, number] | undefined = range
    ? [toTimestamp(range[0]), toTimestamp(range[1])]
    : undefined;
  return {
    ...query,
    ...(savedBetween ? { savedBetween } : {}),
  };
}

function toTimestamp(value: Date | number): number {
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(timestamp)) throw new Error("Saved View date filters must use valid timestamps.");
  return timestamp;
}

function notifyChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(changeEvent));
}
