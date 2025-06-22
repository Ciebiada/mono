import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import "./Home.css";
import { search } from "ionicons/icons";
import { useRef, useEffect, useState } from "react";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";

const extensions = [
  StarterKit,
  Placeholder.configure({ placeholder: "Write your note here..." }),
];

const Home: React.FC = () => {
  const editor = useEditor({
    extensions,
    onSelectionUpdate: ({ editor }) => {
      const { selection } = editor.state;

      const cursor = editor.view.coordsAtPos(selection.from);

      if (contentRef.current && window.visualViewport) {
          const visualViewportHeight = window.visualViewport.height;
          const margin = visualViewportHeight * 0.2;
          if (cursor.top > visualViewportHeight - margin) {
            const scrollAmount = cursor.top - (visualViewportHeight - margin);
            contentRef.current?.scrollByPoint(0, scrollAmount, 100);
          }
        }
      }
    })

  const modal = useRef<HTMLIonModalElement>(null);
  const searchbar = useRef<HTMLIonSearchbarElement>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const [ viewportOffset, setViewportOffset ] = useState(0);
  const [ isKeyboardOpen, setIsKeyboardOpen ] = useState(false);
  const [ keyboardHeight, setKeyboardHeight ] = useState(0);

  useEffect(() => {
    editor?.commands.focus();
  }, [editor]);

  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        setViewportOffset(window.visualViewport.height + window.visualViewport.offsetTop);
        setIsKeyboardOpen(window.visualViewport.height / window.innerHeight < 0.75);
        setKeyboardHeight(window.innerHeight - window.visualViewport.height);
       }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport?.addEventListener('scroll', handleViewportChange);
      window.addEventListener('touchmove', handleViewportChange);

      handleViewportChange();

      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        window.visualViewport?.removeEventListener('scroll', handleViewportChange);
        window.removeEventListener('touchmove', handleViewportChange);
      };
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "k") {
        event.preventDefault();
        modal.current?.present();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <IonPage>
      {/* <div style={{ position: 'absolute', zIndex: 100, top: viewportOffset - 40, width: '100%', height: 40, backgroundColor: 'red' }}>
        {window?.visualViewport?.height} {window?.innerHeight}
      </div> */}
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>Untitled</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent ref={contentRef} fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Untitled</IonTitle>
          </IonToolbar>
        </IonHeader>
        <div
          className="ion-padding"
          style={{
            '--tiptap-padding-bottom': `${keyboardHeight + 100}px`
          } as React.CSSProperties}
        >
          <EditorContent editor={editor} />
        </div>
      </IonContent>
      <IonFooter translucent>
        <IonToolbar>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <IonButtons slot="primary">
              <IonButton id="open-modal">
                <IonIcon icon={search} />
              </IonButton>
              <IonModal
                ref={modal}
                trigger="open-modal"
                onDidDismiss={() => {
                  editor?.commands.focus();
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
                    placeholder="Search"
                  ></IonSearchbar>
                  <IonList>
                    <IonItem>
                      <IonAvatar slot="start">
                        <IonImg src="https://i.pravatar.cc/300?u=b" />
                      </IonAvatar>
                      <IonLabel>
                        <h2>Connor Smith</h2>
                        <p>Sales Rep</p>
                      </IonLabel>
                    </IonItem>
                  </IonList>
                </IonContent>
              </IonModal>
            </IonButtons>
          </div>
        </IonToolbar>
      </IonFooter>
    </IonPage>
  );
};

export default Home;
