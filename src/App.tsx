import { BrowserRouter, Redirect, Route, Router } from "react-router-dom";
import { IonApp, IonRouterOutlet, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { ErrorPage } from "./pages/Error";
import { Note } from "./pages/Note";
import { LastOpenedNote } from "./pages/LastOpenedNote";
import { OAuthCallback } from "./pages/OAuthCallback";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils that can be commented out */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import "@ionic/react/css/palettes/dark.system.css";

/* Theme variables */
import "./theme/variables.css";

setupIonicReact();

export const App = () => (
  <IonApp>
    <IonReactRouter basename="/mono">
      <IonRouterOutlet>
        <Route path="/notes/:name" component={Note} />
        <Route exact path="/" component={LastOpenedNote} />
        <Route path="/oauth-callback" component={OAuthCallback} />
        <Route path="/error">
          <ErrorPage />
        </Route>
      </IonRouterOutlet>
    </IonReactRouter>
  </IonApp>
);
