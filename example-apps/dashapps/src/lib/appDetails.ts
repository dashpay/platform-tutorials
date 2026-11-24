export type DocumentSchemaSummary = {
  name: string;
  properties: string[];
  indexCount: number;
};

export function summarizeSchemas(
  schemas: Record<string, object>,
): DocumentSchemaSummary[] {
  return Object.entries(schemas).map(([name, raw]) => {
    const schema = raw as {
      properties?: Record<string, unknown>;
      indices?: unknown[];
    };
    return {
      name,
      properties: Object.keys(schema.properties ?? {}),
      indexCount: Array.isArray(schema.indices) ? schema.indices.length : 0,
    };
  });
}

export function resourceLabel(href: string) {
  const url = new URL(href);
  if (url.hostname === "github.com" || url.hostname === "www.github.com") {
    const [owner, repository] = url.pathname.split("/").filter(Boolean);
    if (owner && repository)
      return `${owner}/${repository.replace(/\.git$/, "")}`;
  }
  return url.hostname;
}
