/**
 * Sign-in screen: paste a BIP-39 mnemonic.
 *
 * The mnemonic is passed up to App.handleSignIn, which derives the identity
 * via IdentityKeyManager.create (DIP-13). The mnemonic itself never leaves
 * memory — it's not stored to localStorage and not held in component state
 * after the parent consumes it.
 */
import { useState } from "react";

interface SignInProps {
  onSignIn: (mnemonic: string) => void;
  busy: boolean;
  status: string;
}

// Static sample notes shown above the sign-in form so a learner can see
// what the UI looks like before pasting a mnemonic. Intentionally not
// fetched from the network — a live query would load the 8MB SDK
// bundle before the user has signaled any intent to use it.
const SAMPLE_NOTES = [
  {
    title: "Identity-owned data follows you",
    message:
      "Notes belong to your identity, not your device. Sign in from another browser and they're still there.",
    meta: "Updated 2 hours ago",
  },
  {
    title: "One contract, many writers",
    message:
      "Every note is stored in a shared data contract, but each identity only sees its own notes.",
    meta: "Updated yesterday",
  },
  {
    title: "Revisions prevent conflicts",
    message:
      "If two clients edit the same note, stale updates are rejected instead of overwriting newer data.",
    meta: "Updated 3 days ago",
  },
];

export function SignIn({ onSignIn, busy, status }: SignInProps) {
  const [mnemonic, setMnemonic] = useState("");

  return (
    <main className="signin">
      <p className="eyebrow">Dash Platform tutorial</p>
      <h1>Personal notes, stored on a public blockchain.</h1>
      <p className="lede">
        Sign in with a mnemonic to create, edit, and query notes stored against
        your Dash Platform testnet identity.
      </p>

      <section className="signin-card" aria-label="Sign in">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = mnemonic.trim();
            if (!trimmed) return;
            onSignIn(trimmed);
          }}
        >
          <label htmlFor="mnemonic">Mnemonic</label>
          <textarea
            id="mnemonic"
            rows={3}
            value={mnemonic}
            onChange={(event) => setMnemonic(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="word1 word2 word3 …"
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <div className="signin-actions">
            <button type="submit" disabled={busy || !mnemonic.trim()}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <a
              className="button-secondary"
              href="https://bridge.thepasta.org/"
              target="_blank"
              rel="noreferrer noopener"
            >
              Get a testnet identity
            </a>
          </div>
        </form>
        {status && (
          <p className="status" aria-live="polite">
            {status}
          </p>
        )}
      </section>

      <section className="preview" aria-label="Sample notes">
        <div className="row section-head">
          <h2>Sample notes</h2>
          <span className="badge">Preview</span>
        </div>
        <p className="hint">What your notes will look like once you sign in.</p>
        <ul className="note-list">
          {SAMPLE_NOTES.map((note) => (
            <li key={note.title} className="note-item sample">
              <div className="note-body">
                <h3 className="note-title">{note.title}</h3>
                <p className="note-message">{note.message}</p>
                <small className="note-meta">{note.meta}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <details className="about">
        <summary>About this starter app</summary>
        <p>
          The starter uses a hardcoded note contract on Dash Platform testnet,
          so you can create your first note immediately after signing in. Notes
          are owned by your identity — not the device — so they persist across
          browsers as long as you hold the mnemonic.
        </p>
        <p>
          Read the source to see how a small React app writes documents to a
          data contract and queries them back.
        </p>
      </details>

      <footer>
        <p>
          Built on{" "}
          <a
            href="https://docs.dash.org/platform"
            target="_blank"
            rel="noreferrer noopener"
          >
            Dash Platform
          </a>{" "}
          with{" "}
          <a
            href="https://www.npmjs.com/package/@dashevo/evo-sdk"
            target="_blank"
            rel="noreferrer noopener"
          >
            @dashevo/evo-sdk
          </a>
          .
        </p>
        <p>
          <a
            href="https://github.com/dashpay/platform-tutorials/tree/main/example-apps/dashnote-starter"
            target="_blank"
            rel="noreferrer noopener"
          >
            View on GitHub
          </a>
        </p>
      </footer>
    </main>
  );
}
