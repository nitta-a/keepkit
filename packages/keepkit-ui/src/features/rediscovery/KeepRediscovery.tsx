"use client";

import { createRediscoveryQuery, type KeepRediscoveryStrategy } from "@keepkit/core/core";
import { useMemo } from "react";
import { KeepList, type KeepListProps } from "../collection/KeepList";

export type KeepRediscoveryProps<TMeta = Record<string, unknown>> = Omit<KeepListProps<TMeta>, "query"> & {
  strategy: KeepRediscoveryStrategy;
  inactiveForMs?: number;
  limit?: number;
};

/** A small composition for the standard rediscovery queries. */
export function KeepRediscovery<TMeta = Record<string, unknown>>({
  strategy,
  inactiveForMs,
  limit = 5,
  itemCardProps,
  ...props
}: KeepRediscoveryProps<TMeta>) {
  const query = useMemo(
    () => ({
      ...createRediscoveryQuery<TMeta>({ strategy, inactiveForMs }),
      pagination: { page: 1, pageSize: Math.max(1, limit) },
    }),
    [inactiveForMs, limit, strategy],
  );
  return <KeepList<TMeta> {...props} query={query} itemCardProps={{ trackOpen: true, ...itemCardProps }} />;
}
