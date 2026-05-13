import { Modal } from "./Modal";

export interface DeleteNoteModalProps {
  open: boolean;
  noteTitle: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteNoteModal({
  open,
  noteTitle,
  deleting,
  onCancel,
  onConfirm,
}: DeleteNoteModalProps) {
  const trimmed = noteTitle.trim();
  const subject = trimmed ? `“${trimmed}”` : "this note";

  return (
    <Modal
      open={open}
      title="Delete note"
      onClose={() => {
        if (!deleting) onCancel();
      }}
      footer={
        <>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-md bg-[color:var(--color-danger)] px-4 py-2 text-[13px] font-semibold text-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md border border-line bg-transparent px-4 py-2 text-[13px] font-semibold text-ink-3 transition hover:border-line-2 hover:text-ink-2 disabled:cursor-not-allowed disabled:text-ink-4"
          >
            Cancel
          </button>
        </>
      }
    >
      <p className="text-[13px] leading-6 text-ink-2">
        Permanently delete {subject} from Dash Platform? This can&apos;t be
        undone.
      </p>
    </Modal>
  );
}
