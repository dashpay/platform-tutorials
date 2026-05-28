/**
 * List of notes with edit/delete buttons.
 */
import type { NoteRecord } from "../dash/queries";

interface NoteListProps {
  notes: NoteRecord[];
  onEdit: (note: NoteRecord) => void;
  onDelete: (noteId: string) => void;
  disabled: boolean;
}

function formatTimestamp(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString();
}

export function NoteList({ notes, onEdit, onDelete, disabled }: NoteListProps) {
  if (notes.length === 0) {
    return <p className="empty">No notes yet. Create one above.</p>;
  }

  return (
    <ul className="note-list">
      {notes.map((note) => (
        <li key={note.id} className="note-item">
          <div className="note-body">
            <h3>{note.title?.trim() || "(no title)"}</h3>
            <p>{note.message}</p>
            <small>
              Updated {formatTimestamp(note.updatedAt)} · rev {note.revision}
            </small>
          </div>
          <div className="row">
            <button
              type="button"
              onClick={() => onEdit(note)}
              disabled={disabled}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              disabled={disabled}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
