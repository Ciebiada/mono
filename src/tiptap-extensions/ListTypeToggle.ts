import { Extension } from "@tiptap/core";
import { Fragment as ProseMirrorFragment } from "@tiptap/pm/model";
import type { Node as ProseMirrorNode, ResolvedPos } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";

const pluginKey = new PluginKey("listTypeToggle");

const findAncestorDepth = ($pos: ResolvedPos, typeName: string) => {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === typeName) {
      return depth;
    }
  }

  return null;
};

const mergeAdjacentLists = (tr: Transaction, joinPos: number, typeName: string) => {
  if (joinPos <= 0) {
    return joinPos;
  }

  const { schema } = tr.doc.type;
  const listType = schema.nodes[typeName];
  if (!listType) {
    return joinPos;
  }

  let pos = joinPos;
  let shouldContinue = true;

  while (shouldContinue) {
    shouldContinue = false;
    const $pos = tr.doc.resolve(pos);
    const current = $pos.nodeAfter;
    if (!current || current.type !== listType) {
      break;
    }

    const prev = $pos.nodeBefore;
    if (prev && prev.type === listType) {
      const prevSize = prev.nodeSize;
      tr.join(pos);
      pos -= prevSize;
      shouldContinue = true;
      continue;
    }

    const nodeEnd = pos + current.nodeSize;
    const $end = tr.doc.resolve(nodeEnd);
    const next = $end.nodeAfter;
    if (next && next.type === listType) {
      tr.join(nodeEnd);
      shouldContinue = true;
      continue;
    }
  }

  return pos;
};

const convertListItem = (
  tr: Transaction,
  listPos: number,
  itemIndex: number,
  fromListName: string,
  toListName: string,
  fromItemName: string,
  toItemName: string,
) => {
  const listNode = tr.doc.nodeAt(listPos);
  if (!listNode || listNode.type.name !== fromListName) {
    return;
  }

  if (itemIndex < 0 || itemIndex >= listNode.childCount) {
    return;
  }

  const schemaNodes = tr.doc.type.schema.nodes;
  const fromListType = schemaNodes[fromListName];
  const toListType = schemaNodes[toListName];
  const toItemType = schemaNodes[toItemName];

  if (!fromListType || !toListType || !toItemType) {
    return;
  }

  const itemNode = listNode.child(itemIndex);
  if (!itemNode || itemNode.type.name !== fromItemName) {
    return;
  }

  const beforeItems: ProseMirrorNode[] = [];
  const afterItems: ProseMirrorNode[] = [];

  for (let i = 0; i < listNode.childCount; i += 1) {
    if (i < itemIndex) {
      beforeItems.push(listNode.child(i));
    } else if (i > itemIndex) {
      afterItems.push(listNode.child(i));
    }
  }

  let convertedAttrs = itemNode.attrs;

  if (toItemName === "taskItem") {
    convertedAttrs = {
      ...itemNode.attrs,
      checked: (itemNode.attrs as typeof itemNode.attrs & { checked?: boolean }).checked ?? false,
    };
  }

  if (toItemName === "listItem") {
    const { checked: _checked, ...rest } = itemNode.attrs as typeof itemNode.attrs & { checked?: boolean };
    convertedAttrs = rest;
  }

  const convertedItem = toItemType.create(convertedAttrs, itemNode.content, itemNode.marks);

  const replacementNodes: ProseMirrorNode[] = [];

  if (beforeItems.length) {
    replacementNodes.push(
      fromListType.create(listNode.attrs, ProseMirrorFragment.fromArray(beforeItems), listNode.marks),
    );
  }

  replacementNodes.push(
    toListType.create(undefined, ProseMirrorFragment.fromArray([convertedItem])),
  );

  if (afterItems.length) {
    replacementNodes.push(
      fromListType.create(listNode.attrs, ProseMirrorFragment.fromArray(afterItems), listNode.marks),
    );
  }

  tr.replaceWith(listPos, listPos + listNode.nodeSize, ProseMirrorFragment.fromArray(replacementNodes));

  let currentPos = tr.mapping.map(listPos, -1);

  replacementNodes.forEach((node) => {
    if (!node) return;
    if (node.type.name === fromListName || node.type.name === toListName) {
      currentPos = mergeAdjacentLists(tr, currentPos, node.type.name);
    }
    const updatedNode = tr.doc.nodeAt(currentPos);
    if (!updatedNode) return;
    currentPos = tr.mapping.map(currentPos + updatedNode.nodeSize, -1);
  });
};

export const ListTypeToggle = Extension.create({
  name: "listTypeToggle",

  addProseMirrorPlugins() {
    const bulletList = this.editor.schema.nodes.bulletList;
    const taskList = this.editor.schema.nodes.taskList;
    const listItem = this.editor.schema.nodes.listItem;
    const taskItem = this.editor.schema.nodes.taskItem;
    const paragraph = this.editor.schema.nodes.paragraph;

    if (!bulletList || !taskList || !listItem || !taskItem || !paragraph) {
      return [];
    }

    return [
      new Plugin({
        key: pluginKey,
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          if (transactions.some((tr) => tr.getMeta(pluginKey)?.performed)) return null;

          const { selection } = newState;
          if (!(selection instanceof TextSelection) || !selection.empty) return null;

          const { $from } = selection;
          if ($from.parent.type !== paragraph) return null;

          const offset = $from.parentOffset;
          const textBefore = $from.parent.textBetween(0, offset, "", "");

          const tr = newState.tr;

          const bulletDepth = findAncestorDepth($from, bulletList.name);
          const taskDepth = findAncestorDepth($from, taskList.name);

          if (offset >= 3 && textBefore.endsWith("[] ") && bulletDepth !== null) {
            const listPos = $from.before(bulletDepth);
            const itemIndex = $from.index(bulletDepth);
            const paragraphStart = $from.start($from.depth);
            const originalCursor = paragraphStart + textBefore.length;
            const markerLength = 3;
            const markerStart = originalCursor - markerLength;

            tr.delete(markerStart, originalCursor);

            const mappedListPos = tr.mapping.map(listPos, -1);

            convertListItem(
              tr,
              mappedListPos,
              itemIndex,
              bulletList.name,
              taskList.name,
              listItem.name,
              taskItem.name,
            );

            const resolvedListPos = tr.doc.resolve(mappedListPos);
            const listNode = resolvedListPos.nodeAfter;
            if (!listNode) {
              tr.setMeta(pluginKey, { performed: true });
              return tr;
            }

            const firstItemPos = mappedListPos + 1;
            const mappedCursor = Math.min(
              tr.mapping.map(markerStart + 1, 1),
              firstItemPos + listNode.nodeSize - 2,
            );
            tr.setSelection(TextSelection.near(tr.doc.resolve(mappedCursor), 1));
            tr.setMeta(pluginKey, { performed: true });
            return tr;
          }

          if (offset >= 2 && textBefore.endsWith("- ") && taskDepth !== null) {
            const listPos = $from.before(taskDepth);
            const itemIndex = $from.index(taskDepth);
            const paragraphStart = $from.start($from.depth);
            const originalCursor = paragraphStart + textBefore.length;
            const markerLength = 2;
            const markerStart = originalCursor - markerLength;

            tr.delete(markerStart, originalCursor);

            const mappedListPos = tr.mapping.map(listPos, -1);

            convertListItem(
              tr,
              mappedListPos,
              itemIndex,
              taskList.name,
              bulletList.name,
              taskItem.name,
              listItem.name,
            );

            const resolvedListPos = tr.doc.resolve(mappedListPos);
            const listNode = resolvedListPos.nodeAfter;
            if (!listNode) {
              tr.setMeta(pluginKey, { performed: true });
              return tr;
            }

            const firstItemPos = mappedListPos + 1;
            const mappedCursor = Math.min(
              tr.mapping.map(markerStart + 1, 1),
              firstItemPos + listNode.nodeSize - 2,
            );
            tr.setSelection(TextSelection.near(tr.doc.resolve(mappedCursor), 1));
            tr.setMeta(pluginKey, { performed: true });
            return tr;
          }

          return null;
        },
      }),
    ];
  },
});

export default ListTypeToggle;

