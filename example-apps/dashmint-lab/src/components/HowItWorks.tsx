/**
 * Static educational page: explains how DashMint Lab works and
 * compares the Dash Platform approach with Ethereum ERC-721 NFTs.
 */

const OPERATIONS: { op: string; file: string; method: string }[] = [
  {
    op: "Connect testnet",
    file: "src/dash/client.ts",
    method: "EvoSDK.testnetTrusted()",
  },
  {
    op: "Derive keys",
    file: "src/dash/keyManager.ts",
    method: "wallet.deriveKeyFromSeedWithPath",
  },
  {
    op: "Deploy contract",
    file: "src/dash/contract.ts",
    method: "sdk.contracts.publish",
  },
  {
    op: "Mint card",
    file: "src/dash/mintCard.ts",
    method: "sdk.documents.create + tokenPaymentInfo",
  },
  {
    op: "Read token balance",
    file: "src/dash/dashMintToken.ts",
    method: "sdk.tokens.calculateId → sdk.tokens.identityBalances",
  },
  {
    op: "Transfer card",
    file: "src/dash/transferCard.ts",
    method: "sdk.documents.transfer",
  },
  {
    op: "Set / remove price",
    file: "src/dash/setPrice.ts",
    method: "sdk.documents.setPrice",
  },
  {
    op: "Purchase card",
    file: "src/dash/purchaseCard.ts",
    method: "sdk.documents.purchase",
  },
  {
    op: "Burn (delete)",
    file: "src/dash/burnCard.ts",
    method: "sdk.documents.delete",
  },
  {
    op: "Query cards",
    file: "src/dash/queries.ts",
    method: "sdk.documents.query",
  },
];

const COMPARISONS: { dimension: string; dash: string; ethereum: string }[] = [
  {
    dimension: "Ownership model",
    dash: "Cards are documents owned by platform identities",
    ethereum: "NFTs are tokens owned by wallet addresses",
  },
  {
    dimension: "What gets created",
    dash: "A document containing the card data",
    ethereum: "A token in a smart contract",
  },
  {
    dimension: "Contract model",
    dash: "JSON schema data contracts define structure and rules",
    ethereum: "Solidity smart contracts define behavior",
  },
  {
    dimension: "Metadata",
    dash: "Stored directly in the document (on-chain)",
    ethereum: "Usually off-chain (IPFS), referenced by a URI or hash",
  },
  {
    dimension: "Minting",
    dash: "Burn 1 fixed-supply DashMint token, then create a card document",
    ethereum:
      "Upload metadata to IPFS, then call a contract function to mint a token",
  },
  {
    dimension: "Supply cap",
    dash: "The DashMint token supply caps how many card documents can be created",
    ethereum: "Usually enforced by smart-contract mint logic",
  },
  {
    dimension: "Transfer",
    dash: "Update document ownership via a single platform operation",
    ethereum: "Call transferFrom / safeTransferFrom with approval model",
  },
  {
    dimension: "Trading",
    dash: "Built-in setPrice / purchase primitives at the platform level",
    ethereum:
      "Requires separate marketplace contracts (OpenSea, Seaport, etc.)",
  },
  {
    dimension: "Cost model",
    dash: "Fees paid in platform credits (predictable, derived from Dash)",
    ethereum: "Gas fees paid in ETH (variable, auction-based)",
  },
  {
    dimension: "Developer workflow",
    dash: "JavaScript/TypeScript + JSON schemas + SDK — no new language",
    ethereum:
      "Learn Solidity + Foundry/Hardhat toolchain + ABI encoding + frontend integration",
  },
  {
    dimension: "Querying",
    dash: "Built-in document queries with where-clause filters",
    ethereum:
      "Contract view functions, event logs, or external indexers (The Graph)",
  },
];

const READING_ORDER = [
  {
    file: "src/dash/contract.ts",
    desc: "Defines the card schema, DashMint token, and one-token burn rule.",
  },
  {
    file: "src/dash/dashMintToken.ts",
    desc: "Token payment metadata and DashMint token balance lookup.",
  },
  {
    file: "src/dash/mintCard.ts",
    desc: "Creates a card document while agreeing to burn one DashMint token.",
  },
  {
    file: "src/dash/withAuthedCard.ts",
    desc: "Shared prelude for transfer, setPrice, purchase, burn.",
  },
  {
    file: "src/session/SessionContext.tsx",
    desc: "SDK instance, identity, contract ID, activity log.",
  },
  {
    file: "src/components/",
    desc: "UI. Modals call src/dash/ functions directly.",
  },
];

export function HowItWorks() {
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-3.5">
      {/* ── 1. What is DashMint Lab? ──────────────────────────── */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-[16px] font-semibold leading-[1.3] text-ink">
          What is DashMint Lab?
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-ink-2">
          DashMint Lab lets you create and trade NFT-style collectibles on Dash
          Platform. Each card is a document owned by an identity — transferable,
          tradeable, and stored on-chain. Mint capacity is constrained by a
          fixed-supply DashMint token.
        </p>

        {/* Core idea callout */}
        <div className="mt-4 rounded-lg border border-line bg-bg p-3.5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            Core idea
          </div>
          <p className="text-[13px] leading-[1.55] text-ink-2">
            Cards are documents stored on Dash Platform. The DashMint token is
            the minting resource that makes creation scarce:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] leading-[1.55] text-ink-2">
            <li>Creating a card = burning 1 DashMint token</li>
            <li>Each successful mint creates a new card document</li>
            <li>Ownership = which identity controls that document</li>
            <li>Transfer = updating ownership via a state transition</li>
          </ul>
        </div>
      </section>

      {/* ── 2. Platform operations at a glance ────────────────── */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[14px] font-semibold text-ink">
          Platform operations at a glance
        </h3>
        <p className="mt-1 text-[12.5px] text-ink-3">
          Each row maps to a real file in{" "}
          <code className="rounded bg-bg px-1 py-0.5 font-mono text-[11.5px] text-ink-2">
            src/dash/
          </code>
          .
        </p>

        <div className="mt-3 overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-bg">
                <th className="px-3 py-2 font-medium text-ink-3">Operation</th>
                <th className="px-3 py-2 font-medium text-ink-3">File</th>
                <th className="px-3 py-2 font-medium text-ink-3">SDK method</th>
              </tr>
            </thead>
            <tbody>
              {OPERATIONS.map((row, i) => (
                <tr
                  key={row.op}
                  className={`border-b border-line last:border-0 ${
                    i % 2 === 0 ? "bg-bg/50" : ""
                  }`}
                >
                  <td className="px-3 py-2 font-medium text-ink">{row.op}</td>
                  <td className="px-3 py-2 font-mono text-[11.5px] text-ink-2">
                    {row.file}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11.5px] text-ink-3">
                    {row.method}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 3. Coming from Ethereum? ──────────────────────────── */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[14px] font-semibold text-ink">
          Coming from Ethereum?
        </h3>
        <p className="mt-1 mb-4 text-[12.5px] text-ink-3">
          On Ethereum, NFTs are usually built with{" "}
          <strong style={{ color: "var(--color-syntax-purple)" }}>
            ERC-721 smart contracts
          </strong>
          . Here, they're built with{" "}
          <strong className="text-accent">documents and identities</strong>.
        </p>

        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line bg-bg">
                <th className="px-3 py-2 font-medium text-ink-3" />
                <th className="px-3 py-2 font-medium text-accent">
                  Dash Platform
                </th>
                <th
                  className="px-3 py-2 font-medium"
                  style={{ color: "var(--color-syntax-purple)" }}
                >
                  Ethereum (ERC-721)
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISONS.map((row, i) => (
                <tr
                  key={row.dimension}
                  className={`border-b border-line last:border-0 ${
                    i % 2 === 0 ? "bg-bg/50" : ""
                  }`}
                >
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap text-ink">
                    {row.dimension}
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{row.dash}</td>
                  <td className="px-3 py-2.5 text-ink-3">{row.ethereum}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 4. Reading order ──────────────────────────────────── */}
      <section className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[14px] font-semibold text-ink">Reading order</h3>
        <p className="mt-1 mb-3 text-[12.5px] text-ink-3">
          Start here and work outward:
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-[1.55] text-ink-2">
          {READING_ORDER.map((item) => (
            <li key={item.file}>
              <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-[12px] text-ink-2">
                {item.file}
              </code>
              {" — "}
              {item.desc}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
