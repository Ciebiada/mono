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
  IonRouterLink,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import ExploreContainer from "../components/ExploreContainer";
import "./Home.css";
import { search } from "ionicons/icons";
import { useRef, useEffect } from "react";

const Home: React.FC = () => {
  const modal = useRef<HTMLIonModalElement>(null);
  const searchbar = useRef<HTMLIonSearchbarElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "k") {
        event.preventDefault();
        modal.current?.present();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Blank</IonTitle>
          </IonToolbar>
        </IonHeader>
        <ExploreContainer />
      </IonContent>
      <IonFooter>
        <IonToolbar>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <IonButtons slot="primary">
              <IonButton id="open-modal">
                <IonIcon icon={search} />
              </IonButton>
              <IonModal
                ref={modal}
                trigger="open-modal"
                onDidPresent={() => {
                  searchbar.current?.setFocus();
                }}
                initialBreakpoint={0.25}
                breakpoints={[0, 0.25, 0.5, 0.75]}
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
