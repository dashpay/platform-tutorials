const REPO =
  "https://github.com/dashpay/platform-tutorials/blob/main/example-apps/dashrate/src/dash/";
const DASH_DIR =
  "https://github.com/dashpay/platform-tutorials/tree/main/example-apps/dashrate/src/dash";

type QueryGlyph = "average" | "distribution" | "paging" | "history";

const QUERY_CARDS: Array<{
  label: string;
  sub: string;
  glyph: QueryGlyph;
  file: string;
}> = [
  {
    label: "Proven average",
    sub: "documents.average",
    glyph: "average",
    file: "queries.ts",
  },
  {
    label: "Grouped distribution",
    sub: 'documents.count · groupBy: ["rating"]',
    glyph: "distribution",
    file: "queries.ts",
  },
  {
    label: "Newest-first pages",
    sub: "documents.query · $updatedAt desc + startAfter",
    glyph: "paging",
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
    case "average":
      // A balance point on a scale — sum ÷ count.
      return (
        <svg {...common}>
          <path d="M4 18h16" />
          <path d="M12 18 8 8h8z" />
        </svg>
      );
    case "distribution":
      // Bars of varying height — the per-star histogram.
      return (
        <svg {...common}>
          <path d="M6 20V10M12 20V4M18 20v-7" />
        </svg>
      );
    case "paging":
      // A list with a "next" arrow — cursor paging.
      return (
        <svg {...common}>
          <path d="M4 6h12M4 11h12M4 16h6" />
          <path d="m15 15 3 3 3-3M18 11v7" />
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
    op: "Average rating per resource",
    file: "queries.ts",
    sdk: "documents.average",
  },
  {
    op: "Rating distribution (per star)",
    file: "queries.ts",
    sdk: "documents.count · groupBy",
  },
  {
    op: "Reviews, newest first, paged",
    file: "queries.ts",
    sdk: "documents.query · startAfter",
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
    caption:
      "Schema + indices: unique, averageable, ranked, range-countable, and the timestamp indices that page newest first.",
  },
  {
    file: "queries.ts",
    caption:
      "One resource's reads — average, grouped count, paged and filtered queries.",
  },
  { file: "review.ts", caption: "Save = query, then create or get → replace." },
  {
    file: "history.ts",
    caption: "documents.history over a kept-history document type.",
  },
];

const SAMPLE_CODE = `// Proven (count, sum) for one resource — divide for the average.
const avg = await sdk.documents.average(
  {
    dataContractId: contractId,
    documentTypeName: "review",
    where: [["resourceId", "==", resourceId]],
  },
  "rating",
);
const { count, sum } = avg.get("") ?? { count: 0n, sum: 0n };

// Its reviews, newest first: ask for one extra to know if there's a page 2.
const page = await sdk.documents.query({
  dataContractId: contractId,
  documentTypeName: "review",
  where: [["resourceId", "==", resourceId]],
  orderBy: [["$updatedAt", "desc"]],
  limit: 10 + 1,
  startAfter: lastShownId, // omit on the first page
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
          this page walks the query surface the app demonstrates — proven
          averages, grouped counts, newest-first paging, and revision history.
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
            <code>average</code> returns the exact integers, not a quotient —
            divide in JS. Pages come back already newest first; the extra row
            only decides whether to offer &ldquo;Load more&rdquo;.
          </p>
          <pre className="hiw-code-pre">{SAMPLE_CODE}</pre>
        </section>
      </div>

      <section className="hiw-reading">
        <p className="eyebrow">Recommended source files</p>
        <p className="muted hiw-reading-intro">
          Read these in order to build up the mental model: schema and indices
          first, then the reads, then the write, and finally revision history.
          Every read is a proof-verified Platform query.
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
