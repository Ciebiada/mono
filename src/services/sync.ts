import { db, type Note } from "./db";
import { deleteFile, downloadFile, isDropboxInitialized, listFiles, moveFile, uploadFile } from "./dropbox";
import type { DropboxFile } from "./dropbox";
import { jsonToMarkdown, markdownToJson } from "./markdown";

let syncInProgress = false;

export const syncAll = async (refreshContent: () => void): Promise<void> => {
  if (!isDropboxInitialized()) {
    return;
  }

  if (syncInProgress) {
    return;
  }

  syncInProgress = true;

  try {
    await uploadPendingChanges();
    await makePendingRenames();
    await downloadRemoteChanges(refreshContent);
    await handleLocalDeletions();
    await handleRemoteDeletions();
  } catch (error) {
    console.error("Sync failed:", error);
  } finally {
    syncInProgress = false;
  }
};

export const renameNote = async (noteId: number, newName: string): Promise<void> => {
  await db.notes.update(noteId, {
    name: newName,
    syncStatus: "pending-rename",
  });

  const note = await db.notes.get(noteId);

  if (note && note.dropboxId) {
    await moveFile(note.dropboxId, `/${newName}.md`);

    await db.notes.update(note.id, {
      syncStatus: "synced",
      lastSyncedAt: Date.now(),
    });
  }
};

export const syncNote = async (noteId: number): Promise<void> => {
  await db.notes.update(noteId, {
    syncStatus: "pending",
  });

  const note = await db.notes.get(noteId);

  if (note) {
    await uploadNote(note);
  }
};

export const syncDeleteNote = async (noteId: number): Promise<void> => {
  const note = await db.notes.get(noteId);

  if (note) {
    await deleteRemoteNote(note);
  }
};

const handleLocalDeletions = async (): Promise<void> => {
  const pendingNotes = await db.notes.where("syncStatus").equals("pending-delete").toArray();

  for (const note of pendingNotes) {
    await deleteRemoteNote(note);
  }
};

const uploadPendingChanges = async (): Promise<void> => {
  const pendingNotes = await db.notes.where("syncStatus").equals("pending").toArray();

  for (const note of pendingNotes) {
    await uploadNote(note);
  }
};

const makePendingRenames = async (): Promise<void> => {
  const pendingNotes = await db.notes.where("syncStatus").equals("pending-rename").toArray();

  for (const note of pendingNotes) {
    if (note.dropboxId) {
      await moveFile(note.dropboxId, `/${note.name}.md`);
    }
  }
};

const uploadNote = async (note: Note): Promise<void> => {
  const markdownContent = jsonToMarkdown(note.content);

  const filename = note.dropboxId || `/${note.name}.md`;
  const response = await uploadFile(filename, markdownContent);

  await db.notes.update(note.id, {
    dropboxId: response.id,
    syncStatus: "synced",
    lastSyncedAt: Date.now(),
  });
};

const deleteRemoteNote = async (note: Note): Promise<void> => {
  if (note.dropboxId) {
    await deleteFile(note.dropboxId);
  }

  await db.notes.delete(note.id);
};

const downloadRemoteChanges = async (refreshContent: () => void): Promise<void> => {
  const remoteFiles = await listFiles();

  let updated = false;

  for (const file of remoteFiles) {
    if (file.isFolder) continue;

    updated = await syncRemoteFile(file);
  }

  if (updated) {
    await refreshContent();
  }
};

const syncRemoteFile = async (remoteFile: DropboxFile): Promise<boolean> => {
  const existingNote = await db.notes.where("dropboxId").equals(remoteFile.id).first();

  const remoteTimestamp = new Date(remoteFile.lastModified).getTime();

  if (!existingNote) {
    await downloadNewFile(remoteFile);
  } else {
    const localTimestamp = existingNote.lastModified;
    const lastSyncTimestamp = existingNote.lastSyncedAt || 0;

    // TODO: rethink conflict handling
    if (remoteTimestamp > lastSyncTimestamp) {
      if (localTimestamp > lastSyncTimestamp) {
        await handleConflict(existingNote, remoteFile);
      } else {
        await downloadFileUpdate(existingNote, remoteFile);
      }
      return true;
    }
  }

  return false;
};

const downloadNewFile = async (remoteFile: DropboxFile): Promise<void> => {
  const markdownContent = await downloadFile(remoteFile.path);
  const name = remoteFile.name.replace(".md", "");

  const content = markdownToJson(markdownContent);

  await db.notes.add({
    content,
    name,
    cursor: 0,
    lastModified: new Date(remoteFile.lastModified).getTime(),
    dropboxId: remoteFile.id,
    syncStatus: "synced",
    lastSyncedAt: Date.now(),
  });
};

const downloadFileUpdate = async (localNote: Note, remoteFile: DropboxFile): Promise<void> => {
  const markdownContent = await downloadFile(remoteFile.path);

  const content = markdownToJson(markdownContent);

  await db.notes.update(localNote.id, {
    content,
    lastModified: new Date(remoteFile.lastModified).getTime(),
    syncStatus: "synced",
    lastSyncedAt: Date.now(),
  });
};

const handleConflict = async (localNote: Note, remoteFile: DropboxFile): Promise<void> => {
  const remoteContent = await downloadFile(remoteFile.path);
  const header = `# Conflict\nLocal update: ${new Date(localNote.lastModified)}\nRemote update: ${new Date(remoteFile.lastModified)}\n---\n`;
  const remoteContentJson = markdownToJson(header + remoteContent);

  const mergedContent = {
    ...localNote.content,
    content: localNote.content.content.concat(remoteContentJson.content),
  };

  await db.notes.update(localNote.id, {
    content: mergedContent,
    lastModified: Math.max(localNote.lastModified, new Date(remoteFile.lastModified).getTime()),
    syncStatus: "synced",
    lastSyncedAt: Date.now(),
  });
};

const handleRemoteDeletions = async (): Promise<void> => {
  const syncedNotes = await db.notes.where("dropboxId").notEqual("").toArray();

  const remoteFiles = await listFiles();
  const remoteIds = new Set(remoteFiles.map((f) => f.id));

  const deletedRemotely = syncedNotes.filter((note) => note.dropboxId && !remoteIds.has(note.dropboxId));

  for (const note of deletedRemotely) {
    await db.notes.delete(note.id);
  }
};
