import type { KeepItem, KeepSchema } from "../items/types";

export class KeepSchemaValidationError extends Error {
  readonly cause?: unknown;
  readonly itemId?: string;

  constructor(message: string, options: { cause?: unknown; itemId?: string } = {}) {
    super(message);
    this.name = "KeepSchemaValidationError";
    this.cause = options.cause;
    this.itemId = options.itemId;
  }
}

export function stripUndefinedMeta<T>(value: T): T {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).filter(
    (key) => "value" in descriptors[key] && descriptors[key].value === undefined,
  );
  if (keys.length === 0) return value;
  for (const key of keys) delete descriptors[key];
  return Object.defineProperties(Object.create(Object.getPrototypeOf(value)), descriptors) as T;
}

function schemaError(cause: unknown): KeepSchemaValidationError {
  const issues = Array.isArray(cause)
    ? cause
    : cause && typeof cause === "object" && "issues" in cause
      ? cause.issues
      : undefined;
  const paths = Array.isArray(issues)
    ? issues.flatMap((issue) => {
        if (!issue || typeof issue !== "object" || !Array.isArray(issue.path)) return [];
        const path = issue.path.map((segment: unknown) =>
          typeof segment === "object" && segment !== null && "key" in segment ? segment.key : segment,
        );
        return path.every((segment: unknown) => typeof segment === "string" || typeof segment === "number")
          ? [`meta.${path.join(".")}`]
          : [];
      })
    : [];
  return new KeepSchemaValidationError(
    `KeepKit metadata did not match the configured schema.${paths.length ? ` Fields: ${paths.join(", ")}.` : ""}`,
    { cause },
  );
}

/** Parse metadata with a Zod-like, safeParse-like, or Standard Schema parser. */
export async function parseKeepMeta<T>(schema: KeepSchema<T>, value: unknown): Promise<T> {
  value = stripUndefinedMeta(value);
  try {
    if ("parse" in schema) return await schema.parse(value);

    if ("safeParse" in schema) {
      const result = await schema.safeParse(value);
      if (result.success) return result.data;
      throw schemaError(result.error);
    }

    const result = await schema["~standard"].validate(value);
    if (!result.issues && "value" in result) return result.value as T;
    throw schemaError(result.issues);
  } catch (cause) {
    if (cause instanceof KeepSchemaValidationError) throw cause;
    throw schemaError(cause);
  }
}

export async function validateKeepItem<TMeta>(
  item: KeepItem<unknown>,
  schema: KeepSchema<TMeta>,
): Promise<KeepItem<TMeta>> {
  return { ...item, meta: await parseKeepMeta(schema, item.meta) };
}
