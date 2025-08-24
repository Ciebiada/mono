import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

type FoundItem = {
  depth: number;
  position: number;
  node: ProseMirrorNode;
  index: number;
};

const findCurrentMovableItem = (editor: Editor): FoundItem | null => {
  const { state } = editor;
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const nodeAtDepth = $from.node(depth);
    if (nodeAtDepth.type.name === "listItem" || nodeAtDepth.type.name === "taskItem") {
      const position = $from.before(depth);
      const node = state.doc.nodeAt(position);
      if (!node) return null;
      const index = $from.index(depth - 1);
      return { depth, position, node, index };
    }
  }

  // Fallback: handle nearest block node at any depth (e.g., paragraph, heading, codeBlock, blockquote)
  for (let depth = $from.depth; depth >= 1; depth -= 1) {
    const nodeAtDepth = $from.node(depth);
    if (nodeAtDepth.type.name === "doc") continue;
    if (nodeAtDepth.type.isBlock) {
      const position = $from.before(depth);
      const node = state.doc.nodeAt(position);
      if (node && node.type.isBlock) {
        const index = $from.index(depth - 1);
        return { depth, position, node, index };
      }
    }
  }

  return null;
};

export const MoveBlock = Extension.create({
  name: "moveBlock",

  addKeyboardShortcuts() {
    const getCommon = (editor: Editor) => {
      const found = findCurrentMovableItem(editor);
      if (!found) return null;
      const { state } = editor;
      const tr = state.tr;
      const { $from } = state.selection;
      const { depth, position, node, index } = found;
      const parent = $from.node(depth - 1);
      const parentStart = $from.start(depth - 1);
      const currentStart = position;
      const currentSize = node.nodeSize;
      const childStartAt = (childIndex: number) => {
        let start = parentStart;
        for (let i = 0; i < childIndex; i += 1) start += parent.child(i).nodeSize;
        return start;
      };
      return { tr, parent, index, currentStart, currentSize, childStartAt };
    };

    const moveUp = (editor: Editor) => {
      const common = getCommon(editor);
      if (!common) return false;
      const { tr, parent, index, currentStart, currentSize, childStartAt } = common;
      const prevIndex = index - 1;
      if (prevIndex < 0) return true;
      const prevStart = childStartAt(prevIndex);
      const prevNode = parent.child(prevIndex);
      const prevSize = prevNode.nodeSize;
      tr.delete(prevStart, prevStart + prevSize);
      const insertPos = currentStart - prevSize + currentSize;
      tr.insert(insertPos, prevNode);
      tr.setMeta("preventUpdate", true);
      editor.view.dispatch(tr);
      return true;
    };

    const moveDown = (editor: Editor) => {
      const common = getCommon(editor);
      if (!common) return false;
      const { tr, parent, index, currentStart, currentSize } = common;
      const nextIndex = index + 1;
      if (nextIndex >= parent.childCount) return true;
      const nextStart = currentStart + currentSize;
      const nextNode = parent.child(nextIndex);
      const nextSize = nextNode.nodeSize;
      tr.delete(nextStart, nextStart + nextSize);
      tr.insert(currentStart, nextNode);
      tr.setMeta("preventUpdate", true);
      editor.view.dispatch(tr);
      return true;
    };

    return {
      "Alt-ArrowUp": ({ editor }) => moveUp(editor),
      "Alt-ArrowDown": ({ editor }) => moveDown(editor),
    };
  },
});
