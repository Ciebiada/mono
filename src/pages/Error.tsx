import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonIcon } from "@ionic/react";
import { alertCircleOutline, homeOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";

type ErrorPageProps = {
  title?: string;
  message?: string;
};

export const ErrorPage = ({
  title = "Something went wrong",
  message = "We're sorry, but something unexpected happened.",
}: ErrorPageProps) => {
  const history = useHistory();

  const handleGoHome = () => {
    history.push("/");
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Error</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div
          className="ion-padding"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            textAlign: "center",
          }}
        >
          <IonIcon
            icon={alertCircleOutline}
            style={{
              fontSize: "64px",
              color: "var(--ion-color-danger)",
              marginBottom: "24px",
            }}
          />
          <h2>{title}</h2>
          <p
            style={{
              color: "var(--ion-color-medium)",
              marginBottom: "32px",
              maxWidth: "300px",
            }}
          >
            {message}
          </p>
          <IonButton fill="solid" onClick={handleGoHome} style={{ marginTop: "16px" }}>
            <IonIcon icon={homeOutline} slot="start" />
            Go Home
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};
