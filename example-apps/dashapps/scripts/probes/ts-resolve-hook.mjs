/**
 * Node resolve hook so probes can import the app's TypeScript modules, which use
 * extensionless relative specifiers (bundler resolution). Node's built-in type
 * stripping handles the syntax; this only appends `.ts` when a bare relative
 * import is not found. Usage: node --import ./scripts/probes/ts-resolve-hook.mjs …
 */
import { register } from "node:module";

register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (
      error.code === "ERR_MODULE_NOT_FOUND" &&
      /^\\.{1,2}\\//.test(specifier) &&
      !/\\.[a-z]+$/.test(specifier)
    )
      return next(specifier + ".ts", context);
    throw error;
  }
}
`),
);
