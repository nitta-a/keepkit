const writeQueues = new Map<string, Promise<unknown>>();

/** Serialize same-key writes in one realm and, where available, across browser tabs. */
export function withLocalStorageWriteLock<T>(
  key: string,
  operation: () => Promise<T>,
  lockUnavailableError: Error,
): Promise<T> {
  const lockName = `keepkit:local-storage:${key}`;
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(lockName, operation);
  }
  if (typeof window !== "undefined") return Promise.reject(lockUnavailableError);

  const previous = writeQueues.get(lockName) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  writeQueues.set(lockName, next);
  return next.finally(() => {
    if (writeQueues.get(lockName) === next) writeQueues.delete(lockName);
  });
}
