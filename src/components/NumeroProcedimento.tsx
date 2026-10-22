export function identificacaoProcedimento(d: {
  numero_procedimento?: string | null;
  numero_protocolo: string;
}) {
  return d.numero_procedimento || d.numero_protocolo;
}

/** Número interno quando instaurado; senão o protocolo com o selo "Aguardando instauração". */
export function NumeroProcedimento({
  d,
  className = "",
}: {
  d: { numero_procedimento?: string | null; numero_protocolo: string };
  className?: string;
}) {
  if (d.numero_procedimento) return <span className={className}>{d.numero_procedimento}</span>;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      <span>{d.numero_protocolo}</span>
      <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        Aguardando instauração
      </span>
    </span>
  );
}
