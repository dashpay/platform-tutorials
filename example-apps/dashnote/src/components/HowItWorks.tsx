const REPO =
  "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashnote/src/dash/";
const APP_REPO =
  "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashnote/";

type PipelineGlyph = "ui" | "helper" | "sdk" | "platform";

const PIPELINE: Array<{
  label: string;
  sub: string;
  glyph: PipelineGlyph;
  href?: string;
}> = [
  {
    label: "UI",
    sub: "NoteEditor.tsx",
    glyph: "ui",
    href: "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashnote/src/components/NoteEditor.tsx",
  },
  {
    label: "Helper",
    sub: "src/dash/*.ts",
    glyph: "helper",
    href: "https://github.com/dashpay/platform-tutorials/tree/main/example-apps/dashnote/src/dash",
  },
  {
    label: "Evo SDK",
    sub: "@dashevo/evo-sdk",
    glyph: "sdk",
    href: "https://www.npmjs.com/package/@dashevo/evo-sdk",
  },
  {
    label: "Platform",
    sub: "testnet",
    glyph: "platform",
    href: "https://testnet.platform-explorer.com/",
  },
];

function PipelineGlyphIcon({ kind }: { kind: PipelineGlyph }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "ui":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      );
    case "helper":
      return (
        <svg {...common}>
          <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
        </svg>
      );
    case "sdk":
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case "platform":
      return (
        <svg {...common}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
  }
}

const OPS = [
  { op: "Create a note", file: "createNote.ts", sdk: "documents.create" },
  {
    op: "Update a note",
    file: "updateNote.ts",
    sdk: "documents.get → replace",
  },
  { op: "Delete a note", file: "deleteNote.ts", sdk: "documents.delete" },
  { op: "List my notes", file: "queries.ts", sdk: "documents.query" },
  { op: "Register a contract", file: "contract.ts", sdk: "contracts.publish" },
];

const READING_ORDER = [
  { file: "src/dash/contract.ts", caption: "Schema + indices." },
  { file: "src/dash/createNote.ts", caption: "Simplest mutation." },
  {
    file: "src/dash/updateNote.ts",
    caption: "Fetch → bump revision → replace.",
  },
  {
    file: "src/components/NotesWorkspace.tsx",
    caption: "Cache + revalidation.",
  },
];

const SAMPLE_CODE = `const document = new Document({
  properties: { title, message },
  documentTypeName: "note",
  dataContractId,
  ownerId,
});

await sdk.documents.create({
  document, identityKey, signer,
});`;

const SECTION_LABEL =
  "text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3";
const SECTION_INTRO = "mt-2 text-[12.5px] leading-5 text-ink-2";

export function HowItWorks() {
  return (
    <div className="flex flex-col gap-3">
      {/* 0. Page header */}
      <header className="px-1 pb-1 pt-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
          How Dashnote works
        </div>
        <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.1] tracking-tight text-ink max-md:text-[22px]">
          A walkthrough of every SDK call this app makes
        </h1>
        <p className="mt-2 max-w-[640px] text-[13px] leading-6 text-ink-2">
          Dashnote stores each entry as a single <code>note</code> document with
          an optional <code>title</code> and a required <code>message</code>.
          Every operation follows the same four-step path: a React component
          calls a one-file helper in <code>src/dash/</code>, the helper calls
          the Evo SDK, and the SDK writes to a Platform node on testnet. The
          files in <code>src/dash/</code> are the lesson — everything else is
          plumbing.
        </p>
      </header>

      {/* 1. Data flow */}
      <section className="rounded-2xl border border-line bg-surface px-7 py-5 max-md:px-5 max-md:py-4">
        <div className={SECTION_LABEL}>Data flow</div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {PIPELINE.map((step, i, arr) => {
            const cardClass =
              "block rounded-xl border border-line bg-bg p-4 text-accent";
            const cardBody = (
              <>
                <PipelineGlyphIcon kind={step.glyph} />
                <div className="mt-3 text-[14px] font-bold text-ink">
                  {step.label}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-3">
                  {step.sub}
                </div>
              </>
            );
            return (
              <div key={step.label} className="relative">
                {step.href ? (
                  <a
                    href={step.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`${cardClass} transition hover:border-accent-dim`}
                  >
                    {cardBody}
                  </a>
                ) : (
                  <div className={cardClass}>{cardBody}</div>
                )}
                {i < arr.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-full top-1/2 z-10 hidden -translate-y-1/2 text-[14px] leading-none text-accent md:block"
                  >
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Operations table + inline code peek */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="px-5 pt-4 pb-3">
            <div className={SECTION_LABEL}>Platform operations</div>
            <p className={SECTION_INTRO}>
              Each row links to a one-file helper in <code>src/dash/</code>.
              Read these as the canonical example of each SDK call. Every update
              is a full document replacement with an incremented{" "}
              <code>$revision</code>, so the UI can show that alongside the
              Platform-provided <code>$createdAt</code> and{" "}
              <code>$updatedAt</code> timestamps.
            </p>
          </div>
          {OPS.map((o) => (
            <a
              key={o.file}
              href={`${REPO}${o.file}`}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[1.05fr_0.95fr] items-center gap-3 border-t border-line px-5 py-3 text-[13px] hover:bg-surface-2"
            >
              <span className="font-medium text-ink">{o.op}</span>
              <span className="font-mono text-[12px] text-ink-3">{o.sdk}</span>
            </a>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-bg">
          <div className="border-b border-line px-5 py-3">
            <div className="flex items-center justify-between">
              <code className="text-[12px] text-ink-2">
                src/dash/createNote.ts
              </code>
              <a
                href={`${REPO}createNote.ts`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[10px] text-accent hover:underline"
              >
                View full file →
              </a>
            </div>
            <p className={SECTION_INTRO}>
              The shortest mutation in the app — building a{" "}
              <code>Document</code> and handing it to{" "}
              <code>sdk.documents.create</code>.
            </p>
          </div>
          <pre className="overflow-x-auto px-5 py-4 font-mono text-[11.5px] leading-[1.65] text-ink-2">
            {SAMPLE_CODE}
          </pre>
        </section>
      </div>

      {/* 3. Suggested reading order */}
      <section className="rounded-2xl border border-line bg-surface px-7 py-5 max-md:px-5">
        <div className={SECTION_LABEL}>Recommended source files</div>
        <p className={SECTION_INTRO}>
          Read these in order to build up the mental model: schema first, then
          the simplest write, then the read-bump-replace pattern, and finally
          the UI layer that owns caching and revalidation.
        </p>
        <ol className="mt-4 space-y-1">
          {READING_ORDER.map((item, i) => (
            <li key={item.file}>
              <a
                href={`${APP_REPO}${item.file}`}
                target="_blank"
                rel="noreferrer"
                className="-mx-2 flex items-baseline gap-3 rounded-md px-2 py-1.5 transition hover:bg-surface-2"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:color-mix(in_oklab,var(--color-accent)_14%,transparent)] font-mono text-[11px] font-semibold text-accent"
                >
                  {i + 1}
                </span>
                <span className="text-[13px] leading-5 text-ink-2">
                  <code className="text-ink">{item.file}</code> — {item.caption}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Continue to tutorial */}
      <a
        href="https://docs.dash.org/projects/platform/en/stable/docs/tutorials/example-apps/dashnote.html"
        target="_blank"
        rel="noreferrer"
        className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-3.5 text-[13px] text-ink-2 transition hover:border-accent-dim hover:bg-surface-2 hover:text-ink"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:color-mix(in_oklab,var(--color-accent)_18%,transparent)] text-accent transition group-hover:bg-accent group-hover:text-bg">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </span>
          <span>
            <span className="font-semibold text-ink">
              Continue to the Dashnote tutorial
            </span>
            <span className="ml-1.5 text-ink-3">on docs.dash.org</span>
          </span>
        </span>
        <span aria-hidden="true" className="text-ink-3 group-hover:text-accent">
          →
        </span>
      </a>
    </div>
  );
}
