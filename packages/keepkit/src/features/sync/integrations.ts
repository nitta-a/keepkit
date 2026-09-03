import type { KeepPlugin, KeepPluginContext } from "../items/types";

export type KeepInvalidationPluginOptions<TMeta = Record<string, unknown>> = {
  /** Query keys to invalidate after a successful local KeepKit mutation. */
  queryKeys: readonly unknown[] | ((context: KeepPluginContext<TMeta>) => readonly (readonly unknown[])[]);
  /** Connect this callback to queryClient.invalidateQueries or SWR mutate. */
  invalidate: (queryKey: readonly unknown[], context: KeepPluginContext<TMeta>) => void | Promise<void>;
  name?: string;
};

/** Framework-neutral bridge for TanStack Query, SWR, and similar caches. */
export function createKeepInvalidationPlugin<TMeta = Record<string, unknown>>(
  options: KeepInvalidationPluginOptions<TMeta>,
): KeepPlugin<TMeta> {
  return {
    name: options.name ?? "keepkit-cache-invalidation",
    after: async (context) => {
      const keys = typeof options.queryKeys === "function" ? options.queryKeys(context) : [options.queryKeys];
      await Promise.all(keys.map((queryKey) => options.invalidate(queryKey, context)));
    },
  };
}
