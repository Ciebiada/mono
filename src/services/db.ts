import Dexie, { type EntityTable } from "dexie";
import type { TipTapDocument } from "./markdown";

export type Note = {
  id: number;
  content: TipTapDocument;
  name: string;
  cursor: number;
  lastModified: number;
  lastOpened?: number;
  dropboxId?: string;
  syncStatus?: "pending" | "synced" | "pending-delete" | "pending-rename";
  lastSyncedAt?: number;
};

export const db = new Dexie("Mono") as Dexie & {
  notes: EntityTable<Note, "id">;
};

db.version(1).stores({
  notes:
    "++id, content, name, cursor, lastModified, lastOpened, dropboxId, syncStatus, lastSyncedAt",
});

db.version(2).stores({
  notes:
    "++id, content, &name, cursor, lastModified, lastOpened, dropboxId, syncStatus, lastSyncedAt",
});
