"use client";

import type { KeepListQuery } from "@keepkit/core/core";
import {
  DEFAULT_KEEP_URL_PARAMS,
  decodeKeepListQuery,
  encodeKeepListQuery,
  type KeepUrlSyncOptions,
} from "@keepkit/core/core";
import { useEffect, useRef } from "react";

export type KeepUrlAdapter = {
  getUrl: () => string;
  subscribe?: (listener: () => void) => () => void;
  navigate: (url: string, mode: "replace" | "push") => void;
};

export type KeepPagesRouterLike = {
  asPath?: string;
  push: (url: string, as?: string, options?: { shallow?: boolean }) => Promise<boolean> | boolean;
  replace: (url: string, as?: string, options?: { shallow?: boolean }) => Promise<boolean> | boolean;
  events?: { on: (event: string, listener: () => void) => void; off: (event: string, listener: () => void) => void };
};

export type KeepUrlSyncProps<TMeta = Record<string, unknown>> = {
  enabled?: boolean;
  query: KeepListQuery<TMeta>;
  onQueryChange: (query: KeepListQuery<TMeta> | ((previous: KeepListQuery<TMeta>) => KeepListQuery<TMeta>)) => void;
  options?: KeepUrlSyncOptions;
  adapter?: KeepUrlAdapter;
};

/** Adapter for Next.js Pages Router. It intentionally uses structural typing and has no Next dependency. */
export function createNextPagesRouterAdapter(router: KeepPagesRouterLike): KeepUrlAdapter {
  const getUrl = () => router.asPath ?? (typeof window === "undefined" ? "/" : window.location.href);
  return {
    getUrl,
    subscribe: router.events
      ? (listener) => {
          router.events?.on("routeChangeComplete", listener);
          return () => router.events?.off("routeChangeComplete", listener);
        }
      : undefined,
    navigate: (url, mode) => {
      void router[mode](url, undefined, { shallow: true });
    },
  };
}

/** Synchronizes collection filters with browser history and supports back/forward restoration. */
export function useKeepUrlSync<TMeta = Record<string, unknown>>({
  enabled = true,
  query,
  onQueryChange,
  options = {},
  adapter: providedAdapter,
}: KeepUrlSyncProps<TMeta>): void {
  const browserAdapterRef = useRef<KeepUrlAdapter>(getBrowserAdapter());
  const adapter = providedAdapter ?? browserAdapterRef.current;
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;
  const skipWriteRef = useRef(true);
  const params = options.params;

  useEffect(() => {
    if (!enabled) return;
    const read = () => {
      const url = adapter.getUrl();
      const decoded = decodeKeepListQuery(url, { params });
      skipWriteRef.current = true;
      onQueryChangeRef.current((previousQuery) => ({
        ...previousQuery,
        ...(decoded.search ? { search: decoded.search } : { search: undefined }),
        ...(decoded.tags ? { tags: decoded.tags } : { tags: undefined }),
        ...(decoded.sort ? { sort: decoded.sort } : {}),
        ...(decoded.pagination ? { pagination: { ...previousQuery.pagination, ...decoded.pagination } } : {}),
      }));
    };
    read();
    return adapter.subscribe?.(read);
  }, [adapter, enabled, params]);

  useEffect(() => {
    if (!enabled) return;
    if (skipWriteRef.current) {
      skipWriteRef.current = false;
      return;
    }
    const currentUrl = new URL(adapter.getUrl(), "http://keepkit.invalid");
    const urlParams = { ...DEFAULT_KEEP_URL_PARAMS, ...params };
    for (const key of Object.values(urlParams)) currentUrl.searchParams.delete(key);
    const nextParams = encodeKeepListQuery(query, { params });
    nextParams.forEach((value, key) => {
      currentUrl.searchParams.append(key, value);
    });
    const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    adapter.navigate(nextUrl, options.history ?? "push");
  }, [adapter, enabled, options.history, params, query]);
}

function getBrowserAdapter(): KeepUrlAdapter {
  return {
    getUrl: () => (typeof window === "undefined" ? "/" : window.location.href),
    subscribe: (listener) => {
      if (typeof window === "undefined") return () => undefined;
      window.addEventListener("popstate", listener);
      return () => window.removeEventListener("popstate", listener);
    },
    navigate: (url, mode) => {
      if (typeof window === "undefined") return;
      window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
    },
  };
}
