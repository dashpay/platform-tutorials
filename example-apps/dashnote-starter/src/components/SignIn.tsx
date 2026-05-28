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
    title: "Shopping list",
    message: "Coffee beans, oat milk, sourdough.",
    meta: "Updated 2 hours ago",
  },
  {
    title: "Reading queue",
    message: "Finish chapter 4 of the Dash Platform overview.",
    meta: "Updated yesterday",
  },
  {
    title: "(no title)",
    message: "Remember: notes are owned by the identity, not the device.",
    meta: "Updated 3 days ago",
  },
];

export function SignIn({ onSignIn, busy, status }: SignInProps) {
  const [mnemonic, setMnemonic] = useState("");

  return (
    <main className="signin">
      <h1>Dashnote Starter</h1>
      <p>
        Paste a BIP-39 mnemonic for a funded testnet identity. The starter uses
        a hardcoded note contract on testnet so you can create your first note
        immediately.
      </p>
      <p>
        Don't have one yet?{" "}
        <a
          href="https://bridge.thepasta.org/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Use Dash Bridge
        </a>{" "}
        to generate a mnemonic and register a funded testnet identity in one
        flow.
      </p>
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
          placeholder="word1 word2 word3 …"
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !mnemonic.trim()}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {status && (
        <p className="status" aria-live="polite">
          {status}
        </p>
      )}

      <section className="preview" aria-label="Sample notes">
        <h2>Sample notes</h2>
        <p className="hint">
          A preview of what your notes will look like once you sign in.
        </p>
        <ul className="note-list">
          {SAMPLE_NOTES.map((note) => (
            <li key={note.title} className="note-item">
              <div className="note-body">
                <h3 className="note-title">{note.title}</h3>
                <p className="note-message">{note.message}</p>
                <small className="note-meta">{note.meta}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

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
