import type { KeepItem, RemoteSyncResult, SyncOperation } from "@keepkit/core/core";
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "../../lib/auth";
import { listKeepItems, pushKeepOperation } from "../../lib/serverKeepApi";

type ArticleMeta = { title: string; url: string };
type ErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KeepItem<ArticleMeta>[] | RemoteSyncResult<ArticleMeta> | ErrorResponse>,
) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: "Authentication required." });

  try {
    if (req.method === "GET") return res.status(200).json(await listKeepItems(session));
    if (req.method === "POST") {
      return res.status(200).json(await pushKeepOperation(session, req.body as SyncOperation<ArticleMeta>));
    }
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Keep API failed." });
  }
}
