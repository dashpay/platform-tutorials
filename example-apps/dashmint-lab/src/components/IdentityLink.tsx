import type { ReactNode } from "react";
import { identityUrl } from "../lib/explorer";
import { truncateId } from "../lib/format";

export interface IdentityLinkProps {
  identityId: string;
  className?: string;
  children?: ReactNode;
}

export function IdentityLink({
  identityId,
  className = "underline decoration-dotted underline-offset-2 hover:text-accent",
  children,
}: IdentityLinkProps) {
  return (
    <a
      href={identityUrl(identityId)}
      target="_blank"
      rel="noreferrer noopener"
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? truncateId(identityId)}
    </a>
  );
}
