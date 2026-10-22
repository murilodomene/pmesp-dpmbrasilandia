import { POSTOS_GRADUACOES } from "@/lib/personnel-options";

export function PostoGraduacaoSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:bg-muted"
    >
      <option value="">— Não informado —</option>
      {POSTOS_GRADUACOES.map((p) => (
        <option key={p} value={p} className="bg-background">
          {p}
        </option>
      ))}
    </select>
  );
}
