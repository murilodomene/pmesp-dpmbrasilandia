<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep `/ipc` routes as compatibility redirects to the canonical public `/ipm` routes, because previously shared public links must remain valid.
- The full-process PDF export ("Exportar processo (PDF)") uses the vector engine in `src/lib/pdf/` (jsPDF text, not screenshots): SSP crest letterhead from `public/pdf/brasao-ssp.png`, "DESPACHO - CORREGPM"-style titles, and a footer with IPM/SINDPM reference, the PM emblem (`public/pdf/emblema-pm.png`) and "Página X de Y". The Portaria and the final act (especie `ipc`, exported as "SOLUÇÃO" with PARTES = denounced officers) follow the approved models with identification key/barcode. Do not replace it with html2canvas captures; extend `src/lib/pdf/processo-pdf.ts` instead.
- The old screenshot-based exporter (`exportProcessoCompleto`, "versão anterior" button) is kept temporarily as a fallback. Individual act downloads and the standalone Portaria still use the shared browser renderer (fixed A4 width, line-safe captures) until migrated; keep the approved standalone Portaria renderer separate.
- Public complaint protocol (denuncias.numero_protocolo, PMESP-<sigla>-…) is the citizen's key and never appears on public IPM pages; internal staff screens identify cases by numero_procedimento (generated only by the instaurar_procedimento DB function) and fall back to the protocol with an 'Aguardando instauração' badge — keeps the citizen key private and numbering atomic.
