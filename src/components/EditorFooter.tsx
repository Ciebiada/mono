import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSearchbar,
  IonToolbar,
  useIonRouter,
} from "@ionic/react";
import { search, add } from "ionicons/icons";
import { useEffect, useRef, useState } from "react";
import { getAllNotesSorted, createNewNote, findNoteByName } from "../services/notes";
import { Note } from "../services/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Editor } from "@tiptap/react";

type EditorFooterProps = {
  currentNoteId?: number;
  editor: Editor;
};

const fuzzySearch = (query: string, text: string): number => {
  if (!query) return 1;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match gets highest score
  if (textLower.includes(queryLower)) {
    return 2;
  }

  // Fuzzy match
  let queryIndex = 0;
  let score = 0;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      score++;
      queryIndex++;
    }
  }

  return queryIndex === queryLower.length ? score / query.length : 0;
};

export const EditorFooter = ({ currentNoteId, editor }: EditorFooterProps) => {
  const searchbar = useRef<HTMLIonSearchbarElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalRef = useRef<HTMLIonModalElement>(null);

  const router = useIonRouter();

  const notes = useLiveQuery(async () => {
    return getAllNotesSorted();
  });

  const filteredNotes = notes
    ? notes
        .filter((note) => note.id !== currentNoteId)
        .map((note) => ({
          ...note,
          score: fuzzySearch(searchQuery, note.name),
        }))
        .filter((note) => note.score > 0)
        .sort((a, b) => b.score - a.score)
    : [];

  const showCreateOption =
    searchQuery.trim() && !filteredNotes.some((note) => note.name.toLowerCase() === searchQuery.toLowerCase());

  const totalOptions = filteredNotes.length + (showCreateOption ? 1 : 0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSearchKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalOptions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelection();
    }
  };

  const handleSelection = async () => {
    if (totalOptions === 0) return;

    setIsModalOpen(false);

    if (showCreateOption && selectedIndex === filteredNotes.length) {
      const noteName = searchQuery.trim();
      const existingNote = await findNoteByName(noteName);
      if (!existingNote) {
        await createNewNote(noteName);
      }
      router.push(`/notes/${encodeURIComponent(noteName)}`, "root", "push", { unmount: true });
    } else if (filteredNotes[selectedIndex]) {
      const note = filteredNotes[selectedIndex];
      router.push(`/notes/${encodeURIComponent(note.name)}`, "root", "push", { unmount: true });
    }
  };

  const handleItemClick = async (note: Note) => {
    await modalRef.current?.dismiss();
    setIsModalOpen(false);
    router.push(`/notes/${encodeURIComponent(note.name)}`, "root", "push", { unmount: true });
  };

  const handleCreateClick = async () => {
    setIsModalOpen(false);

    const noteName = searchQuery.trim();
    const existingNote = await findNoteByName(noteName);
    if (!existingNote) {
      const newNote = await createNewNote(noteName);
      router.push(`/notes/${encodeURIComponent(newNote.name)}`, "root", "push", { unmount: true });
    }
  };

  return editor && (
    <IonFooter translucent>
      <IonToolbar>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <IonButtons slot="primary">
            <IonButton onClick={() => setIsModalOpen(true)}>
              <IonIcon icon={search} />
            </IonButton>
            <IonModal
              ref={modalRef}
              isOpen={isModalOpen}
              onDidDismiss={() => {
                editor.commands.focus();
                setIsModalOpen(false);
                setSearchQuery("");
                setSelectedIndex(0);
              }}
              onDidPresent={() => {
                searchbar.current?.setFocus();
              }}
              initialBreakpoint={0.3}
              breakpoints={[0.3, 0.6]}
            >
              <IonContent className="ion-padding">
                <IonSearchbar
                  ref={searchbar}
                  inputmode="search"
                  value={searchQuery}
                  onIonInput={(e) => setSearchQuery(e.detail.value!)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search notes or create new..."
                />
                <IonList>
                  {filteredNotes.map((note, index) => (
                    <IonItem
                      key={note.id}
                      button
                      onClick={() => handleItemClick(note)}
                      color={index === selectedIndex ? "light" : undefined}
                    >
                      <IonLabel>
                        <h2>{note.name}</h2>
                        <p>Last modified: {new Date(note.lastModified).toLocaleDateString()}</p>
                      </IonLabel>
                    </IonItem>
                  ))}
                  {showCreateOption && (
                    <IonItem
                      button
                      onClick={handleCreateClick}
                      color={selectedIndex === filteredNotes.length ? "light" : undefined}
                    >
                      <IonIcon icon={add} slot="start" />
                      <IonLabel>
                        <h2>Create "{searchQuery.trim()}"</h2>
                        <p>Create a new note</p>
                      </IonLabel>
                    </IonItem>
                  )}
                  {totalOptions === 0 && searchQuery && (
                    <IonItem>
                      <IonLabel>
                        <p>No notes found</p>
                      </IonLabel>
                    </IonItem>
                  )}
                </IonList>
              </IonContent>
            </IonModal>
          </IonButtons>
        </div>
      </IonToolbar>
    </IonFooter>
  );
};
