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
    </main>
  );
}
