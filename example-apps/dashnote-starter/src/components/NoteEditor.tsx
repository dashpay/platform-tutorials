/**
 * Note create + edit form. One component, two modes: when `note` is null
 * it creates; when `note` is set it edits.
 */
import { useState } from "react";
import type { NoteRecord } from "../dash/queries";

interface NoteEditorProps {
  note: NoteRecord | null;
  busy: boolean;
  onSubmit: (title: string, message: string) => void;
  onCancel?: () => void;
}

export function NoteEditor({
  note,
  busy,
  onSubmit,
  onCancel,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [message, setMessage] = useState(note?.message ?? "");

  return (
    <form
      className="note-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (!message.trim()) return;
        onSubmit(title.trim(), message);
      }}
    >
      <h2>{note ? `Edit note` : "New note"}</h2>
      <label htmlFor="title">Title (optional)</label>
      <input
        id="title"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={120}
        disabled={busy}
      />
      <label htmlFor="message">
        Message <span className="required">*</span>
      </label>
      <textarea
        id="message"
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        required
        disabled={busy}
        aria-required="true"
      />
      <p className="hint">* Message is required.</p>
      <div className="row">
        <button type="submit" disabled={busy || !message.trim()}>
          {note ? "Save changes" : "Create note"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
