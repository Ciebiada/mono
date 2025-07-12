import { useHistory, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { handleAuthCallback } from "../services/dropbox";

export const OAuthCallback = () => {
  const history = useHistory();
  const location = useLocation();
  const code = new URLSearchParams(location.search).get('code');

  useEffect(() => {
    const redirect = async () => {
      if (code) {
        try {
          const success = await handleAuthCallback(code);
          if (success) {
            // TODO: should sync here?
            console.log("Dropbox connected successfully");
          } else {
            console.error("Failed to handle OAuth callback");
          }
        } catch (error) {
          console.error("Error during OAuth callback:", error);
        }
      }

      history.replace("/");
    };

    redirect();
  }, [code, history]);

  return null;
};
