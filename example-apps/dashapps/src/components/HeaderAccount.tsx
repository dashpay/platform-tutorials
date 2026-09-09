import { useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "../session/useSession";
import { SignInForm } from "./SignInForm";

export function HeaderAccount() {
  const session = useSession();
  const [signingIn, setSigningIn] = useState(false);
  if (session.identityId) {
    const label = session.identityName
      ? `${session.identityName}.dash`
      : `${session.identityId.slice(0, 6)}…${session.identityId.slice(-4)}`;
    return (
      <div className="header-account" aria-label="Account controls">
        <span title={session.identityId}>{label}</span>
        <button type="button" onClick={session.logout}>
          Sign out
        </button>
      </div>
    );
  }
  return (
    <>
      <div className="header-account" aria-label="Account controls">
        <button
          type="button"
          disabled={session.network !== "testnet" || !session.connection}
          title={
            session.network === "mainnet"
              ? "Switch to testnet to sign in"
              : undefined
          }
          onClick={() => setSigningIn(true)}
        >
          Sign in
        </button>
      </div>
      {signingIn &&
        createPortal(
          <div
            className="external-launch-backdrop header-signin-backdrop"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setSigningIn(false);
            }}
          >
            <div className="header-signin-dialog">
              <SignInForm onClose={() => setSigningIn(false)} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
