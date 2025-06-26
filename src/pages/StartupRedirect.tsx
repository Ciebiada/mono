import { useHistory } from "react-router-dom";
import { createNewNote, getAllNotesSorted } from "../services/notes";
import { useEffect } from "react";

export const StartupRedirect = () => {
  const history = useHistory();

  useEffect(() => {
    const findOrCreateNote = async () => {
      const notes = await getAllNotesSorted();
      const note = notes[0];

      if (note) {
        return note;
      } else {
        const newNote = await createNewNote("New note");
        return newNote;
      }
    };

    const redirect = async () => {
      const note = await findOrCreateNote();
      const encodedName = encodeURIComponent(note.name);
      history.push(`/notes/${encodedName}`);
    };

    redirect();
  }, []);

  return null;
};
