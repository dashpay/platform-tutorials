import { useEffect, useState } from "react";
import type { NameResolver } from "../dash/resolveDpnsName";
export function DpnsName({
  identityId,
  resolver,
  nameOnly = false,
}: {
  identityId: string;
  resolver: NameResolver;
  nameOnly?: boolean;
}) {
  const [label, setLabel] = useState<{ id: string; name: string | null }>();
  useEffect(() => {
    let active = true;
    void resolver
      .resolve(identityId)
      .then((name) => {
        if (active) setLabel({ id: identityId, name });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [identityId, resolver]);
  return (
    <>
      {label?.id === identityId && label.name ? (
        <>
          <span title={nameOnly ? identityId : undefined}>
            {label.name}.dash
          </span>
          {!nameOnly && (
            <>
              {" · "}
              <code>{identityId}</code>
            </>
          )}
        </>
      ) : (
        <code>{identityId}</code>
      )}
    </>
  );
}
