import type { KeepItem, RemoteSyncResult, SyncOperation } from "@keepkit/core/core";
import type { Session } from "./auth";

type ArticleMeta = { title: string; url: string };
const apiUrl = process.env.KEEP_API_URL;

async function request<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) throw new Error("KEEP_API_URL is required by the Next.js example.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessToken}`,
      ...init?.headers,
    },
  });
  if (!response.ok) throw new Error(`Upstream Keep API failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export function listKeepItems(session: Session): Promise<KeepItem<ArticleMeta>[]> {
  return request(session, `/users/${encodeURIComponent(session.userId)}/keep`);
}

export function pushKeepOperation(
  session: Session,
  operation: SyncOperation<ArticleMeta>,
): Promise<RemoteSyncResult<ArticleMeta>> {
  return request(session, `/users/${encodeURIComponent(session.userId)}/keep/sync`, {
    method: "POST",
    body: JSON.stringify(operation),
  });
}
