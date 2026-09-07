import { useEffect, useState } from "react";
import type { NameResolver } from "../dash/resolveDpnsName";
export function DpnsName({
  identityId,
  resolver,
}: {
  identityId: string;
  resolver: NameResolver;
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
      {label?.id === identityId && label.name && (
        <span>{label.name}.dash · </span>
      )}
      <code>{identityId}</code>
    </>
  );
}
