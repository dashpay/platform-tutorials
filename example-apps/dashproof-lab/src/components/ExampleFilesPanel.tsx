import { EXAMPLE_FILE_FIXTURES } from "../data/exampleFiles";
import { CopyButton } from "./CopyButton";

// Strip the leading "/" from publicPath and join against BASE_URL so downloads
// resolve correctly when the app is served from a sub-path (e.g. GitHub Pages).
function resolveFixtureHref(publicPath: string): string {
  const base = import.meta.env.BASE_URL;
  const trimmedBase = base.endsWith("/") ? base : `${base}/`;
  const trimmedPath = publicPath.startsWith("/")
    ? publicPath.slice(1)
    : publicPath;
  return `${trimmedBase}${trimmedPath}`;
}

export function ExampleFilesPanel() {
  return (
    <div className="space-y-3">
      {EXAMPLE_FILE_FIXTURES.map((fixture) => (
        <article
          key={fixture.id}
          className="rounded-lg border border-line bg-bg px-4 py-4"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                {fixture.label}
              </div>
              <div className="mt-1 text-[14px] font-medium text-ink">
                {fixture.filename}
              </div>
              <p className="mt-2 max-w-[720px] text-[12px] leading-5 text-ink-3">
                {fixture.note}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <a
                href={resolveFixtureHref(fixture.publicPath)}
                download={fixture.filename}
                className="inline-flex rounded-md border border-line-2 px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink"
              >
                Download fixture
              </a>
            </div>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                Suggested chain
              </dt>
              <dd className="mt-1 flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate font-mono text-[12px] text-ink-2">
                  {fixture.chainId}
                </span>
                <CopyButton value={fixture.chainId} label="Suggested chain" />
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                SHA-256
              </dt>
              <dd className="mt-1 break-all font-mono text-[11px] leading-5 text-ink-2">
                {fixture.sha256Hex}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
