import Link from "@tiptap/extension-link";

export const NoFocusLink = Link.configure({
  HTMLAttributes: {
    target: "_blank",
    rel: "noopener noreferrer",
    onmousedown: 'event.preventDefault(); if(this.href) window.open(this.href, "_blank", "noopener,noreferrer");',
  },
});
