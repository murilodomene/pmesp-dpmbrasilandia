import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { Extension } from "@tiptap/core";
import DOMPurify from "isomorphic-dompurify";
import { Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, Link as LinkIcon, Rows3 } from "lucide-react";
import { useEffect, useState } from "react";

const DEFAULT_LINE_HEIGHT = "1.15";
const LINE_HEIGHTS = ["1", "1.15", "1.5", "2"] as const;

const LineHeight = Extension.create({
  name: "lineHeight",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          lineHeight: {
            default: DEFAULT_LINE_HEIGHT,
            parseHTML: (element) => element.style.lineHeight || DEFAULT_LINE_HEIGHT,
            renderHTML: (attributes) => ({
              style: `line-height: ${String(attributes.lineHeight || DEFAULT_LINE_HEIGHT)}`,
            }),
          },
        },
      },
    ];
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Habilita entrelinhas por parágrafo para os atos internos. */
  enableLineHeight?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 180, enableLineHeight = false }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false, horizontalRule: false }),
      Underline,
      TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right", "justify"] }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank", class: "text-primary underline decoration-dotted underline-offset-2" } }),
      ...(enableLineHeight ? [LineHeight] : []),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: `prose-tiptap${enableLineHeight ? " ato-editor-spacing" : ""} focus:outline-none`,
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
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-border bg-surface">
      <Toolbar editor={editor} enableLineHeight={enableLineHeight} />
      <div className="px-3 py-2 text-sm">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor, enableLineHeight }: { editor: Editor; enableLineHeight: boolean }) {
  const [lineHeight, setLineHeight] = useState(DEFAULT_LINE_HEIGHT);

  useEffect(() => {
    if (!enableLineHeight) return;
    const syncLineHeight = () => {
      const next = String(editor.getAttributes("paragraph").lineHeight || DEFAULT_LINE_HEIGHT);
      setLineHeight(LINE_HEIGHTS.includes(next as (typeof LINE_HEIGHTS)[number]) ? next : DEFAULT_LINE_HEIGHT);
    };
    syncLineHeight();
    editor.on("selectionUpdate", syncLineHeight);
    editor.on("transaction", syncLineHeight);
    return () => {
      editor.off("selectionUpdate", syncLineHeight);
      editor.off("transaction", syncLineHeight);
    };
  }, [editor, enableLineHeight]);

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
      {enableLineHeight && (
        <>
          <span className="mx-1 h-4 w-px bg-border" />
          <label className="inline-flex items-center gap-1 text-muted-foreground" title="Espaçamento entre linhas">
            <Rows3 className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Espaçamento entre linhas</span>
            <select
              aria-label="Espaçamento entre linhas"
              value={lineHeight}
              onChange={(event) => {
                const next = event.target.value;
                setLineHeight(next);
                editor.chain().focus().updateAttributes("paragraph", { lineHeight: next }).run();
              }}
              className="rounded border border-border bg-surface-2 px-1.5 py-1 text-xs text-foreground"
            >
              <option value="1">1,0</option>
              <option value="1.15">1,15</option>
              <option value="1.5">1,5</option>
              <option value="2">2,0</option>
            </select>
          </label>
        </>
      )}
      <span className="mx-1 h-4 w-px bg-border" />
      <button
        type="button"
        onClick={() => {
          const prev = (editor.getAttributes("link") as { href?: string }).href ?? "";
          const url = window.prompt("URL do link (https://...)", prev);
          if (url === null) return;
          if (url === "") { editor.chain().focus().extendMarkRange("link").unsetLink().run(); return; }
          const safe = /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
          editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
        }}
        className={btn(editor.isActive("link"))}
        aria-label="Inserir link"
      ><LinkIcon className="h-3.5 w-3.5" /></button>
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
