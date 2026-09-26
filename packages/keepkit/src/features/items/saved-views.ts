import type { KeepListQuery } from "./query";

export type KeepSavedView<TMeta = Record<string, unknown>> = {
  id: string;
  name: string;
  query: KeepListQuery<TMeta>;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
};

export interface KeepSavedViewStorage<TMeta = Record<string, unknown>> {
  getAll(): Promise<KeepSavedView<TMeta>[]>;
  get(id: string): Promise<KeepSavedView<TMeta> | undefined>;
  set(view: KeepSavedView<TMeta>): Promise<void>;
  remove(id: string): Promise<void>;
}

export const DEFAULT_SAVED_VIEWS_STORAGE_KEY = "keepkit:saved-views";

/** Local-first Saved View storage kept separate from item storage. */
export class LocalStorageKeepSavedViewStorage<TMeta = Record<string, unknown>> implements KeepSavedViewStorage<TMeta> {
  private readonly key: string;
  private readonly storage?: Storage;

  constructor(options: { key?: string; storage?: Storage } = {}) {
    this.key = options.key ?? DEFAULT_SAVED_VIEWS_STORAGE_KEY;
    this.storage = options.storage;
  }

  async getAll(): Promise<KeepSavedView<TMeta>[]> {
    const raw = this.getStorage().getItem(this.key);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(isSavedView)) throw new Error("KeepKit saved-view data is invalid.");
    return data as KeepSavedView<TMeta>[];
  }

  async set(view: KeepSavedView<TMeta>): Promise<void> {
    const range = view.query.savedBetween;
    const normalized = {
      ...view,
      query: {
        ...view.query,
        ...(range
          ? {
              savedBetween: [
                range[0] instanceof Date ? range[0].getTime() : range[0],
                range[1] instanceof Date ? range[1].getTime() : range[1],
              ] as const,
            }
          : {}),
      },
    };
    if (!isSavedView(normalized)) throw new Error("KeepKit Saved View is invalid.");
    const views = await this.getAll();
    const next = [...views.filter((current) => current.id !== normalized.id), normalized];
    this.getStorage().setItem(this.key, JSON.stringify(next));
  }

  async get(id: string): Promise<KeepSavedView<TMeta> | undefined> {
    return (await this.getAll()).find((view) => view.id === id);
  }

  async remove(id: string): Promise<void> {
    const views = await this.getAll();
    this.getStorage().setItem(this.key, JSON.stringify(views.filter((view) => view.id !== id)));
  }

  private getStorage(): Storage {
    if (this.storage) return this.storage;
    if (typeof localStorage === "undefined")
      throw new Error("KeepKit Saved Views require browser storage or an injected adapter.");
    return localStorage;
  }
}

function isSavedView(value: unknown): value is KeepSavedView {
  if (typeof value !== "object" || value === null) return false;
  const view = value as Record<string, unknown>;
  return (
    typeof view.id === "string" &&
    view.id.length > 0 &&
    typeof view.name === "string" &&
    view.name.trim().length > 0 &&
    Number.isFinite(view.createdAt) &&
    Number.isFinite(view.updatedAt) &&
    isKeepListQuery(view.query) &&
    (view.pinned === undefined || typeof view.pinned === "boolean")
  );
}

function isKeepListQuery(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const query = value as Record<string, unknown>;
  if (query.filter !== undefined) return false;
  if (query.tags !== undefined && (!Array.isArray(query.tags) || !query.tags.every((tag) => typeof tag === "string"))) {
    return false;
  }
  if (query.collectionId !== undefined && typeof query.collectionId !== "string") return false;
  if (query.targetType !== undefined && typeof query.targetType !== "string") return false;
  if (query.archived !== undefined && typeof query.archived !== "boolean") return false;
  if (query.archiveScope !== undefined && !["active", "archived", "all"].includes(String(query.archiveScope))) {
    return false;
  }
  if (query.pinnedFirst !== undefined && typeof query.pinnedFirst !== "boolean") return false;
  if (query.sort !== undefined) {
    if (!isRecord(query.sort) || !["savedAt", "updatedAt", "lastOpenedAt"].includes(String(query.sort.by)))
      return false;
    if (query.sort.direction !== undefined && query.sort.direction !== "asc" && query.sort.direction !== "desc")
      return false;
  }
  if (query.search !== undefined) {
    if (!isRecord(query.search)) return false;
    if (query.search.query !== undefined && typeof query.search.query !== "string") return false;
    if (query.search.mode !== undefined && query.search.mode !== "and" && query.search.mode !== "or") return false;
    if (query.search.tokenize !== undefined && typeof query.search.tokenize !== "boolean") return false;
    if (
      query.search.fields !== undefined &&
      (!Array.isArray(query.search.fields) ||
        !query.search.fields.every((field) => field === "note" || field === "meta" || field === "tags"))
    ) {
      return false;
    }
  }
  if (query.activity !== undefined) {
    if (!isRecord(query.activity)) return false;
    if (query.activity.opened !== undefined && query.activity.opened !== "ever" && query.activity.opened !== "never") {
      return false;
    }
    if (
      [query.activity.lastOpenedBefore, query.activity.lastOpenedAfter, query.activity.inactiveForMs].some(
        isInvalidNumber,
      )
    ) {
      return false;
    }
  }
  if (
    query.savedBetween !== undefined &&
    (!Array.isArray(query.savedBetween) || query.savedBetween.length !== 2 || query.savedBetween.some(isInvalidNumber))
  ) {
    return false;
  }
  if (query.pagination !== undefined) {
    if (!isRecord(query.pagination) || [query.pagination.page, query.pagination.pageSize].some(isInvalidNumber))
      return false;
  }
  const organization = query.organization;
  if (organization !== undefined) {
    if (typeof organization !== "object" || organization === null || Array.isArray(organization)) return false;
    const fields = organization as Record<string, unknown>;
    if (
      [fields.collection, fields.tags, fields.note].some(
        (field) => field !== undefined && field !== "assigned" && field !== "unassigned",
      )
    ) {
      return false;
    }
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInvalidNumber(value: unknown): boolean {
  return value !== undefined && (typeof value !== "number" || !Number.isFinite(value));
}
