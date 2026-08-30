import type { KeepItem } from "./types";

export type KeepStoreState<TMeta = Record<string, unknown>> = {
  items: KeepItem<TMeta>[];
  isLoading: boolean;
  isHydrated: boolean;
  isMutating: boolean;
  error: unknown | null;
};

export type KeepStoreActions<TMeta = Record<string, unknown>> = {
  saveItem: (item: KeepItem<TMeta>) => Promise<void>;
  updateNote: (id: string, note?: string) => Promise<void>;
  updateTags: (id: string, tags?: string[]) => Promise<void>;
  updateTagsBatch: (ids: string[], tags?: string[]) => Promise<void>;
  addTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  removeTagsBatch: (ids: string[], tags: string[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  removeItems: (ids: string[]) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
};

export class KeepStore<TMeta = Record<string, unknown>> {
  private state: KeepStoreState<TMeta>;
  private readonly listeners = new Set<() => void>();

  constructor(initialState: KeepStoreState<TMeta>) {
    this.state = initialState;
  }

  getSnapshot = (): KeepStoreState<TMeta> => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setState(next: Partial<KeepStoreState<TMeta>>): void {
    let changed = false;
    for (const key of Object.keys(next) as Array<keyof KeepStoreState<TMeta>>) {
      if (!Object.is(this.state[key], next[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...next };
    for (const listener of this.listeners) listener();
  }
}
