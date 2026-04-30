export function HowItWorks() {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <article className="rounded-[24px] border border-line bg-surface px-5 py-5 shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
          Product model
        </div>
        <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">
          Editable notes on a tutorial contract
        </h2>
        <div className="mt-4 space-y-3 text-[13px] leading-6 text-ink-2">
          <p>
            Patchbook keeps the tutorial document type name as <code>note</code>
            , then adds an optional <code>title</code> plus a required{" "}
            <code>message</code>.
          </p>
          <p>
            Each save uses document replacement, so the UI can show the current
            revision number and the Platform-provided <code>$createdAt</code>{" "}
            and <code>$updatedAt</code> timestamps.
          </p>
          <p>
            v1 does not reconstruct earlier note bodies. History here means the
            current document state plus metadata about when it was created and
            last updated.
          </p>
        </div>
      </article>

      <article className="rounded-[24px] border border-line bg-surface px-5 py-5 shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-4">
          Code map
        </div>
        <div className="mt-4 space-y-3 text-[13px] leading-6 text-ink-2">
          <p>
            <code>src/dash/contract.ts</code> defines the note schema and
            registration flow.
          </p>
          <p>
            <code>src/dash/createNote.ts</code>,{" "}
            <code>src/dash/updateNote.ts</code>, and{" "}
            <code>src/dash/deleteNote.ts</code> each wrap one Platform mutation.
          </p>
          <p>
            <code>src/dash/queries.ts</code> handles the note list and note
            detail reads, while <code>src/components/NotesWorkspace.tsx</code>{" "}
            owns the notebook UI state.
          </p>
        </div>
      </article>
    </section>
  );
}
