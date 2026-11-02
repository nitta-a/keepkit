// @vitest-environment node
import { createServer } from "node:http";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

const requests: { method?: string; url?: string; authorization?: string; body: string }[] = [];
let upstreamStatus = 200;
let upstreamBody: unknown = [];
let upstreamUrl = "";
const upstream = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  requests.push({
    ...(req.method && { method: req.method }),
    ...(req.url && { url: req.url }),
    ...(req.headers.authorization && { authorization: req.headers.authorization }),
    body: Buffer.concat(chunks).toString(),
  });
  res.writeHead(upstreamStatus, { "content-type": "application/json" }).end(JSON.stringify(upstreamBody));
});

beforeAll(async () => {
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  if (!address || typeof address === "string") throw new Error("Upstream did not bind");
  upstreamUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  requests.length = 0;
  upstreamStatus = 200;
  upstreamBody = [];
  vi.stubEnv("KEEP_API_URL", upstreamUrl);
  vi.resetModules();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await new Promise<void>((resolve, reject) => upstream.close((error) => (error ? reject(error) : resolve())));
});

async function callHandler(method: string, session?: string, body?: unknown) {
  const { default: handler } = await import("../pages/api/keep");
  const req = { method, cookies: session ? { session } : {}, body } as NextApiRequest;
  const result: { status?: number; body?: unknown; headers: Record<string, string | string[]> } = { headers: {} };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(value: unknown) {
      result.body = value;
      return this;
    },
    setHeader(name: string, value: string | string[]) {
      result.headers[name] = value;
      return this;
    },
  };
  await handler(req, res as unknown as NextApiResponse);
  return result;
}

test("rejects unauthenticated requests and unsupported methods without contacting upstream", async () => {
  expect(await callHandler("GET")).toMatchObject({ status: 401, body: { error: "Authentication required." } });
  expect(await callHandler("DELETE", "alice")).toEqual({
    status: 405,
    body: { error: "Method not allowed." },
    headers: { Allow: ["GET", "POST"] },
  });
  expect(requests).toEqual([]);
});

test("forwards authenticated GET and POST requests to upstream", async () => {
  upstreamBody = [{ id: "article-1" }];
  expect(await callHandler("GET", "alice/name")).toMatchObject({ status: 200, body: upstreamBody });
  const operation = { operationId: "op-1", type: "remove", id: "article-1" };
  upstreamBody = { type: "synced" };
  expect(await callHandler("POST", "alice/name", operation)).toMatchObject({ status: 200, body: upstreamBody });
  expect(requests).toEqual([
    { method: "GET", url: "/users/alice%2Fname/keep", authorization: "Bearer alice/name", body: "" },
    {
      method: "POST",
      url: "/users/alice%2Fname/keep/sync",
      authorization: "Bearer alice/name",
      body: JSON.stringify(operation),
    },
  ]);
});

test("returns 502 for an upstream error or missing configuration", async () => {
  upstreamStatus = 503;
  expect(await callHandler("GET", "alice")).toMatchObject({
    status: 502,
    body: { error: "Upstream Keep API failed (503)." },
  });
  vi.stubEnv("KEEP_API_URL", "");
  vi.resetModules();
  expect(await callHandler("POST", "alice", {})).toMatchObject({
    status: 502,
    body: { error: "KEEP_API_URL is required by the Next.js example." },
  });
});

test("SSR loads the authenticated snapshot and skips upstream for guests", async () => {
  const { getServerSideProps } = await import("../pages/index");
  const context = (cookies: Record<string, string>) =>
    ({ req: { cookies } }) as Parameters<typeof getServerSideProps>[0];
  expect(await getServerSideProps(context({}))).toEqual({ props: { keepItems: [] } });
  expect(requests).toEqual([]);
  upstreamBody = [{ id: "article-1" }];
  expect(await getServerSideProps(context({ session: "alice" }))).toEqual({ props: { keepItems: upstreamBody } });
  expect(requests[0]).toMatchObject({ url: "/users/alice/keep", authorization: "Bearer alice" });
  upstreamStatus = 503;
  await expect(getServerSideProps(context({ session: "alice" }))).rejects.toThrow("Upstream Keep API failed (503).");
});
