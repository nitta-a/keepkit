"use client";

import { createRediscoveryQuery, type KeepRediscoveryStrategy } from "@keepkit/core/core";
import { type HTMLAttributes, useId, useMemo } from "react";
import { useUiLabel } from "../../foundation/ui-context";
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
  return (
    <KeepList<TMeta>
      {...props}
      query={query}
      itemCardProps={{
        trackOpen: true,
        showActivity: true,
        activityKind: strategy === "recently-opened" ? "opened" : "inactive",
        ...itemCardProps,
      }}
    />
  );
}

export type KeepRediscoveryPanelProps<TMeta = Record<string, unknown>> = Omit<KeepRediscoveryProps<TMeta>, "children"> &
  Omit<HTMLAttributes<HTMLElement>, "children"> & {
    title?: string;
    description?: string;
  };

/** A labelled Rediscovery section that explains why its items are shown. */
export function KeepRediscoveryPanel<TMeta = Record<string, unknown>>({
  title,
  description,
  strategy,
  ...props
}: KeepRediscoveryPanelProps<TMeta>) {
  const headingId = useId();
  const { className, ...rediscoveryProps } = props;
  const neverOpenedLabel = useUiLabel("activityNeverOpened");
  const inactiveLabel = useUiLabel("activityInactiveFor");
  const openedLabel = useUiLabel("activityOpened");
  const strategyLabel =
    strategy === "never-opened" ? neverOpenedLabel : strategy === "forgotten" ? inactiveLabel : openedLabel;
  return (
    <section className={className} data-keepkit="rediscovery-panel" aria-labelledby={headingId}>
      <header>
        <h2 id={headingId}>{title ?? strategyLabel}</h2>
        <p>{description ?? strategyLabel}</p>
      </header>
      <KeepRediscovery<TMeta> {...rediscoveryProps} strategy={strategy} />
    </section>
  );
}
