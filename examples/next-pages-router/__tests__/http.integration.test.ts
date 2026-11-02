// @vitest-environment node
import { createServer } from "node:http";
import next from "next";
import { expect, test, vi } from "vitest";

test("Next.js parses cookies and JSON before forwarding API requests", async () => {
  const requests: { url?: string; authorization?: string; body: string }[] = [];
  const upstream = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    requests.push({
      ...(req.url && { url: req.url }),
      ...(req.headers.authorization && { authorization: req.headers.authorization }),
      body: Buffer.concat(chunks).toString(),
    });
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ type: "synced" }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstream.address();
  if (!upstreamAddress || typeof upstreamAddress === "string") throw new Error("Upstream did not bind");
  vi.stubEnv("KEEP_API_URL", `http://127.0.0.1:${upstreamAddress.port}`);

  const app = next({ dev: true, dir: process.cwd(), hostname: "127.0.0.1" });
  const server = createServer(app.getRequestHandler());
  try {
    await app.prepare();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Next.js did not bind");
    const url = `http://127.0.0.1:${address.port}/api/keep`;

    const guest = await fetch(url);
    expect(guest.status).toBe(401);
    expect(await guest.json()).toEqual({ error: "Authentication required." });
    expect(requests).toEqual([]);

    const operation = { operationId: "op-1", type: "remove", id: "article-1" };
    const response = await fetch(url, {
      method: "POST",
      headers: { cookie: "session=alice%2Fname", "content-type": "application/json" },
      body: JSON.stringify(operation),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ type: "synced" });
    expect(requests).toEqual([
      { url: "/users/alice%2Fname/keep/sync", authorization: "Bearer alice/name", body: JSON.stringify(operation) },
    ]);

    const unsupported = await fetch(url, { method: "DELETE", headers: { cookie: "session=alice" } });
    expect(unsupported.status).toBe(405);
    expect(unsupported.headers.get("allow")).toBe("GET, POST");
  } finally {
    server.closeAllConnections();
    if (server.listening)
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await app.close();
    upstream.closeAllConnections();
    await new Promise<void>((resolve, reject) => upstream.close((error) => (error ? reject(error) : resolve())));
    vi.unstubAllEnvs();
  }
}, 60_000);
