/**
 * Sort button for the collection view.
 */

interface CollectionToolbarProps {
  sortLabel: string;
  onSortClick: () => void;
}

export function CollectionToolbar({
  sortLabel,
  onSortClick,
}: CollectionToolbarProps) {
  return (
    <button
      type="button"
      onClick={onSortClick}
      className="h-7 rounded-md border border-line bg-surface px-2.5 text-[11.5px] font-medium text-ink-2 transition hover:border-line-2"
    >
      Sort: {sortLabel}
    </button>
  );
}

export function RefreshSpinner() {
  return (
    <span
      aria-label="Refreshing"
      role="status"
      className="inline-block h-3 w-3 animate-spin rounded-full border border-ink-4 border-t-transparent"
    />
  );
}
