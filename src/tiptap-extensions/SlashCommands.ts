import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";

function currentDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear());
  return `${day}-${month}-${year}`;
}

type CommandItem = {
  title: string;
  command: (ctx: { editor: any; range: { from: number; to: number } }) => void;
};

// Default slash commands (kept at top for easy extension)
const DEFAULT_COMMANDS: CommandItem[] = [
  {
    title: "Today’s date",
    command: ({ editor, range }) => {
      editor.chain().deleteRange(range).insertContent(currentDate()).run();
    },
  },
  {
    title: "Heading 1",
    command: ({ editor, range }) => {
      editor.chain().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    command: ({ editor, range }) => {
      editor.chain().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Indent list item",
    command: ({ editor, range }) => {
      const didTask = editor.chain().deleteRange(range).sinkListItem("taskItem").run();
      if (!didTask) {
        editor.chain().sinkListItem("listItem").run();
      }
    },
  },
  {
    title: "Outdent list item",
    command: ({ editor, range }) => {
      const didTask = editor.chain().deleteRange(range).liftListItem("taskItem").run();
      if (!didTask) {
        editor.chain().liftListItem("listItem").run();
      }
    },
  },
];

type ItemsProvider = CommandItem[] | (() => CommandItem[]);

const resolveItems = (itemsOpt?: ItemsProvider): CommandItem[] => {
  const value = itemsOpt ?? DEFAULT_COMMANDS;
  return typeof value === "function" ? (value() || []) : value;
};

const fuzzyMatch = (text: string, query: string): boolean => {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  for (let qi = 0; qi < q.length; qi += 1) {
    const ch = q[qi];
    ti = t.indexOf(ch, ti);
    if (ti === -1) return false;
    ti += 1;
  }
  return true;
};

export const SlashCommands = Extension.create<{ items?: ItemsProvider }>({
  name: "slashCommands",

  addOptions() {
    return {
      // items can be an array or a function returning an array
      items: DEFAULT_COMMANDS,
    };
  },

  addProseMirrorPlugins() {
    const plugin = Suggestion({
      editor: this.editor,
      char: "/",
      allowedPrefixes: null,
      startOfLine: false,
      allow: () => true,
      items: ({ query }: { query: string }) => {
        const items = resolveItems(this.options?.items);
        const q = query || "";
        return items.filter((c) => fuzzyMatch(c.title, q));
      },
      render: () => {
        const el = document.createElement("div");
        el.className = "slash-commands";
        el.style.position = "absolute";
        el.style.zIndex = "9999";
        el.style.minWidth = "240px";
        el.style.maxHeight = "50vh";
        el.style.overflow = "auto";
        el.style.padding = "8px";
        el.style.borderRadius = "10px";
        el.style.boxShadow = "0 12px 28px rgba(0,0,0,0.28)";
        el.style.background = "var(--ion-card-background, #ffffff)";
        el.style.border = "1px solid rgba(0,0,0,0.18)";
        el.style.color = "var(--ion-text-color, #111)";
        el.style.fontSize = "12px";

        let currentItems: CommandItem[] = [];
        let currentSelectedIndex = 0;
        let currentClientRect: (() => DOMRect | null) | null = null;
        let runCommand: ((item: CommandItem) => void) | null = null;
        let containerEl: HTMLElement | null = null;
        let containerWasStatic = false;
        let lastProps: any = null;
        let rerender: (() => void) | null = null;

        const setPosition = (rect: DOMRect) => {
          const menuHeight = el.offsetHeight;
          const margin = 6;
          if (containerEl) {
            const containerRect = containerEl.getBoundingClientRect();
            const left = rect.left - containerRect.left;
            const bottomSpace = containerRect.bottom - rect.bottom;
            const openAbove = bottomSpace < menuHeight + margin;
            const topBelow = rect.bottom - containerRect.top + margin;
            const topAbove = Math.max(0, rect.top - containerRect.top - menuHeight - margin);
            el.style.left = `${left}px`;
            el.style.top = `${openAbove ? topAbove : topBelow}px`;
          } else {
            const bottomSpace = window.innerHeight - rect.bottom;
            const openAbove = bottomSpace < menuHeight + margin;
            const topBelow = rect.bottom + margin;
            const topAbove = Math.max(0, rect.top - menuHeight - margin);
            el.style.left = `${rect.left}px`;
            el.style.top = `${openAbove ? topAbove : topBelow}px`;
          }
        };

        const buildRows = () => {
          const frag = document.createDocumentFragment();
          currentItems.forEach((item, idx) => {
            const row = document.createElement("div");
            row.textContent = item.title;
            row.style.padding = "10px 12px";
            row.style.cursor = "pointer";
            row.style.borderRadius = "8px";
            row.style.userSelect = "none";
            row.style.fontSize = "14px";
            if (idx === currentSelectedIndex) {
              row.style.background = "rgba(56,128,255,0.16)";
              row.style.outline = "1px solid rgba(56,128,255,0.35)";
            }
            row.onmousedown = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const item = currentItems[idx];
              if (item && runCommand) runCommand(item);
            };
            frag.appendChild(row);
          });
          el.appendChild(frag);
        };

        const update = (props: any) => {
          lastProps = props;
          const { items, clientRect, selectedIndex } = props;
          currentItems = Array.isArray(items) ? items : [];
          currentSelectedIndex = Math.max(0, Math.min(selectedIndex ?? 0, Math.max(0, currentItems.length - 1)));
          currentClientRect = clientRect || null;
          el.setAttribute("contenteditable", "false");
          el.innerHTML = "";

          if (!currentItems.length || !currentClientRect) {
            el.style.display = "none";
            return;
          }

          const rect = currentClientRect();
          if (!rect) {
            el.style.display = "none";
            return;
          }

          el.style.display = "block";
          buildRows();
          setPosition(rect);
        };

        const removeAllListeners = () => {
          if (rerender) {
            containerEl?.removeEventListener("scroll", rerender as any);
            window.removeEventListener("scroll", rerender as any);
            window.removeEventListener("resize", rerender as any);
            rerender = null;
          }
        };

        return {
          onStart: (props: any) => {
            const editorDom: HTMLElement | null = props?.editor?.view?.dom || null;
            containerEl = editorDom ? editorDom.parentElement || editorDom : null;
            const target = containerEl || document.body;

            if (containerEl) {
              const computed = window.getComputedStyle(containerEl);
              if (computed.position === "static") {
                containerWasStatic = true;
                containerEl.style.position = "relative";
              }
            }

            target.appendChild(el);

            rerender = () => {
              if (lastProps) update(lastProps);
            };
            containerEl?.addEventListener("scroll", rerender, { passive: true } as any);
            window.addEventListener("scroll", rerender, { passive: true } as any);
            window.addEventListener("resize", rerender, { passive: true } as any);

            runCommand = (item: CommandItem) => props.command(item);
            update(props);
          },
          onUpdate: (props: any) => {
            runCommand = (item: CommandItem) => props.command(item);
            update(props);
          },
          onKeyDown: (props: any) => {
            const { event } = props;
            const hasItems = currentItems.length > 0;
            if (!hasItems) return false;

            if (event.key === "ArrowDown") {
              currentSelectedIndex = (currentSelectedIndex + 1) % currentItems.length;
              if (currentClientRect) update({ items: currentItems, selectedIndex: currentSelectedIndex, clientRect: currentClientRect });
              event.preventDefault();
              return true;
            }
            if (event.key === "ArrowUp") {
              currentSelectedIndex = (currentSelectedIndex - 1 + currentItems.length) % currentItems.length;
              if (currentClientRect) update({ items: currentItems, selectedIndex: currentSelectedIndex, clientRect: currentClientRect });
              event.preventDefault();
              return true;
            }
            if (event.key === "Enter") {
              const index = Math.max(0, Math.min(currentSelectedIndex ?? 0, currentItems.length - 1));
              const item = currentItems[index];
              if (item && runCommand) runCommand(item);
              event.preventDefault();
              return true;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              return true;
            }
            return false;
          },
          onExit: () => {
            removeAllListeners();
            el.remove();
            if (containerEl && containerWasStatic) {
              containerEl.style.position = "";
            }
            currentItems = [];
            currentClientRect = null;
            runCommand = null;
            containerEl = null;
          },
        };
      },
      command: ({ editor, range, props }: { editor: any; range: { from: number; to: number }; props: CommandItem }) => {
        if (typeof props?.command === "function") {
          props.command({ editor, range });
        }
      },
    });

    return [plugin as unknown as any];
  },
});

export default SlashCommands;

