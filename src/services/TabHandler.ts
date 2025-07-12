import { Extension } from "@tiptap/core";

const TAB = "    ";

export const TabHandler = Extension.create({
  name: "tabHandler",
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
          editor.commands.sinkListItem("listItem");
          return true;
        } else if (editor.isActive("taskList")) {
          editor.commands.sinkListItem("taskItem");
          return true;
        }

        editor
          .chain()
          .command(({ tr }) => {
            tr.insertText(TAB);
            return true;
          })
          .run();

        return true;
      },
      "Shift-Tab": ({ editor }) => {
        const { selection, doc } = editor.state;
        const { $from } = selection;
        const pos = $from.pos;

        if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
          editor.commands.liftListItem("listItem");
          return true;
        } else if (editor.isActive("taskList")) {
          editor.commands.liftListItem("taskItem");
          return true;
        }

        if (doc.textBetween(pos - TAB.length, pos) === TAB) {
          editor
            .chain()
            .command(({ tr }) => {
              tr.delete(pos - TAB.length, pos);
              return true;
            })
            .run();
          return true;
        }

        return true;
      },
    };
  },
});
