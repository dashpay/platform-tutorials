const REPO =
  "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashnote/src/dash/";
const APP_REPO =
  "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashnote/";

const PIPELINE: Array<{
  label: string;
  sub: string;
  href?: string;
}> = [
  {
    label: "UI",
    sub: "NoteEditor.tsx",
    href: "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashnote/src/components/NoteEditor.tsx",
  },
  {
    label: "Helper",
    sub: "src/dash/*.ts",
    href: "https://github.com/dashpay/platform-tutorials/tree/main/example-apps/dashnote/src/dash",
  },
  {
    label: "Evo SDK",
    sub: "@dashevo/evo-sdk",
    href: "https://www.npmjs.com/package/@dashevo/evo-sdk",
  },
  {
    label: "Platform",
    sub: "testnet",
    href: "https://testnet.platform-explorer.com/",
  },
];

// Progressively darker cards reinforce the left-to-right flow direction so
// the four boxes don't read as equally-weighted siblings.
const PIPELINE_BG = [
  "bg-bg",
  "bg-[color:color-mix(in_oklab,var(--color-bg)_75%,var(--color-accent)_8%)]",
  "bg-[color:color-mix(in_oklab,var(--color-bg)_50%,var(--color-accent)_16%)]",
  "bg-[color:color-mix(in_oklab,var(--color-bg)_25%,var(--color-accent)_24%)]",
];

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
      {/* 1. How data flows */}
      <section className="rounded-2xl border border-line bg-surface px-7 py-4 max-md:px-5 max-md:py-4">
        <div className={SECTION_LABEL}>Data flow</div>
        <div className="mt-2 space-y-2 text-[13px] leading-6 text-ink-2">
          <p>
            Dashnote stores each entry as a single <code>note</code> document
            with an optional <code>title</code> and a required{" "}
            <code>message</code>. Every operation in the app follows the same
            four-step path below: a React component calls a one-file helper in{" "}
            <code>src/dash/</code>, the helper calls the Evo SDK, and the SDK
            writes to a Platform node on testnet.{" "}
            <strong className="font-semibold text-ink">
              If you&apos;re reading dashnote to learn the SDK, the files in{" "}
              <code>src/dash/</code> are the lesson — everything else is
              plumbing.
            </strong>
          </p>
          <p>
            Every update is a full document replacement with an incremented
            revision, so the UI can show <code>$revision</code> alongside the
            Platform-provided <code>$createdAt</code> and{" "}
            <code>$updatedAt</code> timestamps. Earlier note bodies aren&apos;t
            shown — &quot;history&quot; in dashnote means the current state plus
            its metadata.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {PIPELINE.map((step, i, arr) => {
            const cardClass = `block rounded-xl border border-line p-4 ${PIPELINE_BG[i]}`;
            const cardBody = (
              <>
                <div className="text-[14px] font-bold text-ink">
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
              Read these as the canonical example of each SDK call.
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
