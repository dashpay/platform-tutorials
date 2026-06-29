const REPO =
  "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashrate/src/dash/";
const DASH_DIR =
  "https://github.com/dashpay/platform-tutorials/tree/main/example-apps/dashrate/src/dash";

type QueryGlyph = "count" | "distribution" | "filter" | "history";

const QUERY_CARDS: Array<{
  label: string;
  sub: string;
  glyph: QueryGlyph;
  file: string;
}> = [
  {
    label: "Total count",
    sub: "documents.count",
    glyph: "count",
    file: "queries.ts",
  },
  {
    label: "Grouped distribution",
    sub: 'documents.count · groupBy: ["rating"]',
    glyph: "distribution",
    file: "queries.ts",
  },
  {
    label: "Filter by rating",
    sub: "documents.query · rating == N",
    glyph: "filter",
    file: "queries.ts",
  },
  {
    label: "History",
    sub: "documents.history",
    glyph: "history",
    file: "history.ts",
  },
];

function QueryGlyphIcon({ kind }: { kind: QueryGlyph }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (kind) {
    case "count":
      // Stacked rows — a provable total.
      return (
        <svg {...common}>
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      );
    case "distribution":
      // Bars of varying height — the per-star histogram.
      return (
        <svg {...common}>
          <path d="M6 20V10M12 20V4M18 20v-7" />
        </svg>
      );
    case "filter":
      // Funnel — narrowing the result set with a where clause.
      return (
        <svg {...common}>
          <path d="M3 4h18l-7 8v6l-4 2v-8z" />
        </svg>
      );
    case "history":
      // Clock with a counter-clockwise arrow — revisions over time.
      return (
        <svg {...common}>
          <path d="M3 3v5h5" />
          <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
  }
}

const OPS: Array<{ op: string; file: string; sdk: string }> = [
  {
    op: "Recent reviews for a resource",
    file: "queries.ts",
    sdk: "documents.query",
  },
  { op: "Total review count", file: "queries.ts", sdk: "documents.count" },
  {
    op: "Rating distribution (per star)",
    file: "queries.ts",
    sdk: "documents.count · groupBy",
  },
  {
    op: "Save / edit a review",
    file: "review.ts",
    sdk: "documents.get → replace",
  },
  {
    op: "Review revision history",
    file: "history.ts",
    sdk: "documents.history",
  },
  {
    op: "Register the contract",
    file: "contract.ts",
    sdk: "contracts.publish",
  },
];

const READING_ORDER: Array<{ file: string; caption: string }> = [
  {
    file: "contract.ts",
    caption: "Schema + the four indices (unique, countable, rangeCountable).",
  },
  {
    file: "queries.ts",
    caption: "Every read — count, grouped count, filtered query.",
  },
  { file: "review.ts", caption: "Save = query, then create or get → replace." },
  {
    file: "history.ts",
    caption: "documents.history over a kept-history document type.",
  },
];

const SAMPLE_CODE = `const counts = await sdk.documents.count({
  dataContractId: contractId,
  documentTypeName: "review",
  where: [
    ["resourceId", "==", resourceId],
    ["rating", "between", [1, 5]],
  ],
  orderBy: [["rating", "asc"]],
  groupBy: ["rating"],
});`;

export function HowItWorks() {
  return (
    <section className="panel">
      <header>
        <p className="eyebrow">DashRate · relational queries</p>
        <h2>How it works</h2>
        <p className="muted hiw-intro">
          DashRate stores one mutable <code>review</code> document per identity
          and resource. The unique <code>$ownerId + resourceId</code> index
          prevents duplicate reviews by the same identity, so saving again edits
          the existing document instead of creating a second one. The rest of
          this page walks the relational query surface the app demonstrates —
          provable counts, grouped counts, range filters, and revision history.
        </p>
      </header>

      <div className="hiw-grid">
        {QUERY_CARDS.map((card) => (
          <a
            key={card.label}
            className="hiw-card"
            href={`${REPO}${card.file}`}
            target="_blank"
            rel="noreferrer"
          >
            <span className="hiw-card-glyph">
              <QueryGlyphIcon kind={card.glyph} />
            </span>
            <span className="hiw-card-title">{card.label}</span>
            <code className="hiw-card-sub">{card.sub}</code>
          </a>
        ))}
      </div>

      <div className="hiw-split">
        <section className="hiw-ops">
          <p className="eyebrow">Platform operations</p>
          <p className="muted hiw-ops-intro">
            Each row links to a one-file helper in <code>src/dash/</code>. Read
            these as the canonical example of each SDK call.
          </p>
          <ul className="hiw-op-list">
            {OPS.map((o) => (
              <li key={o.op}>
                <a
                  className="hiw-op-row"
                  href={`${REPO}${o.file}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="hiw-op-name">{o.op}</span>
                  <code className="hiw-op-sdk">{o.sdk}</code>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="hiw-code">
          <div className="hiw-code-head">
            <code>src/dash/queries.ts</code>
            <a
              href={`${REPO}queries.ts`}
              target="_blank"
              rel="noreferrer"
              className="hiw-code-link"
            >
              View full file →
            </a>
          </div>
          <p className="muted hiw-code-caption">
            The provable grouped <code>count</code> that drives the per-star
            distribution bars. The average is derived in JS from these counts —
            there is no separate <code>sum</code> / <code>average</code> query.
          </p>
          <pre className="hiw-code-pre">{SAMPLE_CODE}</pre>
        </section>
      </div>

      <section className="hiw-reading">
        <p className="eyebrow">Recommended source files</p>
        <p className="muted hiw-reading-intro">
          Read these in order to build up the mental model: schema and indices
          first, then the reads, then the write, and finally revision history.
        </p>
        <ol className="hiw-reading-list">
          {READING_ORDER.map((item, i) => (
            <li key={item.file}>
              <a
                className="hiw-reading-row"
                href={`${REPO}${item.file}`}
                target="_blank"
                rel="noreferrer"
              >
                <span className="hiw-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="hiw-reading-text">
                  <code>{item.file}</code> — {item.caption}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <a className="hiw-cta" href={DASH_DIR} target="_blank" rel="noreferrer">
        <span className="hiw-cta-main">
          <span className="hiw-cta-icon" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
            </svg>
          </span>
          <span>
            <strong>Browse the DashRate source on GitHub</strong>
            <span className="hiw-cta-sub">example-apps/dashrate/src/dash</span>
          </span>
        </span>
        <span className="hiw-cta-arrow" aria-hidden="true">
          →
        </span>
      </a>
    </section>
  );
}
