import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import "./Home.css";
import { useRef, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import { EditorFooter } from "../components/EditorFooter";
import { findNoteByName, touchNote, updateNote } from "../services/notes";
import { debounce } from "../services/debounce";
import { Note } from "../services/db";

const extensions = [StarterKit, Placeholder.configure({ placeholder: "Write your note here..." })];

const saveNoteContent = debounce(async (editor: Editor, noteId: Note["id"]) => {
  const content = editor.getJSON();
  await updateNote(noteId, { content });
}, 500);

const saveNoteCursor = debounce(async (editor: Editor, noteId: Note["id"]) => {
  return await updateNote(noteId, {
    cursor: editor.state.selection.anchor,
  });
}, 500);

const saveNoteName = debounce(async (noteId: Note["id"], name: string) => {
  await updateNote(noteId, { name });
  window.history.replaceState(null, "", `/notes/${encodeURIComponent(name)}`);
}, 500);

export const Home = () => {
  const { name: nameParam } = useParams<{ name: string }>();
  const history = useHistory();
  const editor = useEditor({
    extensions,
    onSelectionUpdate: ({ editor }) => {
      const cursor = editor.view.coordsAtPos(editor.state.selection.from);

      if (contentRef.current && headerRef.current && window.visualViewport) {
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

      if (note) {
        saveNoteCursor(editor, note.id);
      }
    },
    onUpdate: ({ editor }) => {
      if (note) {
        saveNoteContent(editor, note.id);
      }
    },
  });
  const contentRef = useRef<HTMLIonContentElement>(null);
  const headerRef = useRef<HTMLIonHeaderElement>(null);
  const [viewportOffset, setViewportOffset] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [note, setNote] = useState<Note | null>(null);
  const [name, setName] = useState<Note["name"]>(nameParam);

  useEffect(() => {
    const findNote = async () => {
      const note = await findNoteByName(nameParam);

      if (note) {
        setNote(note);
        setName(note.name);
      } else {
        history.push("/error");
      }
    };

    findNote();
  }, []);

  useEffect(() => {
    if (editor && note) {
      editor
        .chain()
        .setContent(note.content, { emitUpdate: false })
        .setTextSelection(note.cursor || 0)
        .focus()
        .run();

      touchNote(note.id);
    }
  }, [editor, note]);

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

  const handleNameChange = (value: string) => {
    setName(value);
    if (note) {
      saveNoteName(note.id, value);
    }
  };

  return (
    <IonPage>
      {/* <div style={{ position: 'absolute', zIndex: 100, top: viewportOffset - 40, width: '100%', height: 40, backgroundColor: 'red' }}>
        {window?.visualViewport?.height} {window?.innerHeight}
      </div> */}
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
          </IonToolbar>
        </IonHeader>
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
      <EditorFooter editor={editor} />
    </IonPage>
  );
};
