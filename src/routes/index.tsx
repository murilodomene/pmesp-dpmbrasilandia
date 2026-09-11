import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { ShieldCheck, FileSearch, Scale } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Corregedoria da Polícia Militar de São Paulo" },
      { name: "description", content: "Canal oficial da Corregedoria da Polícia Militar do Estado de São Paulo para denúncias e consulta de procedimentos." },
      { property: "og:title", content: "Corregedoria da Polícia Militar de São Paulo" },
      { property: "og:description", content: "Canal oficial da Corregedoria da Polícia Militar do Estado de São Paulo para denúncias e consulta de procedimentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CARDS = [
  {
    icon: ShieldCheck,
    title: "Sigilo garantido",
    text: "Sua identidade e o teor da denúncia são preservados. Denúncias anônimas são aceitas e conduzidas com o mesmo rigor.",
  },
  {
    icon: FileSearch,
    title: "Análise criteriosa",
    text: "Cada relato é autuado, protocolado e conduzido por corregedores em procedimento formal com prazo controlado.",
  },
  {
    icon: Scale,
    title: "Canal oficial",
    text: "Este é o meio institucional para reportar conduta indevida de policial militar. Acompanhe o andamento pelo protocolo.",
  },
];

function Index() {
  return (
    <div className="min-h-screen">
      <Header />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 md:pt-24">
        <div className="eyebrow">Corregedoria · Polícia Militar do Estado de São Paulo</div>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.05] md:text-6xl">
          Controle interno, com rigor e cadência.
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
          Canal oficial de recebimento de denúncias e sistema de condução de procedimentos
          disciplinares contra servidores da Polícia Militar do Estado de São Paulo.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/denunciar"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Fazer uma denúncia
          </Link>
          <Link
            to="/consultar"
            className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-surface-2"
          >
            Consultar por protocolo
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 md:grid-cols-3">
        {CARDS.map((c) => (
          <article key={c.title} className="surface p-6">
            <c.icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
            <h2 className="mt-4 font-serif text-xl">{c.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.text}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Sistema institucional de corregedoria — uso restrito a servidores autorizados.
      </footer>
    </div>
  );
}
