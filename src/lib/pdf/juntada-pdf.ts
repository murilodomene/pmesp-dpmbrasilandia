/**
 * Juntada de petições em PDF aos autos exportados: insere as páginas de cada
 * petição logo após a sua folha de juntada, reduzidas para caber na área útil
 * da folha A4, com uma tarja de identificação no topo e o mesmo rodapé dos
 * autos ("SINDPM nº … · Página X de Y"). Usa pdf-lib, carregado só na hora.
 */

export interface PeticaoParaJuntar {
  /** Conteúdo do PDF da petição. */
  bytes: ArrayBuffer;
  /** Tarja do topo, ex.: "PETIÇÃO 01 — juntada pelo denunciante em 20/10/2026". */
  tarja: string;
}

const MM = 72 / 25.4;

export async function juntarPeticoes(
  autos: ArrayBuffer,
  reservas: Array<{ aposPagina: number; paginas: number }>,
  peticoes: PeticaoParaJuntar[],
  rodape: string,
  emblemaPng?: ArrayBuffer,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.load(autos);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const fonteB = await doc.embedFont(StandardFonts.HelveticaBold);
  const emblema = emblemaPng ? await doc.embedPng(emblemaPng) : null;
  const totalLogico = doc.getPageCount() + reservas.reduce((s, r) => s + r.paginas, 0);

  // Insere de trás para frente para não deslocar os índices das reservas.
  const ordem = reservas.map((r, i) => ({ ...r, i })).sort((a, b) => b.aposPagina - a.aposPagina);
  for (const r of ordem) {
    const pt = peticoes[r.i];
    if (!pt) continue;
    let embutidas: Awaited<ReturnType<typeof doc.embedPages>>;
    try {
      const origem = await PDFDocument.load(pt.bytes, { ignoreEncryption: true });
      embutidas = await doc.embedPages(origem.getPages());
    } catch (e) {
      console.error("[juntada] petição não pôde ser juntada", e);
      continue;
    }
    // A reserva foi feita com a contagem conferida no download; se divergir, não junta.
    if (embutidas.length !== r.paginas) continue;
    // Número lógico da primeira página desta petição.
    const antes = reservas
      .filter((x) => x.aposPagina < r.aposPagina)
      .reduce((s, x) => s + x.paginas, 0);
    embutidas.forEach((pg, k) => {
      const W = 210 * MM;
      const H = 297 * MM;
      const page = doc.insertPage(r.aposPagina + k, [W, H]);
      // Área útil: entre a tarja (topo) e o rodapé.
      const topo = H - 22 * MM;
      const base = 34 * MM;
      const larg = W - 30 * MM;
      const alt = topo - base;
      const escala = Math.min(larg / pg.width, alt / pg.height, 1);
      const w = pg.width * escala;
      const h = pg.height * escala;
      const x = (W - w) / 2;
      const y = base + (alt - h) / 2;
      page.drawPage(pg, { x, y, width: w, height: h });
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: rgb(0.8, 0.82, 0.85),
        borderWidth: 0.5,
      });
      // Tarja de identificação.
      page.drawRectangle({
        x: 15 * MM,
        y: H - 17 * MM,
        width: W - 30 * MM,
        height: 7 * MM,
        color: rgb(0.78, 0.78, 0.78),
      });
      const tarja = `${pt.tarja} · fl. ${k + 1}/${embutidas.length}`;
      const tw = fonteB.widthOfTextAtSize(tarja, 8.5);
      page.drawText(tarja, { x: (W - tw) / 2, y: H - 14.5 * MM, size: 8.5, font: fonteB });
      // Rodapé igual ao dos autos.
      const n = r.aposPagina + antes + k + 1;
      const yRod = H - 266.6 * MM - 2.2 * MM;
      page.drawText(rodape, { x: 15.4 * MM, y: yRod, size: 8, font: fonte });
      const pag = `Página ${n} de ${totalLogico}`;
      page.drawText(pag, {
        x: W - 20 * MM - fonte.widthOfTextAtSize(pag, 8),
        y: yRod,
        size: 8,
        font: fonte,
      });
      if (emblema) {
        const ew = 13 * MM;
        const eh = (ew * emblema.height) / emblema.width;
        page.drawImage(emblema, { x: (W - ew) / 2, y: H - 273.6 * MM - eh, width: ew, height: eh });
      }
    });
  }
  return doc.save();
}
