import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { createAnchor } from "../dash/createAnchor";
import { errorMessage } from "../dash/logger";
import { suggestChainId } from "../lib/chainId";
import { formatBytes, formatHashBlocks, formatTimestamp } from "../lib/format";
import { bytesToHex, hashFile } from "../lib/hash";
import { useSession } from "../session/useSession";
import { OperationResultNotice } from "./OperationResultNotice";

interface AnchorFormProps {
  contractId: string | null;
  onAnchored: () => void;
  onLoginPrompt: () => void;
}

export function AnchorForm({
  contractId,
  onAnchored,
  onLoginPrompt,
}: AnchorFormProps) {
  const session = useSession();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entryHash, setEntryHash] = useState<Uint8Array | null>(null);
  const [hashHex, setHashHex] = useState("");
  const [chainId, setChainId] = useState("");
  const chainIdAutoManagedRef = useRef(true);
  const fileSelectionRef = useRef(0);
  const [note, setNote] = useState("");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">(
    "info",
  );
  const [hashCopied, setHashCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hashing, setHashing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputId = "anchor-file-input";
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setStatusText(null);
  }, [selectedFile, chainId, note]);

  const dropzoneClassName = useMemo(
    () =>
      `mt-2 rounded-lg border border-dashed bg-bg transition ${
        dragActive
          ? "border-accent bg-surface-2"
          : "border-line hover:border-accent-dim"
      }`,
    [dragActive],
  );

  async function processFile(file: File | null) {
    const requestId = fileSelectionRef.current + 1;
    fileSelectionRef.current = requestId;
    setSelectedFile(file);
    setEntryHash(null);
    setHashHex("");
    setHashCopied(false);
    if (!file) {
      if (chainIdAutoManagedRef.current) setChainId("");
      return;
    }

    setHashing(true);
    try {
      const digest = await hashFile(file);
      if (fileSelectionRef.current !== requestId) return;
      const nextHashHex = bytesToHex(digest);
      setEntryHash(digest);
      setHashHex(nextHashHex);
      if (chainIdAutoManagedRef.current) {
        setChainId(
          suggestChainId({
            filename: file.name,
            hashHex: nextHashHex,
          }),
        );
      }
      setStatusTone("info");
      setStatusText("SHA-256 computed locally in the browser.");
    } catch (err) {
      setStatusTone("error");
      setStatusText(errorMessage(err));
    } finally {
      setHashing(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    await processFile(event.target.files?.[0] ?? null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    void processFile(event.dataTransfer.files?.[0] ?? null);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragActive(false);
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openFilePicker();
  }

  async function handleCopyHash() {
    if (!hashHex || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(hashHex);
    setHashCopied(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (
      !session.sdk ||
      !session.keyManager ||
      !selectedFile ||
      !entryHash ||
      !contractId
    ) {
      return;
    }

    setSubmitting(true);
    setStatusText(null);
    try {
      await createAnchor({
        sdk: session.sdk,
        keyManager: session.keyManager,
        contractId,
        log: session.log,
        anchor: {
          entryHash,
          chainId,
          filename: selectedFile.name,
          mimeType: selectedFile.type,
          size: selectedFile.size,
          note,
        },
      });
      setStatusTone("success");
      setStatusText(
        "Proof created and anchored on Dash Platform. Duplicate hashes are rejected by design.",
      );
      onAnchored();
    } catch (err) {
      setStatusTone("error");
      setStatusText(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    session.status === "authenticated" &&
    !!session.sdk &&
    !!session.keyManager &&
    !!selectedFile &&
    !!entryHash &&
    !!contractId &&
    chainId.trim().length > 0;

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            Create proof
          </div>
          <h2 className="mt-2 text-[18px] font-semibold tracking-tight text-ink">
            Proof details
          </h2>
        </div>
        <div className="max-w-[240px] text-[11px] leading-5 text-ink-4">
          File contents stay local. Only the SHA-256 digest and metadata go to
          Dash Platform.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="block">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Select file
          </div>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            aria-label="Select file"
            onChange={handleFileChange}
            className="sr-only"
          />
          <div
            role="button"
            tabIndex={0}
            aria-label="File dropzone"
            className={dropzoneClassName}
            onClick={openFilePicker}
            onKeyDown={handleDropzoneKeyDown}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            <div className="cursor-pointer rounded-lg px-4 py-5">
              <div className="text-[13px] font-semibold text-ink">
                Drop file or click to select
              </div>
              <div className="mt-1 text-[12px] leading-5 text-ink-4">
                {selectedFile
                  ? "Replace the current file to recompute the proof."
                  : "The file stays in your browser. We only hash it locally."}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-bg px-4 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            Selected file
          </div>
          {selectedFile ? (
            <>
              <div className="mt-2 text-[14px] font-medium text-ink">
                {selectedFile.name}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-3">
                <span className="rounded-full border border-line px-2.5 py-1">
                  {formatBytes(selectedFile.size)}
                </span>
                <span className="rounded-full border border-line px-2.5 py-1">
                  {selectedFile.type || "Unknown type"}
                </span>
                <span className="rounded-full border border-line px-2.5 py-1">
                  Modified {formatTimestamp(selectedFile.lastModified)}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-2 text-[12px] leading-5 text-ink-4">
              No file selected yet.
            </div>
          )}
        </div>

        <label className="block">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Group / Chain ID
          </div>
          <input
            type="text"
            value={chainId}
            onChange={(event) => {
              const nextValue = event.target.value;
              setChainId(nextValue);
              chainIdAutoManagedRef.current = nextValue.trim().length === 0;
            }}
            placeholder="invoice-2026-04"
            className="mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
          />
          <p className="mt-2 text-[12px] leading-5 text-ink-4">
            Group related proofs (e.g. invoice-2026-04). Anyone can reuse this
            value.
          </p>
        </label>

        <div className="rounded-lg border border-line bg-bg px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              File hash (SHA-256)
            </div>
            <button
              type="button"
              onClick={() => void handleCopyHash()}
              disabled={!hashHex}
              className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink disabled:cursor-not-allowed disabled:text-ink-4"
            >
              {hashCopied ? "Copied" : "Copy hash"}
            </button>
          </div>
          {hashing ? (
            <div className="mt-3 flex items-center gap-3 text-[13px] text-ink">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
              <span>Computing hash…</span>
            </div>
          ) : (
            <>
              <div className="mt-3 whitespace-pre-wrap font-mono text-[11px] leading-6 text-ink">
                {hashHex
                  ? formatHashBlocks(hashHex)
                  : "Choose a file to compute its SHA-256 hash."}
              </div>
            </>
          )}
        </div>

        <label className="block">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
            Add context (optional)
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="mt-2 w-full rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-ink outline-none transition focus:border-accent-dim"
            placeholder="Notes about this file"
          />
        </label>

        {!contractId ? (
          <OperationResultNotice title="Contract required">
            Paste a deployed proof contract ID in Settings, or log in and
            register a new contract before anchoring.
          </OperationResultNotice>
        ) : null}

        {statusText && (
          <OperationResultNotice tone={statusTone} title="Proof status">
            {statusText}
          </OperationResultNotice>
        )}

        {session.status !== "authenticated" ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-4">
            <div className="text-[13px] font-semibold text-ink">
              Login required for submission
            </div>
            <p className="mt-2 text-[13px] leading-6 text-ink-2">
              You can still inspect the local SHA-256 preview before deciding to
              submit the proof on-chain.
            </p>
            <button
              type="button"
              onClick={onLoginPrompt}
              className="mt-4 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim"
            >
              Login to create proof
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4"
          >
            {submitting ? "Submitting…" : "Create proof"}
          </button>
        )}
      </form>
    </section>
  );
}
