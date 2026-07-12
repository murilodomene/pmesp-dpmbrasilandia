import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import DOMPurify from "isomorphic-dompurify";
import { Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import { useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 180 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      Underline,
      TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right", "justify"] }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose-tiptap focus:outline-none",
        style: `min-height:${minHeight}px`,
        "data-placeholder": placeholder ?? "",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && !(value === "" && current === "<p></p>")) {
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);


  if (!editor) return null;

  return (
    <div className="rounded-md border border-border bg-surface">
      <Toolbar editor={editor} />
      <div className="px-3 py-2 text-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    `rounded p-1.5 text-xs transition ${active ? "bg-primary/20 text-primary" : "hover:bg-surface-2 text-muted-foreground"}`;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border/60 px-2 py-1">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))} aria-label="Negrito"><Bold className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))} aria-label="Itálico"><Italic className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))} aria-label="Sublinhado"><UnderlineIcon className="h-3.5 w-3.5" /></button>
      <span className="mx-1 h-4 w-px bg-border" />
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btn(editor.isActive({ textAlign: "left" }))} aria-label="Esquerda"><AlignLeft className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btn(editor.isActive({ textAlign: "center" }))} aria-label="Centro"><AlignCenter className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btn(editor.isActive({ textAlign: "right" }))} aria-label="Direita"><AlignRight className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("justify").run()} className={btn(editor.isActive({ textAlign: "justify" }))} aria-label="Justificado"><AlignJustify className="h-3.5 w-3.5" /></button>
    </div>
  );
}

/** Sanitiza HTML permitindo apenas formatação básica de texto. */
export function sanitizeAtoHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "span", "a"],
    ALLOWED_ATTR: ["style", "href", "target", "rel"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
  });
}

/** Detecta se um teor foi salvo como HTML (rich text) ou texto plano. */
export function isHtmlAto(teor: string): boolean {
  return /<\/?(p|br|strong|em|u|span|b|i|a)\b/i.test(teor);
}
