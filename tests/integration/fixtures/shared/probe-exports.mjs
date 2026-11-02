// Imports or resolves package specifiers from this consumer project and prints the results as JSON.
const { imports = [], resolves = [] } = JSON.parse(process.argv[2] ?? "{}");

const describeError = (error) => ({ code: error?.code ?? null, message: String(error?.message ?? error) });

const imported = [];
for (const specifier of imports) {
  try {
    const module = await import(specifier);
    imported.push({ specifier, exports: Object.keys(module).sort() });
  } catch (error) {
    imported.push({ specifier, error: describeError(error) });
  }
}

const resolved = [];
for (const specifier of resolves) {
  try {
    resolved.push({ specifier, url: import.meta.resolve(specifier) });
  } catch (error) {
    resolved.push({ specifier, error: describeError(error) });
  }
}

process.stdout.write(JSON.stringify({ imported, resolved }));
