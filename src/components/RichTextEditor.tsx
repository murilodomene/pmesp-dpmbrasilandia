import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { Extension } from "@tiptap/core";
import DOMPurify from "isomorphic-dompurify";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Rows3,
  IndentIncrease,
  RemoveFormatting,
  Undo2,
  Redo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEFAULT_LINE_HEIGHT = "1.15";
const LINE_HEIGHTS = ["1", "1.15", "1.5", "2"] as const;
/** Recuo de primeira linha usado pelo botão "Recuo" e pela tecla Tab. */
export const RECUO_PADRAO = "1.25cm";

/** Aproxima qualquer entrelinha (1.38, "150%", "normal"…) de uma das opções do editor. */
export function normalizarEntrelinha(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim().toLowerCase();
  if (!v || v === "normal" || v === "inherit") return null;
  let n: number;
  if (v.endsWith("%")) n = parseFloat(v) / 100;
  else if (/^[\d.]+$/.test(v)) n = parseFloat(v);
  else return null; // pt/px dependem do tamanho da fonte: ignora
  if (!Number.isFinite(n) || n <= 0) return null;
  // Google Docs exporta 1,15 como 1.38 e 1,5 como 1.8; o Word usa porcentagem.
  if (n < 1.08) return "1";
  if (n < 1.45) return "1.15";
  if (n < 1.85) return "1.5";
  return "2";
}

/** Converte um recuo CSS (cm, mm, pt, px, in, em) em cm; null se ausente/inválido. */
export function normalizarRecuo(valor: string | null | undefined): string | null {
  const m = (valor ?? "").trim().match(/^([\d.]+)\s*(cm|mm|pt|px|in|em)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const fator: Record<string, number> = { cm: 1, mm: 0.1, pt: 2.54 / 72, px: 2.54 / 96, in: 2.54, em: 0.42 };
  const cm = n * (fator[(m[2] ?? "px").toLowerCase()] ?? 0);
  if (!Number.isFinite(cm) || cm < 0.2) return null;
  return `${Math.min(cm, 5).toFixed(2).replace(/\.?0+$/, "")}cm`;
}

const LineHeight = Extension.create({
  name: "lineHeight",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          lineHeight: {
            default: DEFAULT_LINE_HEIGHT,
            parseHTML: (element) => normalizarEntrelinha(element.style.lineHeight) ?? DEFAULT_LINE_HEIGHT,
            renderHTML: (attributes) => ({
              style: `line-height: ${String(attributes.lineHeight || DEFAULT_LINE_HEIGHT)}`,
            }),
          },
        },
      },
    ];
  },
});

/** Recuo de primeira linha por parágrafo (text-indent), respeitado no PDF. */
const RecuoPrimeiraLinha = Extension.create({
  name: "recuoPrimeiraLinha",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          textIndent: {
            default: null,
            parseHTML: (element) => normalizarRecuo(element.style.textIndent),
            renderHTML: (attributes) =>
              attributes.textIndent ? { style: `text-indent: ${String(attributes.textIndent)}` } : {},
          },
        },
      },
    ];
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.updateAttributes("paragraph", { textIndent: RECUO_PADRAO }),
      "Shift-Tab": () => this.editor.commands.updateAttributes("paragraph", { textIndent: null }),
    };
  },
});

function escaparHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Texto puro colado (Discord, bloco de notas): cada linha um parágrafo, linhas em branco preservadas. */
export function textoColadoParaHtml(texto: string): string {
  const linhas = texto.replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
  return linhas.map((l) => (l.trim() ? `<p>${escaparHtml(l)}</p>` : "<p></p>")).join("");
}

/**
 * Limpa o HTML colado do Word / Google Docs: linhas em branco viram
 * parágrafos vazios (e não "quebra + linha extra") e a entrelinha é
 * aproximada das opções do editor.
 */
export function limparHtmlColado(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocos = new Set(["P", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TD"]);
  // <br> solto entre parágrafos (Google Docs) → parágrafo vazio.
  doc.body.querySelectorAll("br").forEach((br) => {
    const pai = br.parentElement;
    if (!pai) return;
    const dentroDeBloco = br.closest("p, li, h1, h2, h3, h4, h5, h6, td");
    if (!dentroDeBloco && (pai === doc.body || !blocos.has(pai.tagName))) {
      const irmaosBloco = Array.from(pai.children).some((c) => blocos.has(c.tagName));
      if (irmaosBloco) br.replaceWith(doc.createElement("p"));
    }
  });
  doc.body.querySelectorAll<HTMLElement>("p, div, h1, h2, h3, h4, h5, h6, li").forEach((el) => {
    // Parágrafo só com <br> (ou &nbsp;) = linha em branco.
    if (!el.textContent?.replace(/\u00a0/g, " ").trim() && !el.querySelector("img")) {
      el.innerHTML = "";
    }
    const lh = normalizarEntrelinha(el.style.lineHeight);
    el.style.lineHeight = lh ?? "";
    const recuo = normalizarRecuo(el.style.textIndent);
    el.style.textIndent = recuo ?? "";
  });
  return doc.body.innerHTML;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Habilita entrelinhas por parágrafo para os atos internos. */
  enableLineHeight?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 180, enableLineHeight = false }: RichTextEditorProps) {
  // handlePaste é criado antes do editor existir; a ref dá acesso a ele na hora de colar.
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      // Só a formatação que o PDF reproduz. Listas, código e tachado ficam
      // desligados: "1. " ou "- " no início da linha continuam texto comum.
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        code: false,
        strike: false,
        link: false,
        underline: false,
      }),
      Underline,
      TextAlign.configure({ types: ["paragraph"], alignments: ["left", "center", "right", "justify"] }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank", class: "text-primary underline decoration-dotted underline-offset-2" } }),
      ...(enableLineHeight ? [LineHeight, RecuoPrimeiraLinha] : []),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: `prose-tiptap${enableLineHeight ? " ato-editor-spacing" : ""} focus:outline-none`,
        style: `min-height:${minHeight}px`,
        "data-placeholder": placeholder ?? "",
      },
      transformPastedHTML: (html) => limparHtmlColado(html),
      handlePaste: (_view, event) => {
        const dados = event.clipboardData;
        if (!dados || dados.types.includes("text/html") || dados.files?.length) return false;
        const texto = dados.getData("text/plain");
        if (!texto || !/\n/.test(texto)) return false;
        event.preventDefault();
        editorRef.current?.chain().focus().insertContent(textoColadoParaHtml(texto), { parseOptions: { preserveWhitespace: "full" } }).run();
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });
  editorRef.current = editor;

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
      <div className="px-4 py-3 text-[15px]">
        <EditorContent editor={editor} />
      </div>
      {enableLineHeight && (
        <div className="border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground">
          Enter: novo parágrafo · Shift+Enter: nova linha no mesmo parágrafo · Tab: recuo da 1ª linha
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor, enableLineHeight }: { editor: Editor; enableLineHeight: boolean }) {
  const [lineHeight, setLineHeight] = useState(DEFAULT_LINE_HEIGHT);
  const [, forcar] = useState(0);

  useEffect(() => {
    const sincronizar = () => {
      if (enableLineHeight) {
        const next = String(editor.getAttributes("paragraph").lineHeight || DEFAULT_LINE_HEIGHT);
        setLineHeight(LINE_HEIGHTS.includes(next as (typeof LINE_HEIGHTS)[number]) ? next : DEFAULT_LINE_HEIGHT);
      }
      forcar((n) => n + 1); // atualiza o estado ativo dos botões
    };
    sincronizar();
    editor.on("selectionUpdate", sincronizar);
    editor.on("transaction", sincronizar);
    return () => {
      editor.off("selectionUpdate", sincronizar);
      editor.off("transaction", sincronizar);
    };
  }, [editor, enableLineHeight]);

  const btn = (active: boolean) =>
    `rounded p-1.5 text-xs transition disabled:opacity-40 ${active ? "bg-primary/20 text-primary" : "hover:bg-surface-2 text-muted-foreground"}`;
  const sep = <span className="mx-1 h-4 w-px bg-border" aria-hidden />;
  const recuoAtivo = enableLineHeight && !!editor.getAttributes("paragraph").textIndent;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border/60 px-2 py-1">
      <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={btn(false)} aria-label="Desfazer" title="Desfazer (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={btn(false)} aria-label="Refazer" title="Refazer (Ctrl+Y)"><Redo2 className="h-3.5 w-3.5" /></button>
      {sep}
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))} aria-label="Negrito" title="Negrito (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))} aria-label="Itálico" title="Itálico (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive("underline"))} aria-label="Sublinhado" title="Sublinhado (Ctrl+U)"><UnderlineIcon className="h-3.5 w-3.5" /></button>
      {sep}
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("left").run()} className={btn(editor.isActive({ textAlign: "left" }))} aria-label="Esquerda" title="Alinhar à esquerda"><AlignLeft className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("center").run()} className={btn(editor.isActive({ textAlign: "center" }))} aria-label="Centro" title="Centralizar"><AlignCenter className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("right").run()} className={btn(editor.isActive({ textAlign: "right" }))} aria-label="Direita" title="Alinhar à direita"><AlignRight className="h-3.5 w-3.5" /></button>
      <button type="button" onClick={() => editor.chain().focus().setTextAlign("justify").run()} className={btn(editor.isActive({ textAlign: "justify" }))} aria-label="Justificado" title="Justificar"><AlignJustify className="h-3.5 w-3.5" /></button>
      {enableLineHeight && (
        <>
          {sep}
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().updateAttributes("paragraph", { textIndent: recuoAtivo ? null : RECUO_PADRAO }).run()
            }
            className={btn(recuoAtivo)}
            aria-label="Recuo da primeira linha"
            aria-pressed={recuoAtivo}
            title="Recuo da 1ª linha (Tab / Shift+Tab)"
          >
            <IndentIncrease className="h-3.5 w-3.5" />
          </button>
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
      {sep}
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
        title="Inserir link"
      ><LinkIcon className="h-3.5 w-3.5" /></button>
      <button
        type="button"
        onClick={() => {
          const cadeia = editor.chain().focus().unsetAllMarks().unsetTextAlign();
          if (enableLineHeight) cadeia.updateAttributes("paragraph", { lineHeight: DEFAULT_LINE_HEIGHT, textIndent: null });
          cadeia.run();
        }}
        className={btn(false)}
        aria-label="Limpar formatação"
        title="Limpar formatação do trecho selecionado"
      ><RemoveFormatting className="h-3.5 w-3.5" /></button>
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
