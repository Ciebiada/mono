type TipTapNode = {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, any>;
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
};

export type TipTapDocument = {
  type: "doc";
  content: TipTapNode[];
};

export const jsonToMarkdown = (json: TipTapDocument): string => {
  if (!json.content) return "";

  return json.content
    .map((node) => nodeToMarkdown(node))
    .join("\n")
    .trim();
};

const nodeToMarkdown = (node: TipTapNode, listDepth = 0): string => {
  switch (node.type) {
    case "paragraph":
      if (!node.content || node.content.length === 0) return "";
      const content = inlineContentToMarkdown(node.content);
      return content.trim() === "" ? "" : content;

    case "heading":
      const level = node.attrs?.level || 1;
      const headingText = node.content ? inlineContentToMarkdown(node.content) : "";
      return "#".repeat(level) + " " + headingText;

    case "bulletList":
      return node.content?.map((item) => listItemToMarkdown(item, "-", listDepth)).join("\n") || "";

    case "orderedList":
      return node.content?.map((item, index) => listItemToMarkdown(item, `${index + 1}.`, listDepth)).join("\n") || "";

    case "taskList":
      return node.content?.map((item) => taskItemToMarkdown(item, listDepth)).join("\n") || "";

    case "codeBlock":
      const language = node.attrs?.language || "";
      const codeContent = node.content?.[0]?.text || "";
      return `\`\`\`${language}\n${codeContent}\n\`\`\``;

    case "blockquote":
      return node.content?.map((child) => "> " + nodeToMarkdown(child, listDepth)).join("\n> ") || "";

    case "hardBreak":
      return "  \n";

    case "horizontalRule":
      return "---";

    default:
      return node.content?.map((child) => nodeToMarkdown(child, listDepth)).join("") || "";
  }
};

const listItemToMarkdown = (item: TipTapNode, marker: string, depth: number): string => {
  const indent = "  ".repeat(depth);
  const content = item.content?.map((child) => nodeToMarkdown(child, depth + 1)).join("\n") || "";

  const lines = content.split("\n");
  const firstLine = `${indent}${marker} ${lines[0] || ""}`;
  const restLines = lines
    .slice(1)
    .map((line) => (line ? `${indent}  ${line}` : ""))
    .join("\n");

  return restLines ? `${firstLine}\n${restLines}` : firstLine;
};

const taskItemToMarkdown = (item: TipTapNode, depth: number): string => {
  const indent = "  ".repeat(depth);
  const checked = item.attrs?.checked || false;
  const checkbox = checked ? "[x]" : "[ ]";

  const content = item.content?.map((child) => nodeToMarkdown(child, depth + 1)).join("\n") || "";

  const lines = content.split("\n");
  const firstLine = `${indent}- ${checkbox} ${lines[0] || ""}`;
  const restLines = lines
    .slice(1)
    .map((line) => (line ? `${indent}  ${line}` : ""))
    .join("\n");

  return restLines ? `${firstLine}\n${restLines}` : firstLine;
};

const inlineContentToMarkdown = (content: TipTapNode[]): string => {
  return content
    .map((node) => {
      if (node.type === "text") {
        let text = node.text || "";

        if (node.marks) {
          for (const mark of node.marks) {
            switch (mark.type) {
              case "bold":
                text = `**${text}**`;
                break;
              case "italic":
                text = `*${text}*`;
                break;
              case "code":
                text = `\`${text}\``;
                break;
              case "strike":
                text = `~~${text}~~`;
                break;
              case "link":
                const href = mark.attrs?.href || "";
                text = `[${text}](${href})`;
                break;
            }
          }
        }

        return text;
      }

      return nodeToMarkdown(node);
    })
    .join("");
};

export const markdownToJson = (markdown: string): TipTapDocument => {
  // Ensure markdown is a string
  if (typeof markdown !== "string") {
    markdown = "";
  }

  const lines = markdown.split("\n");
  const content: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Handle empty lines as empty paragraphs
    if (line.trim() === "") {
      content.push({
        type: "paragraph",
      });
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInlineContent(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Code blocks
    const codeBlockMatch = line.match(/^```(\w*)$/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1];
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !lines[i].match(/^```$/)) {
        codeLines.push(lines[i]);
        i++;
      }

      content.push({
        type: "codeBlock",
        attrs: language ? { language } : {},
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      i++; // Skip closing ```
      continue;
    }

    // Task lists
    const taskMatch = line.match(/^(\s*)- \[([ x])\]\s*(.*)$/);
    if (taskMatch) {
      const [taskList, nextIndex] = parseTaskList(lines, i);
      content.push(taskList);
      i = nextIndex;
      continue;
    }

    // Bullet lists
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bulletMatch) {
      const [bulletList, nextIndex] = parseBulletList(lines, i);
      content.push(bulletList);
      i = nextIndex;
      continue;
    }

    // Ordered lists
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const [orderedList, nextIndex] = parseOrderedList(lines, i);
      content.push(orderedList);
      i = nextIndex;
      continue;
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      const [blockquote, nextIndex] = parseBlockquote(lines, i);
      content.push(blockquote);
      i = nextIndex;
      continue;
    }

    // Horizontal rules
    if (line.match(/^(-{3,}|\*{3,}|_{3,})\s*$/)) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Regular paragraphs
    const paragraphContent = parseInlineContent(line);
    if (paragraphContent.length > 0) {
      content.push({
        type: "paragraph",
        content: paragraphContent,
      });
    }
    i++;
  }

  return { type: "doc", content };
};

const parseTaskList = (lines: string[], startIndex: number): [TipTapNode, number] => {
  const items: TipTapNode[] = [];
  let i = startIndex;

  // Get the base indentation level from the first task item
  const firstLine = lines[startIndex];
  const firstMatch = firstLine.match(/^(\s*)- \[([ x])\]\s*(.*)$/);
  if (!firstMatch) return [{ type: "taskList", content: [] }, startIndex + 1];

  const baseIndentLevel = firstMatch[1].length;

  while (i < lines.length) {
    const line = lines[i];
    const taskMatch = line.match(/^(\s*)- \[([ x])\]\s*(.*)$/);

    if (!taskMatch) break;

    const indentLevel = taskMatch[1].length;

    // If this item is less indented than our base level, we're done with this list
    if (indentLevel < baseIndentLevel) break;

    // If this item is more indented than our base level, skip it (will be handled by parent)
    if (indentLevel > baseIndentLevel) {
      i++;
      continue;
    }

    const checked = taskMatch[2] === "x";
    const text = taskMatch[3];

    const taskItem: TipTapNode = {
      type: "taskItem",
      attrs: { checked },
      content: [
        {
          type: "paragraph",
          content: parseInlineContent(text),
        },
      ],
    };

    i++;

    // Look ahead for nested content (task lists, bullet lists, etc.)
    const nestedContent: TipTapNode[] = [];

    while (i < lines.length) {
      const nextLine = lines[i];

      // Empty line - skip but continue looking for nested content
      if (nextLine.trim() === "") {
        i++;
        continue;
      }

      // Check for nested task list
      const nestedTaskMatch = nextLine.match(/^(\s*)- \[([ x])\]\s*(.*)$/);
      if (nestedTaskMatch && nestedTaskMatch[1].length > baseIndentLevel) {
        const [nestedTaskList, nextIndex] = parseTaskList(lines, i);
        nestedContent.push(nestedTaskList);
        i = nextIndex;
        continue;
      }

      // Check for nested bullet list
      const nestedBulletMatch = nextLine.match(/^(\s*)[-*+]\s+(.*)$/);
      if (nestedBulletMatch && nestedBulletMatch[1].length > baseIndentLevel) {
        const [nestedBulletList, nextIndex] = parseBulletList(lines, i);
        nestedContent.push(nestedBulletList);
        i = nextIndex;
        continue;
      }

      // Check for nested ordered list
      const nestedOrderedMatch = nextLine.match(/^(\s*)\d+\.\s+(.*)$/);
      if (nestedOrderedMatch && nestedOrderedMatch[1].length > baseIndentLevel) {
        const [nestedOrderedList, nextIndex] = parseOrderedList(lines, i);
        nestedContent.push(nestedOrderedList);
        i = nextIndex;
        continue;
      }

      // If we hit a line that's not nested content, stop looking
      break;
    }

    // Add nested content to the task item
    if (nestedContent.length > 0) {
      taskItem.content = taskItem.content!.concat(nestedContent);
    }

    items.push(taskItem);
  }

  return [{ type: "taskList", content: items }, i];
};

const parseBulletList = (lines: string[], startIndex: number): [TipTapNode, number] => {
  const items: TipTapNode[] = [];
  let i = startIndex;

  // Get the base indentation level from the first bullet item
  const firstLine = lines[startIndex];
  const firstMatch = firstLine.match(/^(\s*)[-*+]\s+(.*)$/);
  if (!firstMatch) return [{ type: "bulletList", content: [] }, startIndex + 1];

  const baseIndentLevel = firstMatch[1].length;

  while (i < lines.length) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(.*)$/);

    if (!bulletMatch) break;

    const indentLevel = bulletMatch[1].length;

    // If this item is less indented than our base level, we're done with this list
    if (indentLevel < baseIndentLevel) break;

    // If this item is more indented than our base level, skip it (will be handled by parent)
    if (indentLevel > baseIndentLevel) {
      i++;
      continue;
    }

    const text = bulletMatch[2];

    const listItem: TipTapNode = {
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: parseInlineContent(text),
        },
      ],
    };

    i++;

    // Look ahead for nested content
    const nestedContent: TipTapNode[] = [];

    while (i < lines.length) {
      const nextLine = lines[i];

      // Empty line - skip but continue looking for nested content
      if (nextLine.trim() === "") {
        i++;
        continue;
      }

      // Check for nested task list
      const nestedTaskMatch = nextLine.match(/^(\s*)- \[([ x])\]\s+(.*)$/);
      if (nestedTaskMatch && nestedTaskMatch[1].length > baseIndentLevel) {
        const [nestedTaskList, nextIndex] = parseTaskList(lines, i);
        nestedContent.push(nestedTaskList);
        i = nextIndex;
        continue;
      }

      // Check for nested bullet list
      const nestedBulletMatch = nextLine.match(/^(\s*)[-*+]\s+(.*)$/);
      if (nestedBulletMatch && nestedBulletMatch[1].length > baseIndentLevel) {
        const [nestedBulletList, nextIndex] = parseBulletList(lines, i);
        nestedContent.push(nestedBulletList);
        i = nextIndex;
        continue;
      }

      // Check for nested ordered list
      const nestedOrderedMatch = nextLine.match(/^(\s*)\d+\.\s+(.*)$/);
      if (nestedOrderedMatch && nestedOrderedMatch[1].length > baseIndentLevel) {
        const [nestedOrderedList, nextIndex] = parseOrderedList(lines, i);
        nestedContent.push(nestedOrderedList);
        i = nextIndex;
        continue;
      }

      // If we hit a line that's not nested content, stop looking
      break;
    }

    // Add nested content to the list item
    if (nestedContent.length > 0) {
      listItem.content = listItem.content!.concat(nestedContent);
    }

    items.push(listItem);
  }

  return [{ type: "bulletList", content: items }, i];
};

const parseOrderedList = (lines: string[], startIndex: number): [TipTapNode, number] => {
  const items: TipTapNode[] = [];
  let i = startIndex;

  // Get the base indentation level from the first ordered item
  const firstLine = lines[startIndex];
  const firstMatch = firstLine.match(/^(\s*)\d+\.\s+(.*)$/);
  if (!firstMatch) return [{ type: "orderedList", content: [] }, startIndex + 1];

  const baseIndentLevel = firstMatch[1].length;

  while (i < lines.length) {
    const line = lines[i];
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);

    if (!orderedMatch) break;

    const indentLevel = orderedMatch[1].length;

    // If this item is less indented than our base level, we're done with this list
    if (indentLevel < baseIndentLevel) break;

    // If this item is more indented than our base level, skip it (will be handled by parent)
    if (indentLevel > baseIndentLevel) {
      i++;
      continue;
    }

    const text = orderedMatch[2];

    const listItem: TipTapNode = {
      type: "listItem",
      content: [
        {
          type: "paragraph",
          content: parseInlineContent(text),
        },
      ],
    };

    i++;

    // Look ahead for nested content
    const nestedContent: TipTapNode[] = [];

    while (i < lines.length) {
      const nextLine = lines[i];

      // Empty line - skip but continue looking for nested content
      if (nextLine.trim() === "") {
        i++;
        continue;
      }

      // Check for nested task list
      const nestedTaskMatch = nextLine.match(/^(\s*)- \[([ x])\]\s+(.*)$/);
      if (nestedTaskMatch && nestedTaskMatch[1].length > baseIndentLevel) {
        const [nestedTaskList, nextIndex] = parseTaskList(lines, i);
        nestedContent.push(nestedTaskList);
        i = nextIndex;
        continue;
      }

      // Check for nested bullet list
      const nestedBulletMatch = nextLine.match(/^(\s*)[-*+]\s+(.*)$/);
      if (nestedBulletMatch && nestedBulletMatch[1].length > baseIndentLevel) {
        const [nestedBulletList, nextIndex] = parseBulletList(lines, i);
        nestedContent.push(nestedBulletList);
        i = nextIndex;
        continue;
      }

      // Check for nested ordered list
      const nestedOrderedMatch = nextLine.match(/^(\s*)\d+\.\s+(.*)$/);
      if (nestedOrderedMatch && nestedOrderedMatch[1].length > baseIndentLevel) {
        const [nestedOrderedList, nextIndex] = parseOrderedList(lines, i);
        nestedContent.push(nestedOrderedList);
        i = nextIndex;
        continue;
      }

      // If we hit a line that's not nested content, stop looking
      break;
    }

    // Add nested content to the list item
    if (nestedContent.length > 0) {
      listItem.content = listItem.content!.concat(nestedContent);
    }

    items.push(listItem);
  }

  return [{ type: "orderedList", content: items }, i];
};

const parseBlockquote = (lines: string[], startIndex: number): [TipTapNode, number] => {
  const content: TipTapNode[] = [];
  let i = startIndex;

  while (i < lines.length && lines[i].startsWith("> ")) {
    const text = lines[i].substring(2);
    content.push({
      type: "paragraph",
      content: parseInlineContent(text),
    });
    i++;
  }

  return [{ type: "blockquote", content }, i];
};

const parseInlineContent = (text: string): TipTapNode[] => {
  if (!text.trim()) return [];

  const nodes: TipTapNode[] = [];
  let currentIndex = 0;

  // Patterns for inline formatting (order matters - more specific first)
  const patterns = [
    { regex: /\*\*([^*]+)\*\*/g, mark: "bold" },
    { regex: /\*([^*]+)\*/g, mark: "italic" },
    { regex: /`([^`]+)`/g, mark: "code" },
    { regex: /~~([^~]+)~~/g, mark: "strike" },
    { regex: /\[([^\]]+)\]\(([^)]+)\)/g, mark: "link" },
  ];

  const matches: Array<{ start: number; end: number; text: string; mark: string; attrs?: any }> = [];

  // Find all matches
  for (const pattern of patterns) {
    let match;
    pattern.regex.lastIndex = 0; // Reset regex

    while ((match = pattern.regex.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;

      // Check if this match overlaps with existing matches
      const overlaps = matches.some((existing) => start < existing.end && end > existing.start);

      if (!overlaps) {
        if (pattern.mark === "link") {
          matches.push({
            start,
            end,
            text: match[1], // Link text
            mark: pattern.mark,
            attrs: { href: match[2] }, // Link URL
          });
        } else {
          matches.push({
            start,
            end,
            text: match[1], // Content inside formatting
            mark: pattern.mark,
          });
        }
      }
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Build nodes
  for (const match of matches) {
    // Add text before this match
    if (match.start > currentIndex) {
      const beforeText = text.substring(currentIndex, match.start);
      if (beforeText) {
        nodes.push({ type: "text", text: beforeText });
      }
    }

    // Add the formatted text
    const markObj: any = { type: match.mark };
    if (match.attrs) {
      markObj.attrs = match.attrs;
    }

    nodes.push({
      type: "text",
      text: match.text,
      marks: [markObj],
    });

    currentIndex = match.end;
  }

  // Add remaining text
  if (currentIndex < text.length) {
    const remainingText = text.substring(currentIndex);
    if (remainingText) {
      nodes.push({ type: "text", text: remainingText });
    }
  }

  // If no formatting was found, just return the plain text
  if (nodes.length === 0 && text.trim()) {
    nodes.push({ type: "text", text });
  }

  return nodes;
};

// Utility functions for easier integration
export const convertEditorToMarkdown = (editor: any): string => {
  const json = editor.getJSON();
  return jsonToMarkdown(json);
};

export const setEditorFromMarkdown = (editor: any, markdown: string): void => {
  const json = markdownToJson(markdown);
  editor.commands.setContent(json, { emitUpdate: false });
};
