import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { computePosition, autoUpdate, offset, flip, shift, type VirtualElement } from "@floating-ui/dom";

function currentDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = String(now.getFullYear());
  return `${day}-${month}-${year}`;
}

type CommandItem = {
  title: string;
  hint?: string;
  command: (ctx: { editor: any; range: { from: number; to: number } }) => void;
};

// Default slash commands (kept at top for easy extension)
const DEFAULT_COMMANDS: CommandItem[] = [
  {
    title: "Heading 1",
    hint: "#",
    command: ({ editor, range }) => {
      editor.chain().deleteRange(range).setNode("heading", { level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    hint: "##",
    command: ({ editor, range }) => {
      editor.chain().deleteRange(range).setNode("heading", { level: 2 }).run();
    },
  },
  {
    title: "Indent list item",
    hint: "⇥",
    command: ({ editor, range }) => {
      const didTask = editor.chain().deleteRange(range).sinkListItem("taskItem").run();
      if (!didTask) {
        editor.chain().sinkListItem("listItem").run();
      }
    },
  },
  {
    title: "Outdent list item",
    hint: "⇧⇥",
    command: ({ editor, range }) => {
      const didTask = editor.chain().deleteRange(range).liftListItem("taskItem").run();
      if (!didTask) {
        editor.chain().liftListItem("listItem").run();
      }
    },
  },
  {
    title: "Task list",
    hint: "[] ",
    command: ({ editor, range }) => {
      editor.chain().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Bullet list",
    hint: "- ",
    command: ({ editor, range }) => {
      editor.chain().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Current date",
    command: ({ editor, range }) => {
      editor.chain().deleteRange(range).insertContent(currentDate()).run();
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
        return items.filter((c) => fuzzyMatch(c.title, q)).slice(0, 5);
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
        // Translucent/blurred like Ionic headers/footers
        el.style.background = "rgba(var(--ion-background-color-rgb, 255,255,255), 0.75)";
        el.style.border = "1px solid rgba(var(--ion-text-color-rgb, 0,0,0), 0.12)";
        el.style.backdropFilter = "saturate(180%) blur(20px)";
        (el.style as any).WebkitBackdropFilter = "saturate(180%) blur(20px)";
        el.style.color = "var(--ion-text-color, #111)";
        el.style.fontSize = "12px";

        let currentItems: CommandItem[] = [];
        let currentSelectedIndex = 0;
        let currentClientRect: (() => DOMRect | null) | null = null;
        let lastProps: any = null;
        let cleanupAutoUpdate: (() => void) | null = null;
        let containerEl: HTMLElement | null = null;
        let containerWasStatic = false;
        let currentRange: { from: number; to: number } | null = null;

        const virtualReference: VirtualElement = {
          getBoundingClientRect: () => {
            const rect = currentClientRect ? currentClientRect() : null;
            return rect ?? new DOMRect(0, 0, 0, 0);
          },
        };

        const updateFloatingPosition = async () => {
          if (!currentClientRect) {
            el.style.display = "none";
            return;
          }
          const rect = currentClientRect();
          if (!rect) {
            el.style.display = "none";
            return;
          }
          el.style.display = "block";
          const { x, y } = await computePosition(virtualReference, el, {
            placement: "bottom-start",
            strategy: "absolute",
            middleware: [offset(6), flip(), shift({ padding: 8 })],
          });
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
        };

        const buildRows = () => {
          const frag = document.createDocumentFragment();
          currentItems.forEach((item, idx) => {
            const option = item;
            const row = document.createElement("div");
            row.textContent = "";
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.justifyContent = "space-between";
            row.style.gap = "8px";
            row.style.padding = "10px 12px";
            row.style.cursor = "pointer";
            row.style.borderRadius = "8px";
            row.style.userSelect = "none";
            row.style.fontSize = "14px";
            if (idx === currentSelectedIndex) {
              row.style.background = "rgba(56,128,255,0.16)";
              row.style.outline = "1px solid rgba(56,128,255,0.35)";
            }

            const left = document.createElement("div");
            left.textContent = option.title;

            const hintStr = option.hint;
            if (hintStr) {
              const right = document.createElement("div");
              right.textContent = hintStr;
              right.style.fontSize = "12px";
              right.style.opacity = "0.65";
              right.style.padding = "0 4px";
              row.appendChild(left);
              row.appendChild(right);
            } else {
              row.appendChild(left);
            }

            row.onmousedown = (e) => {
              e.preventDefault();
              if (option && lastProps?.editor && currentRange) {
                option.command({ editor: lastProps.editor, range: currentRange });
              }
            };
            frag.appendChild(row);
          });
          el.appendChild(frag);
        };

        const update = (props: any) => {
          // Merge to preserve fields like editor across partial updates
          lastProps = { ...(lastProps || {}), ...(props || {}) };
          const { items, clientRect, selectedIndex, range } = lastProps || {};
          currentItems = Array.isArray(items) ? items : [];
          currentSelectedIndex = Math.max(0, Math.min(selectedIndex ?? 0, Math.max(0, currentItems.length - 1)));
          currentClientRect = clientRect || null;
          currentRange = range || null;
          el.setAttribute("contenteditable", "false");
          el.innerHTML = "";

          if (!currentItems.length || !currentClientRect) {
            el.style.display = "none";
            return;
          }

          buildRows();
          updateFloatingPosition();
        };

        const removeAllListeners = () => {
          if (cleanupAutoUpdate) {
            cleanupAutoUpdate();
            cleanupAutoUpdate = null;
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
            cleanupAutoUpdate = autoUpdate(virtualReference, el, () => {
              if (lastProps) update(lastProps);
              updateFloatingPosition();
            });
            update(props);
          },
          onUpdate: (props: any) => {
            update(props);
          },
          onKeyDown: (props: any) => {
            const { event } = props;
            const hasItems = currentItems.length > 0;
            if (!hasItems) return false;

            const activeRange = props?.range || currentRange;
            if (activeRange) currentRange = activeRange;

            if (event.key === "ArrowDown") {
              currentSelectedIndex = (currentSelectedIndex + 1) % currentItems.length;
              if (currentClientRect) update({ items: currentItems, selectedIndex: currentSelectedIndex, clientRect: currentClientRect, range: activeRange, editor: lastProps?.editor });
              event.preventDefault();
              return true;
            }
            if (event.key === "ArrowUp") {
              currentSelectedIndex = (currentSelectedIndex - 1 + currentItems.length) % currentItems.length;
              if (currentClientRect) update({ items: currentItems, selectedIndex: currentSelectedIndex, clientRect: currentClientRect, range: activeRange, editor: lastProps?.editor });
              event.preventDefault();
              return true;
            }
            if (event.key === "Enter") {
              const index = Math.max(0, Math.min(currentSelectedIndex ?? 0, currentItems.length - 1));
              const item = currentItems[index];
              if (item && lastProps?.editor && activeRange) {
                item.command({ editor: lastProps.editor, range: activeRange });
              }
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
            currentItems = [];
            currentClientRect = null;
            if (containerEl && containerWasStatic) {
              containerEl.style.position = "";
            }
            containerEl = null;
            containerWasStatic = false;
          },
        };
      },
      command: ({ editor, range, props }: { editor: any; range: { from: number; to: number }; props: CommandItem }) => {
        try {
          if (editor?.commands?.focus) {
            editor.commands.focus();
          } else if (editor?.view?.dom) {
            (editor.view.dom as HTMLElement).focus();
          }
        } catch {}
        if (typeof props?.command === "function") {
          props.command({ editor, range });
        }
      },
    });

    return [plugin as unknown as any];
  },
});

export default SlashCommands;

