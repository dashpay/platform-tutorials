export class UrlValidationError extends Error {}
export function normalizeUrl(input: string): string | undefined {
  const text = input.trim();
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname ||
      url.href.length > 256
    )
      throw new Error();
    return url.href;
  } catch {
    throw new UrlValidationError(
      "Enter an HTTP or HTTPS URL of at most 256 characters.",
    );
  }
}
