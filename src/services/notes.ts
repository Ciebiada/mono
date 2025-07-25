import { db, Note } from "./db";

export const createNewNote = async (name: string) => {
  const id = await db.notes.add({
    content: { type: "doc", content: [] },
    name,
    cursor: 0,
    lastModified: Date.now(),
    syncStatus: "pending",
  });

  return (await db.notes.get(id)) as Note;
};

export const getAllNotesSorted = async () => {
  return await db.notes.where("syncStatus").notEqual("pending-delete").reverse().sortBy("lastOpened");
};

export const findNoteByName = async (name: string) => {
  return await db.notes.where("name").equals(name).first();
};

export const getNoteById = async (noteId: number) => {
  return await db.notes.get(noteId);
};

export const updateNote = async (noteId: number, updates: Partial<Omit<Note, "id">>) => {
  await db.notes.update(noteId, updates);
};

export const deleteNote = async (noteId: Note["id"]) => {
  const note = await db.notes.get(noteId);

  if (note) {
    if (note?.dropboxId === undefined) {
      await db.notes.delete(note.id);
    } else {
      await db.notes.update(note.id, { syncStatus: "pending-delete" });
    }
  }
};
