export type FavoriteItem = {
  id: string;
  resourceId: string;
  title?: string;
  url?: string;
  image?: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

export type FavoriteInput = Omit<FavoriteItem, "id" | "createdAt" | "updatedAt">;

export type FavoriteUpdate = Partial<Omit<FavoriteItem, "id" | "resourceId" | "createdAt">>;

export interface FavoriteStorage {
  getAll(): Promise<FavoriteItem[]>;
  add(item: FavoriteItem): Promise<void>;
  update(id: string, item: Partial<FavoriteItem>): Promise<void>;
  remove(id: string): Promise<void>;
}
