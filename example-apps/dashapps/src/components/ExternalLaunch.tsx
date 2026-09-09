import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ExternalLaunch({
  url,
  verified,
  className,
  children,
}: {
  url: string;
  verified: boolean;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  let destination: URL | undefined;
  try {
    destination = new URL(url);
  } catch {
    // Invalid community data is displayed but never opened.
  }
  const safeUrl =
    destination?.protocol === "https:" ? destination.href : undefined;

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", close, true);
    return () => document.removeEventListener("keydown", close, true);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            className="external-launch-backdrop"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => {
              event.stopPropagation();
              if (event.currentTarget === event.target) setOpen(false);
            }}
          >
            <section
              className="external-launch-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <p className="eyebrow">LEAVING DASHAPPS</p>
              <h2 id={titleId}>Continue to another site?</h2>
              <div
                className={`external-launch-trust ${verified ? "verified" : "community"}`}
              >
                <strong>
                  {verified ? "Contract-owner link" : "Community link"}
                </strong>
                <p>
                  {verified
                    ? "This URL was submitted by the app contract owner."
                    : "This URL was submitted by a community member and was not verified by the app contract owner."}
                </p>
              </div>
              <p>DashApps does not control or endorse the destination.</p>
              {destination?.hostname && (
                <strong className="external-launch-host">
                  {destination.hostname}
                </strong>
              )}
              <code className="external-launch-url">{url}</code>
              {!safeUrl && (
                <p className="error" role="alert">
                  This destination is blocked because it is not a valid HTTPS
                  URL.
                </p>
              )}
              <div className="external-launch-actions">
                <button type="button" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                {safeUrl && (
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                  >
                    Continue ↗
                  </a>
                )}
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
