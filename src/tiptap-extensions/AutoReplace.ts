import { Extension, textInputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

function currentDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear());
  return `${day}-${month}-${year}`;
}

export const AutoReplace = Extension.create({
  name: "autoReplace",

  addInputRules() {
    return [];
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey("autoReplaceGhostSuggestion");

    const triggers: Record<string, () => string> = {
      today: () => `${currentDate()}`,
    };

    const createDecorations = (
      doc: any,
      pos: number,
      suggestionText: string | null
    ): DecorationSet => {
      if (!suggestionText) return DecorationSet.empty;
      const deco = Decoration.widget(pos, () => {
        const span = document.createElement("span");
        span.className = "tiptap-ghost-suggestion";
        span.textContent = suggestionText;
        return span;
      });
      return DecorationSet.create(doc, [deco]);
    };

    const getTokenBeforeCursor = (state: any): { token: string; from: number; to: number } | null => {
      const { $from } = state.selection;
      const maxLookback = 100;
      const from = Math.max(0, $from.pos - maxLookback);
      const textBefore = state.doc.textBetween(from, $from.pos, "\n", " ");
      if (!textBefore) return null;
      const match = /([A-Za-z]+)$/.exec(textBefore);
      if (!match) return null;
      const token = match[1];
      const to = $from.pos;
      const tokenFrom = to - token.length;
      return { token, from: tokenFrom, to };
    };

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: (_, { doc, selection }) => ({
            suggestion: null as string | null,
            tokenFrom: null as number | null,
            tokenTo: null as number | null,
            triggerKey: null as string | null,
            deco: DecorationSet.empty,
          }),
          apply: (tr, pluginState, _oldState, newState) => {
            const meta = tr.getMeta(pluginKey) as any;
            // Reset on explicit clear
            if (meta && meta.clear) {
              return { ...pluginState, suggestion: null, deco: DecorationSet.empty, triggerKey: null };
            }

            // Recompute on selection/doc changes
            if (tr.docChanged || tr.selectionSet || !pluginState) {
              const tokenInfo = getTokenBeforeCursor(newState);
              if (!tokenInfo) {
                return { ...pluginState, suggestion: null, deco: DecorationSet.empty, triggerKey: null };
              }

              const tokenLower = tokenInfo.token.toLowerCase();
              let suggestion: string | null = null;
              let triggerKey: string | null = null;

              if (tokenLower.length >= 3) {
                for (const key of Object.keys(triggers)) {
                  if (key.startsWith(tokenLower)) {
                    suggestion = key.slice(tokenLower.length);
                    triggerKey = key;
                    break;
                  }
                }
              }

              const pos = newState.selection.from;
              const deco = createDecorations(newState.doc, pos, suggestion);

              return {
                suggestion,
                tokenFrom: tokenInfo.from,
                tokenTo: tokenInfo.to,
                triggerKey,
                deco,
              };
            }

            return pluginState;
          },
        },
        props: {
          decorations: (state) => pluginKey.getState(state)?.deco || null,
          handleKeyDown: (view, event) => {
            if (event.key !== "Tab") return false;

            const state = pluginKey.getState(view.state) as any;
            if (!state || !state.triggerKey) return false;

            const triggerKey: string = state.triggerKey;
            const tokenFrom: number = state.tokenFrom;
            const tokenTo: number = state.tokenTo;

            const replacer = triggers[triggerKey];
            if (!replacer) return false;

            const replacementText = replacer();
            const tr = view.state.tr.replaceWith(tokenFrom, tokenTo, view.state.schema.text(replacementText));
            view.dispatch(tr);
            event.preventDefault();
            return true;
          },
        },
        // No view.update that dispatches transactions to avoid recursion
      }),
    ];
  },
});

export default AutoReplace;
