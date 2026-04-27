import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";

import { findAnchorByHash, type AnchorRecord } from "../dash/queries";
import { errorMessage } from "../dash/logger";
import {
  formatBytes,
  formatHashBlocks,
  formatTimestamp,
  truncateId,
} from "../lib/format";
import { bytesToHex, hashFile } from "../lib/hash";
import { useSession } from "../session/useSession";
import { OperationResultNotice } from "./OperationResultNotice";

interface VerifyPanelProps {
  contractId: string | null;
  onViewChainHistory?: (chainId: string) => void;
}

type VerifyPhase =
  | "idle"
  | "hashing"
  | "ready"
  | "checking"
  | "found"
  | "not_found"
  | "error";

export function VerifyPanel({
  contractId,
  onViewChainHistory,
}: VerifyPanelProps) {
  const session = useSession();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hashHex, setHashHex] = useState("");
  const [result, setResult] = useState<AnchorRecord | null>(null);
  const [phase, setPhase] = useState<VerifyPhase>("idle");
  const [statusText, setStatusText] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">(
    "info",
  );
  const [hashCopied, setHashCopied] = useState(false);
  const [hashing, setHashing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputId = "verify-file-input";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileSelectionRef = useRef(0);

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
    setHashHex("");
    setHashCopied(false);
    setResult(null);
    setStatusTone("info");
    setStatusText(null);
    if (!file) {
      setPhase("idle");
      return;
    }
    setPhase("hashing");
    setHashing(true);
    try {
      const digest = await hashFile(file);
      if (fileSelectionRef.current !== requestId) return;
      const nextHashHex = bytesToHex(digest);
      setHashHex(nextHashHex);
      setHashing(false);

      if (!session.sdk || !contractId) {
        setPhase("ready");
        return;
      }

      setPhase("checking");
      const match = await findAnchorByHash({
        sdk: session.sdk,
        contractId,
        entryHash: digest,
        log: session.log,
      });
      if (fileSelectionRef.current !== requestId) return;
      if (match) {
        setResult(match);
        setPhase("found");
        setStatusTone("success");
      } else {
        setPhase("not_found");
        setStatusTone("error");
      }
    } catch (err) {
      if (fileSelectionRef.current !== requestId) return;
      setPhase("error");
      setStatusTone("error");
      setStatusText(errorMessage(err));
    } finally {
      if (fileSelectionRef.current === requestId) {
        setHashing(false);
      }
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

  const statusNotice = useMemo(() => {
    switch (phase) {
      case "found":
        return {
          tone: "success" as const,
          title: "Proof found",
          body: "Dash Platform has a matching proof for this file.",
        };
      case "not_found":
        return {
          tone: "error" as const,
          title: "No matching proof found",
          body: "Dash Platform does not have a matching proof for this file hash.",
        };
      case "error":
        return {
          tone: statusTone,
          title: "Verify error",
          body: statusText ?? "Verification failed.",
        };
      default:
        return null;
    }
  }, [phase, statusText, statusTone]);

  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            Verify proof
          </div>
          <h2 className="mt-2 text-[18px] font-semibold tracking-tight text-ink">
            Verify a file against the stored proof
          </h2>
        </div>
        <div className="max-w-[240px] text-[11px] leading-5 text-ink-4">
          Verification also happens locally first: the browser hashes the file,
          then queries Platform by that digest.
        </div>
      </div>

      <div className="mt-6 space-y-5">
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
                  ? "Pick another file to re-run verification."
                  : "The file stays local while we compute its SHA-256 hash."}
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
          ) : phase === "checking" ? (
            <div className="mt-3 flex items-center gap-3 text-[13px] text-ink">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
              <span>Checking for proof…</span>
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

        {statusNotice ? (
          <OperationResultNotice tone={statusNotice.tone} title={statusNotice.title}>
            {statusNotice.body}
          </OperationResultNotice>
        ) : null}
      </div>

      {result && (
        <div className="mt-6 rounded-lg border border-line bg-bg px-5 py-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            Matching proof
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Chain
              </dt>
              <dd className="mt-1">
                <button
                  type="button"
                  onClick={() => onViewChainHistory?.(result.chainId)}
                  className="text-left text-sm font-medium text-accent transition hover:text-accent-dim"
                >
                  {result.chainId}
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Anchored at
              </dt>
              <dd className="mt-1 text-sm text-ink">
                {formatTimestamp(result.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Owner
              </dt>
              <dd className="mt-1 font-mono text-[12px] text-ink">
                {truncateId(result.ownerId, 12)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                File
              </dt>
              <dd className="mt-1 text-sm text-ink">
                {result.filename ?? selectedFile?.name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                MIME type
              </dt>
              <dd className="mt-1 text-sm text-ink">
                {result.mimeType ?? selectedFile?.type ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Size
              </dt>
              <dd className="mt-1 text-sm text-ink">
                {formatBytes(result.size ?? selectedFile?.size)}
              </dd>
            </div>
          </dl>
          {result.note && (
            <div className="mt-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                Note
              </div>
              <div className="mt-1 text-sm leading-6 text-ink">{result.note}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onViewChainHistory?.(result.chainId)}
            className="mt-5 rounded-md border border-line px-3 py-2 text-[12px] font-semibold text-ink-2 transition hover:border-accent-dim hover:text-ink"
          >
            View chain history
          </button>
        </div>
      )}
    </section>
  );
}
