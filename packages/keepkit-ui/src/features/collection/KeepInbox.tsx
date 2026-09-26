"use client";

import { createInboxQuery, type KeepListQuery } from "@keepkit/core/core";
import type { KeepCollectionProps } from "./KeepCollection";
import { KeepCollection } from "./KeepCollection";

export type KeepInboxProps<TMeta = Record<string, unknown>> = Omit<KeepCollectionProps<TMeta>, "query"> & {
  query?: KeepListQuery<TMeta>;
};

/** Collection preset for active items that have not been assigned to a collection. */
export function KeepInbox<TMeta = Record<string, unknown>>({ query, ...props }: KeepInboxProps<TMeta>) {
  const inboxQuery = createInboxQuery<TMeta>({ organization: query?.organization });
  return (
    <KeepCollection<TMeta>
      {...props}
      query={{ ...inboxQuery, ...query, organization: inboxQuery.organization }}
      features={{ note: true, archive: true, bulkActions: true, tags: true, ...props.features }}
    />
  );
}
