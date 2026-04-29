import { EXAMPLE_FILE_FIXTURES } from "../data/exampleFiles";

function stripExtension(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) return "";

  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0) return trimmed;
  return trimmed.slice(0, lastDot);
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function suggestChainId({
  filename,
  hashHex,
}: {
  filename: string;
  hashHex?: string;
}): string {
  const normalizedHash = hashHex?.trim().toLowerCase();

  const fixture =
    EXAMPLE_FILE_FIXTURES.find(
      (item) =>
        normalizedHash && item.sha256Hex.toLowerCase() === normalizedHash,
    ) ?? EXAMPLE_FILE_FIXTURES.find((item) => item.filename === filename);

  if (fixture) return fixture.chainId;

  const filenameStem = stripExtension(filename);
  return slugify(filenameStem) || "proof";
}
