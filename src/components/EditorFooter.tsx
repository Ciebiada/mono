import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSearchbar,
  IonToolbar,
} from "@ionic/react";
import { search } from "ionicons/icons";
import { useEffect, useRef } from "react";
import { Editor } from "@tiptap/react";

type EditorFooterProps = {
  editor: Editor;
};

export const EditorFooter = ({ editor }: EditorFooterProps) => {
  const modal = useRef<HTMLIonModalElement>(null);
  const searchbar = useRef<HTMLIonSearchbarElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        modal.current?.present();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
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
                <IonSearchbar ref={searchbar} placeholder="Search"></IonSearchbar>
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
  );
};
