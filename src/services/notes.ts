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

export const touchNote = async (noteId: number) => {
  await db.notes.update(noteId, {
    lastOpened: Date.now(),
  });
};

export const updateNote = async (noteId: number, updates: Partial<Omit<Note, "id">>) => {
  const filteredUpdates = Object.fromEntries(Object.entries(updates).filter(([_, value]) => value !== undefined));

  await db.notes.update(noteId, {
    ...filteredUpdates,
    lastModified: Date.now(),
  });
};

export const deleteNote = async (note: Note) => {
  if (note.dropboxId === undefined) {
    await db.notes.delete(note.id);
  } else {
    await db.notes.update(note.id, { syncStatus: "pending-delete" });
  }
};
