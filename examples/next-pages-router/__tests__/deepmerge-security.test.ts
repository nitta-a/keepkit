import { createRequire } from "node:module";

const requireFromJestConfig = createRequire(require.resolve("jest-config"));
const merge = requireFromJestConfig("deepmerge") as (target: object, source: object) => Record<string, unknown>;

test("deepmerge rejects prototype keys in both inputs", () => {
  const payload = JSON.parse('{"__proto__":{"admin":true},"safe":1}');
  for (const result of [merge(Object.create(null), payload), merge(payload, {})]) {
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(result.admin).toBeUndefined();
    expect(result.safe).toBe(1);
  }
  expect((merge({ session: null }, { session: payload }).session as Record<string, unknown>).admin).toBeUndefined();
});
