/** CSV dengan pemisah titik koma dan BOM UTF-8: langsung terbaca benar di Excel berbahasa Indonesia dan Google Sheets. */
export function buatCSV(kolom: string[], baris: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    let s = v === null || v === undefined ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@]/.test(s)) s = "'" + s; // cegah rumus tersisip di spreadsheet
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [kolom, ...baris].map((r) => r.map(esc).join(";")).join("\r\n") + "\r\n";
}
