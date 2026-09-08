export function ProvenanceIcon() {
  return (
    <span
      className="provenance-icon"
      title="Metadata provided by the contract owner"
      aria-label="Metadata provided by the contract owner"
      role="img"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 1.75 12 3l2.36-.06.67 2.27 1.94 1.34-.78 2.22.78 2.22-1.94 1.34-.67 2.27L12 14.55 10 15.8l-2-1.25-2.36.05-.67-2.27-1.94-1.34.78-2.22-.78-2.22 1.94-1.34.67-2.27L8 3l2-1.25Z" />
        <path className="provenance-check" d="m6.7 8.9 2.05 2.05 4.45-4.4" />
      </svg>
    </span>
  );
}
