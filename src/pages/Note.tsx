import { IonActionSheet, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar, useIonRouter } from "@ionic/react";
import { useRef, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { EditorFooter } from "../components/EditorFooter";
import { deleteNote, findNoteByName, getNoteById, touchNote, updateNote } from "../services/notes";
import { debounce } from "../services/debounce";
import { Note as NoteType } from "../services/db";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import "./Note.css";
import { ellipsisHorizontalCircle } from "ionicons/icons";
import TaskList from "@tiptap/extension-task-list";
import { TabHandler } from "../services/TabHandler";
import { TaskItem } from "../services/TaskItem";
import { getAuthUrl, initDropbox } from "../services/dropbox";
import { syncAll, syncNote } from "../services/sync";

const DROPBOX_CLIENT_ID = "vendb84lzmnzbq9";
const DROPBOX_REDIRECT_PATH = "oauth-callback";

initDropbox(DROPBOX_CLIENT_ID, DROPBOX_REDIRECT_PATH);

const extensions = [
  StarterKit,
  TaskList,
  TaskItem.configure({ nested: true }),
  TabHandler,
];

const saveNoteName = debounce(async (noteId: NoteType["id"], name: string) => {
  await updateNote(noteId, { name });
  window.history.replaceState(null, "", `/notes/${encodeURIComponent(name)}`);
}, 500);

const saveNoteContent = debounce(async (editor: Editor, noteId: NoteType["id"]) => {
  const content = editor.getJSON()
  await updateNote(noteId, { content, lastModified: Date.now() });
  await syncNote(noteId);
}, 500);

const saveNoteCursor = debounce(async (editor: Editor, noteId: NoteType["id"]) => {
  return await updateNote(noteId, {
    cursor: editor.state.selection.anchor,
  });
}, 500);

export const Note = () => {
  const history = useHistory();
  const { name: nameParam } = useParams<{ name: string }>();
  const contentRef = useRef<HTMLIonContentElement>(null);
  const headerRef = useRef<HTMLIonHeaderElement>(null);
  const [noteId, setNoteId] = useState<NoteType['id']>();
  const [name, setName] = useState<NoteType["name"]>(nameParam);
  const [viewportOffset, setViewportOffset] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const editor = useEditor({
    extensions,
    onSelectionUpdate: ({ editor, transaction }) => {
      // Keep cursor in view
      if (contentRef.current && headerRef.current && window.visualViewport) {
        const cursor = editor.view.coordsAtPos(editor.state.selection.from);
        const visualViewportHeight = window.visualViewport.height;
        const bottomMargin = visualViewportHeight * 0.2;
        if (cursor.top > visualViewportHeight - bottomMargin) {
          const scrollAmount = cursor.top - (visualViewportHeight - bottomMargin);
          contentRef.current?.scrollByPoint(0, scrollAmount, 100);
        } else if (cursor.top < headerRef.current.clientHeight) {
          const scrollAmount = headerRef.current.clientHeight - cursor.top;
          contentRef.current?.scrollByPoint(0, -scrollAmount, 100);
        }
      }

      if (noteId && !transaction.getMeta('preventUpdate')) {
        saveNoteCursor(editor, noteId);
      }
    },
    onUpdate: ({ editor }) => {
      if (noteId) {
        saveNoteContent(editor, noteId);
      }
    },
  });

  useEffect(() => {
    const getNote = async () => {
      const foundNote = await findNoteByName(nameParam);

      if (foundNote) {
        setNoteId(foundNote.id);
        setName(foundNote.name);
        touchNote(foundNote.id);
      } else {
        history.push("/error");
      }
    };

    getNote();
  }, []);

  useEffect(() => {
    if (editor && noteId) {
      const setContent = async () => {
        const note = await getNoteById(noteId);
        if (note) {
          editor
            .chain()
            .setContent(note.content, { emitUpdate: false })
            .setTextSelection(note.cursor || 0)
            .focus()
            .run();
        }
      }

      setContent();
      syncAll(setContent);
    }
  }, [editor, noteId]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (noteId) {
      saveNoteName(noteId, value);
    }
  };

  // TODO: extract to a keyboard hook
  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        setViewportOffset(window.visualViewport.height + window.visualViewport.offsetTop);
        setIsKeyboardOpen(window.visualViewport.height / window.innerHeight < 0.75);
        setKeyboardHeight(window.innerHeight - window.visualViewport.height);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange);
      window.visualViewport?.addEventListener("scroll", handleViewportChange);
      window.addEventListener("touchmove", handleViewportChange);

      handleViewportChange();

      return () => {
        window.visualViewport?.removeEventListener("resize", handleViewportChange);
        window.visualViewport?.removeEventListener("scroll", handleViewportChange);
        window.removeEventListener("touchmove", handleViewportChange);
      };
    }
  }, []);

  return (
    <IonPage>
      <IonHeader ref={headerRef} translucent>
        <IonToolbar>
          <IonTitle>
            <input
              type="text"
              placeholder="Note name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </IonTitle>
          <IonButtons collapse={true} slot="end">
            <IonButton onClick={() => setShowMenu(true)}>
              <IonIcon slot="icon-only" icon={ellipsisHorizontalCircle} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent ref={contentRef} fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">
              <input
                type="text"
                placeholder="Note name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </IonTitle>
            <IonButtons collapse={true} slot="end">
              <IonButton onClick={() => setShowMenu(true)}>
                <IonIcon slot="icon-only" icon={ellipsisHorizontalCircle} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonActionSheet
          isOpen={showMenu}
          onDidDismiss={() => {
            setShowMenu(false);
          }}
          header="Note actions"
          buttons={[
            {
              text: "Connect Dropbox",
              handler: async () => {
                const redirect = async () => {
                  window.location.href = await getAuthUrl();
                }
                return redirect();
              }
            },
            {
              text: "Delete",
              role: "destructive",
              handler: () => {
                const deleteAndWait = async () => {
                  if (noteId) {
                    await deleteNote(noteId);
                    history.push("/");
                  }
                }
                deleteAndWait();
              },
            },
            {
              text: "Cancel",
              role: "cancel",
            },
          ]}
        />
        <div
          className="ion-padding"
          style={
            {
              "--tiptap-padding-bottom": `${keyboardHeight + 100}px`,
            } as React.CSSProperties
          }
        >
          <EditorContent editor={editor} />
        </div>
      </IonContent>
      {editor && <EditorFooter currentNoteId={noteId} editor={editor} />}
    </IonPage>
  );
};
