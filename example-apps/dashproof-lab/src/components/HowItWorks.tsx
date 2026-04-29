const OPERATIONS: Array<{ op: string; file: string; method: string }> = [
  {
    op: "Connect to testnet",
    file: "src/dash/client.ts",
    method: 'createClient("testnet")',
  },
  {
    op: "Derive identity keys",
    file: "src/dash/keyManager.ts",
    method: "IdentityKeyManager.create",
  },
  {
    op: "Use bundled/default contract ID",
    file: "src/dash/contract.ts",
    method: "loadStoredContractId / DEFAULT_CONTRACT_ID",
  },
  {
    op: "Register proof contract",
    file: "src/dash/contract.ts",
    method: "sdk.contracts.publish",
  },
  {
    op: "Create proof",
    file: "src/dash/createAnchor.ts",
    method: "sdk.documents.create",
  },
  {
    op: "Verify by hash",
    file: "src/dash/queries.ts",
    method: "sdk.documents.query",
  },
  {
    op: "Query by owner",
    file: "src/dash/queries.ts",
    method: "sdk.documents.query",
  },
  {
    op: "Query by chain",
    file: "src/dash/queries.ts",
    method: "sdk.documents.query",
  },
];

const READING_ORDER = [
  "src/dash/contract.ts",
  "src/dash/createAnchor.ts",
  "src/dash/queries.ts",
  "src/session/SessionContext.tsx",
  "src/components/AnchorForm.tsx",
  "src/components/VerifyPanel.tsx",
  "src/components/HistoryPanel.tsx",
];

export function HowItWorks() {
  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-3.5">
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-[16px] font-semibold leading-[1.3] text-ink">
          What is DashProof Lab?
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.55] text-ink-2">
          DashProof Lab is a proof-of-existence tutorial app for Dash Platform.
          It shows how to prove that a local file existed in a specific form at
          a Platform timestamp without uploading the file itself.
        </p>

        <div className="mt-4 rounded-lg border border-line bg-bg p-3.5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            Core idea
          </div>
          <ul className="list-disc space-y-1 pl-4 text-[13px] leading-[1.55] text-ink-2">
            <li>The file stays in the browser.</li>
            <li>The browser computes a SHA-256 hash locally.</li>
            <li>The app stores a proof document on Dash Platform.</li>
            <li>
              Verification means hashing again and querying by the same digest.
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[14px] font-semibold text-ink">Core proof model</h3>
        <p className="mt-1 text-[12.5px] text-ink-3">
          The proof is an immutable document. The important fields are:
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[11px] font-semibold text-ink">entryHash</div>
            <p className="mt-1 text-[12.5px] leading-6 text-ink-2">
              Base64-encoded SHA-256 digest of the selected file. This is the
              canonical proof key.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[11px] font-semibold text-ink">chainId</div>
            <p className="mt-1 text-[12.5px] leading-6 text-ink-2">
              User-supplied grouping label used for chain history queries.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[11px] font-semibold text-ink">
              filename, mimeType, size, note
            </div>
            <p className="mt-1 text-[12.5px] leading-6 text-ink-2">
              Optional metadata that helps explain what was proven without
              storing the file contents.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[11px] font-semibold text-ink">$createdAt</div>
            <p className="mt-1 text-[12.5px] leading-6 text-ink-2">
              Platform-created timestamp used as the proof time shown in the UI.
            </p>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-line bg-bg p-3 text-[12.5px] leading-6 text-ink-2">
          The contract&apos;s{" "}
          <code className="font-mono text-[12px] text-ink">byHash</code> index
          is unique, so duplicate proofs for the same file hash are rejected
          within a single deployed contract.
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[14px] font-semibold text-ink">
          Platform operations at a glance
        </h3>
        <p className="mt-1 text-[12.5px] text-ink-3">
          Each operation maps directly to a real file in{" "}
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
                <th className="px-3 py-2 font-medium text-ink-3">Method</th>
              </tr>
            </thead>
            <tbody>
              {OPERATIONS.map((row, index) => (
                <tr
                  key={row.op}
                  className={`border-b border-line last:border-0 ${
                    index % 2 === 0 ? "bg-bg/50" : ""
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

      <section className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[14px] font-semibold text-ink">
          How the app flows work
        </h3>
        <div className="mt-3 grid gap-3">
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[11px] font-semibold text-ink">
              Create proof
            </div>
            <p className="mt-1 text-[12.5px] leading-6 text-ink-2">
              The browser hashes the file locally, previews the digest, and
              creates an immutable proof document on Dash Platform after login.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[11px] font-semibold text-ink">
              Verify proof
            </div>
            <p className="mt-1 text-[12.5px] leading-6 text-ink-2">
              The browser hashes the selected file again and queries the
              contract by digest to find a matching proof.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[11px] font-semibold text-ink">
              Review proof history
            </div>
            <p className="mt-1 text-[12.5px] leading-6 text-ink-2">
              The app queries proof documents by owner or chain ID and displays
              them as a timeline of immutable records.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h3 className="text-[14px] font-semibold text-ink">Reading order</h3>
        <p className="mt-1 mb-3 text-[12.5px] text-ink-3">
          Start with the Platform contract and operations, then move outward
          into session state and UI.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-[13px] leading-[1.55] text-ink-2">
          {READING_ORDER.map((file) => (
            <li key={file}>
              <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-[12px] text-ink-2">
                {file}
              </code>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
