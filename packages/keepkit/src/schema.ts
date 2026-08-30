import type { KeepItem, KeepSchema } from "./types";

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

/** Parse metadata with a Zod-like, safeParse-like, or Standard Schema parser. */
export async function parseKeepMeta<T>(schema: KeepSchema<T>, value: unknown): Promise<T> {
  try {
    if ("parse" in schema) return await schema.parse(value);

    if ("safeParse" in schema) {
      const result = await schema.safeParse(value);
      if (result.success) return result.data;
      throw new KeepSchemaValidationError("KeepKit metadata did not match the configured schema.", {
        cause: result.error,
      });
    }

    const result = await schema["~standard"].validate(value);
    if (!result.issues && "value" in result) return result.value as T;
    throw new KeepSchemaValidationError("KeepKit metadata did not match the configured schema.", {
      cause: result.issues,
    });
  } catch (cause) {
    if (cause instanceof KeepSchemaValidationError) throw cause;
    throw new KeepSchemaValidationError("KeepKit metadata did not match the configured schema.", {
      cause,
    });
  }
}

export async function validateKeepItem<TMeta>(
  item: KeepItem<unknown>,
  schema: KeepSchema<TMeta>,
): Promise<KeepItem<TMeta>> {
  return { ...item, meta: await parseKeepMeta(schema, item.meta) };
}
