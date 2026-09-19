import { useMemo } from "react";
import { createRediscoveryQuery, type KeepListQuery, type KeepRediscoveryOptions } from "../../features/items/query";
import { type UseKeepListResult, useKeepList } from "./useKeepList";

export type UseKeepRediscoveryOptions = KeepRediscoveryOptions & { limit?: number };

export type UseKeepRediscoveryResult<TMeta = Record<string, unknown>> = UseKeepListResult<TMeta> & {
  query: KeepListQuery<TMeta>;
};

/** Query and read a standard rediscovery view through the normal item list path. */
export function useKeepRediscovery<TMeta = Record<string, unknown>>(
  options: UseKeepRediscoveryOptions,
): UseKeepRediscoveryResult<TMeta> {
  const { strategy, inactiveForMs, limit } = options;
  const query = useMemo(() => {
    const base = createRediscoveryQuery<TMeta>({ strategy, inactiveForMs });
    return limit === undefined ? base : { ...base, pagination: { page: 1, pageSize: Math.max(1, limit) } };
  }, [inactiveForMs, limit, strategy]);
  return { ...useKeepList(query), query };
}
