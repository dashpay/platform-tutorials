import { Modal } from "./Modal";
import { ExampleFilesPanel } from "./ExampleFilesPanel";

interface ExampleFilesModalProps {
  open: boolean;
  onClose: () => void;
}

export function ExampleFilesModal({
  open,
  onClose,
}: ExampleFilesModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Starter Files"
      panelClassName="max-w-4xl"
    >
      <div className="py-2">
        <p className="text-[13px] leading-6 text-ink-3">
          Use these repo fixtures to seed a demo contract, verify known hashes,
          or download predictable files without keeping the examples pinned on
          every screen.
        </p>
        <div className="mt-4">
          <ExampleFilesPanel />
        </div>
      </div>
    </Modal>
  );
}
