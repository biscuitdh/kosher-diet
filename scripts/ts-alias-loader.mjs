import fs from "node:fs";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const baseUrl = new URL(specifier.slice(2), `file://${process.cwd()}/`);
    try {
      return await nextResolve(baseUrl.href, context);
    } catch {
      return nextResolve(`${baseUrl.href}.ts`, context);
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const json = fs.readFileSync(new URL(url), "utf8");
    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${json};`
    };
  }

  return nextLoad(url, context);
}
