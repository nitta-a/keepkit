"use client";

import type {
  FallbackRecoveryOperation,
  KeepRecoveryInspection,
  KeepRecoveryRow,
  KeepStorageRecovery,
} from "@keepkit/core/storage";
import { type HTMLAttributes, useEffect, useRef, useState } from "react";
import { useKeepUiLabels, useUiLabel } from "../../foundation/ui-context";

export type KeepFallbackRecoveryProps<TMeta = Record<string, unknown>> = Omit<
  HTMLAttributes<HTMLElement>,
  "children"
> & {
  /** Pass a standalone local adapter's capability before initializing remote synchronization. */
  recovery: KeepStorageRecovery<TMeta>;
};

/** Compares persisted versions without writing; only an explicit reviewed apply commits a repair. */
export function KeepFallbackRecovery<TMeta = Record<string, unknown>>({
  recovery,
  ...props
}: KeepFallbackRecoveryProps<TMeta>) {
  const { locale } = useKeepUiLabels();
  const labels = {
    allItems: useUiLabel("allItems"),
    cancel: useUiLabel("cancel"),
    collection: useUiLabel("collection"),
    deleteCollection: useUiLabel("deleteCollection"),
    error: useUiLabel("error"),
    fallbackRecovery: useUiLabel("fallbackRecovery"),
    inspectRecovery: useUiLabel("inspectRecovery"),
    recoveryApplied: useUiLabel("recoveryApplied"),
    recoveryApply: useUiLabel("recoveryApply"),
    recoveryBackups: useUiLabel("recoveryBackups"),
    recoveryChooseSource: useUiLabel("recoveryChooseSource"),
    recoveryCommitted: useUiLabel("recoveryCommitted"),
    recoveryFallback: useUiLabel("recoveryFallback"),
    recoveryIssues: useUiLabel("recoveryIssues"),
    recoveryItems: useUiLabel("recoveryItems"),
    recoveryLegacy: useUiLabel("recoveryLegacy"),
    recoveryMemberships: useUiLabel("recoveryMemberships"),
    recoveryNoChanges: useUiLabel("recoveryNoChanges"),
    recoveryPending: useUiLabel("recoveryPending"),
    recoveryPreview: useUiLabel("recoveryPreview"),
    recoveryPrimary: useUiLabel("recoveryPrimary"),
    recoveryReady: useUiLabel("recoveryReady"),
    recoverySnapshot: useUiLabel("recoverySnapshot"),
    recoveryStale: useUiLabel("recoveryStale"),
    recoveryUnavailable: useUiLabel("recoveryUnavailable"),
    remove: useUiLabel("remove"),
    retry: useUiLabel("retry"),
    saved: useUiLabel("saved"),
    uncategorized: useUiLabel("uncategorized"),
  };
  const [state, setState] = useState(() => recovery.getState());
  const [storedInspection, setInspection] = useState<KeepRecoveryInspection<TMeta> | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [reviewed, setReviewed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<"applied" | "pending" | null>(null);
  const pendingRecoveries = useRef(new WeakSet<KeepStorageRecovery<TMeta>>());
  const activeRecovery = useRef(recovery);
  activeRecovery.current = recovery;
  const inspectionRecovery = useRef(recovery);
  const inspection = inspectionRecovery.current === recovery ? storedInspection : null;
  const compareRef = useRef<HTMLButtonElement>(null);
  const firstChoiceRef = useRef<HTMLSelectElement>(null);
  const applyRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setPending(pendingRecoveries.current.has(recovery));
    setState(recovery.getState());
    setInspection(null);
    setSelections({});
    setReviewed(false);
    setResult(null);
    setError(false);
    return recovery.subscribe(() => {
      if (activeRecovery.current !== recovery) return;
      setState(recovery.getState());
      setReviewed(false);
    });
  }, [recovery]);
  const canRepair = state.repairSupported && Boolean(recovery.inspect && recovery.apply);
  const sourceLabel = (id: string) => {
    if (id === "primary") return labels.recoveryPrimary;
    if (id === "fallback") return labels.recoveryFallback;
    if (id === "checkpoint") return labels.recoverySnapshot;
    if (id.startsWith("legacy:")) return `${labels.recoveryLegacy} ${id.split(":")[1] ?? ""}`.trim();
    return inspection?.sources.find((source) => source.id === id)?.label ?? id;
  };
  const run = async (operation: () => Promise<void>) => {
    if (pendingRecoveries.current.has(recovery)) return;
    pendingRecoveries.current.add(recovery);
    setPending(true);
    setError(false);
    try {
      await operation();
    } catch {
      if (activeRecovery.current === recovery) {
        setError(true);
        setReviewed(false);
      }
    } finally {
      pendingRecoveries.current.delete(recovery);
      if (activeRecovery.current === recovery) {
        setPending(false);
        setState(recovery.getState());
      }
    }
  };
  const compare = () =>
    run(async () => {
      if (!recovery.inspect) return;
      const next = await recovery.inspect();
      if (activeRecovery.current !== recovery) return;
      inspectionRecovery.current = recovery;
      setInspection(next);
      setSelections({});
      setReviewed(false);
      setResult(null);
    });
  const review = () =>
    run(async () => {
      if (!recovery.inspect) return;
      const next = await recovery.inspect({ selections });
      if (activeRecovery.current !== recovery) return;
      inspectionRecovery.current = recovery;
      setInspection(next);
      setReviewed(next.issues.length === 0);
    });
  const apply = () =>
    run(async () => {
      if (!inspection || !reviewed || inspection.issues.length > 0 || !recovery.apply) return;
      const next = await recovery.apply({ token: inspection.token, selections });
      if (activeRecovery.current !== recovery) return;
      setResult(next.status);
      setInspection(null);
      setReviewed(false);
      compareRef.current?.focus();
    });
  const retry = () =>
    run(async () => {
      if (!recovery.retry) return;
      const next = await recovery.retry();
      if (activeRecovery.current !== recovery) return;
      setResult(next.status);
    });
  useEffect(() => {
    if (pending) return;
    if (reviewed) applyRef.current?.focus();
    else if (inspection) firstChoiceRef.current?.focus();
  }, [inspection, pending, reviewed]);
  const describeOperation = (operation: FallbackRecoveryOperation<TMeta>): string => {
    switch (operation.type) {
      case "setItems":
        return `${labels.recoveryItems}: ${operation.items
          .map((item) => `${item.id} (${labels.collection}: ${item.collectionId ?? labels.uncategorized})`)
          .join(", ")}`;
      case "removeItems":
        return `${labels.remove}: ${operation.ids.join(", ")}`;
      case "clearItems":
        return `${labels.remove}: ${labels.allItems}`;
      case "setCollection":
        return `${labels.collection}: ${operation.collection.name} (${operation.collection.id})`;
      case "removeCollection":
        return `${labels.deleteCollection}: ${operation.id}`;
      case "setMembership":
        return `${labels.recoveryMemberships}: ${operation.membership.collectionId}/${operation.membership.itemId}`;
      case "removeMembership":
        return `${labels.remove}: ${labels.recoveryMemberships} ${operation.collectionId}/${operation.itemId}`;
    }
  };
  const issueLabel = (issue: string) => {
    const [code, ...detail] = issue.split(":");
    const label =
      code === "unresolved-conflict" || code === "invalid-selection"
        ? labels.recoveryChooseSource
        : code === "source-unavailable"
          ? labels.error
          : labels.recoveryIssues;
    const description = code === "source-unavailable" ? sourceLabel(detail[0] ?? "") : detail.join(":");
    return `${label}${description ? ` ${description}` : ""}`;
  };
  const rowLabel = (row: KeepRecoveryRow<TMeta>) => {
    const scope = row.candidates[0]?.value.scope;
    const scopeName = [scope?.tenantId, scope?.userId].filter(Boolean).join("/");
    return `${
      row.kind === "item"
        ? labels.recoveryItems
        : row.kind === "collection"
          ? labels.collection
          : labels.recoveryMemberships
    }: ${row.id}${scopeName ? ` (${scopeName})` : ""}`;
  };
  const retainedBackupJson = [
    ...new Set((inspection?.retainedBackups ?? []).map((backup) => JSON.stringify(backup, null, 2))),
  ];
  return (
    <section
      {...props}
      data-keepkit="fallback-recovery"
      aria-label={props["aria-label"] ?? labels.fallbackRecovery}
      aria-busy={pending}
    >
      <h2>{labels.fallbackRecovery}</h2>
      <p role="status" aria-live="polite">
        {state.source === "primary" ? labels.recoveryPrimary : labels.recoveryFallback}:{" "}
        {state.pendingOperations > 0 ? labels.recoveryPending : labels.recoveryReady}
      </p>
      {state.capturedAt !== undefined ? (
        <time dateTime={new Date(state.capturedAt).toISOString()}>
          {new Date(state.capturedAt).toLocaleString(locale)}
        </time>
      ) : null}
      {state.snapshotStale ? <p role="status">{labels.recoveryStale}</p> : null}
      {state.issue ? <p role="alert">{labels.error}</p> : null}
      {canRepair ? (
        <button
          ref={compareRef}
          type="button"
          disabled={pending || state.pendingOperations > 0}
          onClick={() => void compare()}
        >
          {labels.inspectRecovery}
        </button>
      ) : (
        <p>{labels.recoveryUnavailable}</p>
      )}
      {recovery.retry && state.pendingOperations > 0 ? (
        <button type="button" disabled={pending} onClick={() => void retry()}>
          {labels.retry}
        </button>
      ) : null}
      {result ? <p role="status">{result === "applied" ? labels.recoveryApplied : labels.recoveryCommitted}</p> : null}
      {error ? <p role="alert">{labels.error}</p> : null}
      {inspection ? (
        <div>
          {retainedBackupJson.length > 0 ? (
            <details data-keepkit="retained-recovery-backups">
              <summary>
                {labels.saved}: {labels.recoveryBackups} ({retainedBackupJson.length})
              </summary>
              {retainedBackupJson.map((json) => (
                <pre key={json}>{json}</pre>
              ))}
            </details>
          ) : null}
          <fieldset disabled={pending}>
            <legend>{labels.recoveryChooseSource}</legend>
            {inspection.rows.map((row, index) => (
              <div key={row.key}>
                <label>
                  {rowLabel(row)}
                  <select
                    ref={index === 0 ? firstChoiceRef : undefined}
                    value={selections[row.key] ?? row.selectedSource ?? ""}
                    onChange={(event) => {
                      setSelections({ ...selections, [row.key]: event.currentTarget.value });
                      setReviewed(false);
                    }}
                  >
                    <option value="" disabled>
                      {labels.recoveryChooseSource}
                    </option>
                    {row.candidates.map((candidate) => (
                      <option key={candidate.source} value={candidate.source}>
                        {sourceLabel(candidate.source)}
                      </option>
                    ))}
                    <option value="__remove__">{labels.remove}</option>
                  </select>
                </label>
                {row.candidates.map((candidate) => (
                  <details key={candidate.source}>
                    <summary>{sourceLabel(candidate.source)}</summary>
                    <pre>{JSON.stringify(candidate.value, null, 2)}</pre>
                  </details>
                ))}
              </div>
            ))}
          </fieldset>
          <button type="button" disabled={pending} onClick={() => void review()}>
            {labels.recoveryPreview}
          </button>
          {inspection.issues.length > 0 ? (
            <div role="alert">
              <p>{labels.recoveryIssues}</p>
              <ul>
                {[...new Set(inspection.issues)].map((issue) => (
                  <li key={issue}>{issueLabel(issue)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {reviewed ? (
            <section aria-label={labels.recoveryPreview}>
              {inspection.operations.length > 0 ? (
                <ul>
                  {inspection.operations.map((operation) => (
                    <li key={JSON.stringify(operation)}>{describeOperation(operation)}</li>
                  ))}
                </ul>
              ) : (
                <p>{labels.recoveryNoChanges}</p>
              )}
              <details>
                <summary>{labels.recoveryBackups}</summary>
                <pre>{JSON.stringify(inspection.backups, null, 2)}</pre>
              </details>
            </section>
          ) : null}
          <button
            ref={applyRef}
            type="button"
            disabled={pending || !reviewed || inspection.issues.length > 0 || inspection.operations.length === 0}
            onClick={() => void apply()}
          >
            {labels.recoveryApply}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setInspection(null);
              setReviewed(false);
              compareRef.current?.focus();
            }}
          >
            {labels.cancel}
          </button>
        </div>
      ) : null}
    </section>
  );
}
