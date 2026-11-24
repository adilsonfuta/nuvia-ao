"use client";

import { ChangeEvent, useMemo, useState } from "react";

export type BulkKind = "vendors" | "venues";
export type BulkImportEntry = { payload: Record<string, unknown>; photos: File[]; rowNumber: number; errors: string[] };
type Props = { kind: BulkKind; busy?: boolean; onClose: () => void; onImport: (entries: BulkImportEntry[]) => Promise<{ imported: number; uploadedPhotos: number; photoErrors: string[] }> };

const FIELDS: Record<BulkKind, { header: string; key: string; type?: "number" | "list" }[]> = {
  vendors: [
    { header: "nome", key: "name" }, { header: "categoria", key: "category" }, { header: "descricao", key: "description" },
    { header: "provincia", key: "province" }, { header: "municipio", key: "municipality" }, { header: "telefone", key: "phone" },
    { header: "email", key: "email" }, { header: "site", key: "websiteUrl" }, { header: "instagram", key: "instagramUrl" },
    { header: "facebook", key: "facebookUrl" }, { header: "tiktok", key: "tiktokUrl" }, { header: "servicos", key: "services", type: "list" },
    { header: "zonas_atendidas", key: "serviceAreas", type: "list" }, { header: "capacidade_min", key: "capacityMin", type: "number" },
    { header: "capacidade_max", key: "capacityMax", type: "number" }, { header: "preco_min", key: "priceFrom", type: "number" }, { header: "preco_max", key: "priceTo", type: "number" },
  ],
  venues: [
    { header: "nome", key: "name" }, { header: "tipo", key: "venueType" }, { header: "descricao", key: "description" },
    { header: "provincia", key: "province" }, { header: "municipio", key: "municipality" }, { header: "endereco", key: "address" },
    { header: "link_mapa", key: "mapsUrl" }, { header: "latitude", key: "latitude", type: "number" }, { header: "longitude", key: "longitude", type: "number" },
    { header: "capacidade_min", key: "capacityMin", type: "number" }, { header: "capacidade_max", key: "capacityMax", type: "number" },
    { header: "preco_min", key: "priceFrom", type: "number" }, { header: "preco_max", key: "priceTo", type: "number" },
    { header: "comodidades", key: "amenities", type: "list" }, { header: "tipos_evento", key: "eventTypes", type: "list" },
    { header: "telefone", key: "phone" }, { header: "email", key: "email" }, { header: "site", key: "websiteUrl" },
    { header: "condicoes_reserva", key: "bookingTerms" }, { header: "condicoes_pagamento", key: "paymentTerms" }, { header: "condicoes_cancelamento", key: "cancellationTerms" },
  ],
};

function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(cell); if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function parseEntries(text: string, kind: BulkKind): BulkImportEntry[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("O CSV precisa de um cabeçalho e pelo menos um registo.");
  const fields = FIELDS[kind];
  const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-AO").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const headers = rows[0].map(normalize);
  const missingHeaders = fields.filter(field => ["name", kind === "vendors" ? "category" : "venueType"].includes(field.key) && !headers.includes(field.header));
  if (missingHeaders.length) throw new Error(`Faltam colunas obrigatórias: ${missingHeaders.map(field => field.header).join(", ")}. Descarrega o modelo correcto.`);
  if (rows.length - 1 > 100) throw new Error("Cada importação aceita até 100 registos.");
  return rows.slice(1).map((values, index) => {
    const payload: Record<string, unknown> = {};
    fields.forEach(field => {
      const column = headers.indexOf(field.header);
      const raw = column >= 0 ? (values[column] ?? "").trim() : "";
      if (!raw) return;
      if (field.type === "list") payload[field.key] = raw.split("|").map(value => value.trim()).filter(Boolean);
      else if (field.type === "number") payload[field.key] = Number(raw.replace(",", "."));
      else payload[field.key] = raw;
    });
    return { payload, photos: [], rowNumber: index + 2, errors: validatePayload(payload, kind) };
  });
}

function validatePayload(payload: Record<string, unknown>, kind: BulkKind, photos: File[] = []): string[] {
  const errors: string[] = [];
  const required = kind === "vendors" ? [["name", "nome"], ["category", "categoria"]] : [["name", "nome"], ["venueType", "tipo"]];
  for (const [key, label] of required) if (typeof payload[key] !== "string" || String(payload[key]).trim().length < 2) errors.push(`${label} obrigatório (mínimo 2 caracteres)`);
  const numbers = ["capacityMin", "capacityMax", "priceFrom", "priceTo", ...(kind === "venues" ? ["latitude", "longitude"] : [])];
  for (const key of numbers) if (key in payload && !Number.isFinite(payload[key])) errors.push(`${key} tem de ser um número válido`);
  if (payload.capacityMin != null && (!Number.isInteger(Number(payload.capacityMin)) || Number(payload.capacityMin) < 0 || Number(payload.capacityMin) > 100000)) errors.push("capacidade mínima deve ser um inteiro entre 0 e 100 000");
  if (payload.capacityMax != null && (!Number.isInteger(Number(payload.capacityMax)) || Number(payload.capacityMax) < 1 || Number(payload.capacityMax) > 100000)) errors.push("capacidade máxima deve ser um inteiro entre 1 e 100 000");
  for (const key of ["priceFrom", "priceTo"]) if (payload[key] != null && Number(payload[key]) < 0) errors.push(`${key} não pode ser negativo`);
  if (payload.latitude != null && (Number(payload.latitude) < -90 || Number(payload.latitude) > 90)) errors.push("latitude fora do intervalo válido");
  if (payload.longitude != null && (Number(payload.longitude) < -180 || Number(payload.longitude) > 180)) errors.push("longitude fora do intervalo válido");
  if (payload.capacityMin != null && payload.capacityMax != null && Number(payload.capacityMin) > Number(payload.capacityMax)) errors.push("capacidade mínima superior à máxima");
  if (payload.priceFrom != null && payload.priceTo != null && Number(payload.priceFrom) > Number(payload.priceTo)) errors.push("preço mínimo superior ao máximo");
  if ((payload.latitude == null) !== (payload.longitude == null)) errors.push("latitude e longitude devem ser preenchidas em conjunto");
  const urls = ["websiteUrl", "instagramUrl", "facebookUrl", "tiktokUrl", "mapsUrl"];
  for (const key of urls) if (payload[key]) {
    try { if (new URL(String(payload[key])).protocol !== "https:") errors.push(`${key} deve começar por https://`); }
    catch { errors.push(`${key} não é um link válido`); }
  }
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email))) errors.push("email inválido");
  const limits: Record<string, number> = { name: 120, category: 80, venueType: 80, province: 80, municipality: 100, address: 300, phone: 40, email: 180, description: kind === "vendors" ? 2000 : 2500 };
  for (const [key, max] of Object.entries(limits)) if (payload[key] != null && String(payload[key]).length > max) errors.push(`${key} excede ${max} caracteres`);
  for (const key of ["services", "serviceAreas", "amenities", "eventTypes"]) if (Array.isArray(payload[key]) && payload[key].length > (key === "amenities" ? 40 : key === "eventTypes" ? 20 : 30)) errors.push(`${key} excede o número máximo de itens`);
  const maxPhotos = kind === "vendors" ? 8 : 20;
  if (photos.length > maxPhotos) errors.push(`máximo de ${maxPhotos} fotografias por registo`);
  if (photos.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) errors.push("as fotografias devem ser JPEG, PNG ou WebP");
  if (photos.some(file => file.size > 8 * 1024 * 1024)) errors.push("cada fotografia deve ter no máximo 8 MB");
  return errors;
}

function downloadTemplate(kind: BulkKind) {
  const headers = FIELDS[kind].map(field => field.header).join(";");
  const blob = new Blob([`\uFEFF${headers}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `modelo-${kind === "vendors" ? "fornecedores" : "espacos"}-nuvia.csv`; anchor.click();
  URL.revokeObjectURL(url);
}

const FIELD_LABELS: Record<string, string> = { name: "Nome", category: "Categoria", venueType: "Tipo", province: "Província", municipality: "Município", phone: "Telefone", email: "Email", address: "Endereço", description: "Descrição", capacityMax: "Capacidade", priceFrom: "Preço mínimo" };

export function BulkCatalogImport({ kind, busy = false, onClose, onImport }: Props) {
  const [entries, setEntries] = useState<BulkImportEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [photoErrors, setPhotoErrors] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const validEntries = useMemo(() => entries.filter(entry => !entry.errors.length), [entries]);
  const invalidCount = entries.length - validEntries.length;

  function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(""); setResult(""); setPhotoErrors([]); setCompleted(false);
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError("O ficheiro CSV deve ter no máximo 2 MB."); return; }
    void file.text().then(text => { setEntries(parseEntries(text, kind)); setFileName(file.name); }).catch(cause => setError(cause instanceof Error ? cause.message : "Não foi possível ler este CSV."));
    event.target.value = "";
  }

  function attachPhotos(index: number, event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setEntries(current => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, photos: selected, errors: validatePayload(entry.payload, kind, selected) } : entry));
    setError(""); setResult(""); setPhotoErrors([]); event.target.value = "";
  }

  async function submit() {
    if (!validEntries.length || busy || completed) return;
    setError(""); setResult(""); setPhotoErrors([]);
    try {
      const response = await onImport(validEntries);
      const failed = response.photoErrors.length ? ` ${response.photoErrors.length} fotografia(s) não foram associadas; consulta os detalhes abaixo e volta a carregá-las depois no espaço ou perfil correspondente.` : "";
      setPhotoErrors(response.photoErrors); setCompleted(true);
      setResult(`${response.imported} registo(s) criado(s) como rascunho/pendente. ${response.uploadedPhotos} fotografia(s) anexada(s).${failed}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível importar os registos."); }
  }

  return <section className="dash-panel admin-bulk-import" aria-label="Importação em lote">
    <header><div><p className="eyebrow">Importação em lote</p><h3>{kind === "vendors" ? "Importar fornecedores" : "Importar espaços"}</h3><p>Carrega um CSV, revê cada linha e associa fotografias antes de criar rascunhos.</p></div><button className="admin-guide-clear" type="button" onClick={onClose}>Fechar</button></header>
    <div className="admin-bulk-import-toolbar"><button className="button button-outline compact" type="button" onClick={() => downloadTemplate(kind)}>Descarregar modelo CSV</button><label className="admin-bulk-file">Escolher ficheiro CSV<input type="file" accept=".csv,text/csv" onChange={loadFile}/></label>{fileName && <span>{fileName}</span>}</div>
    <p className="admin-bulk-instructions">O ficheiro aceita até 100 registos. Usa <code>|</code> para separar vários serviços ou comodidades. Depois, podes seleccionar fotografias em cada linha. Os novos fornecedores ficam por rever e os espaços ficam em rascunho.</p>
    {entries.length > 0 && <div className="admin-bulk-summary" aria-live="polite"><strong>{entries.length} linhas</strong><span>{validEntries.length} prontas para importar</span>{invalidCount > 0 && <em>{invalidCount} com erros serão ignoradas</em>}</div>}
    {entries.length > 0 && <div className="admin-bulk-rows">{entries.map((entry, index) => <article className={`admin-bulk-row ${entry.errors.length ? "has-errors" : ""}`} key={entry.rowNumber}><div><strong>Linha {entry.rowNumber} · {String(entry.payload.name || "Sem nome")}</strong><small>{kind === "vendors" ? String(entry.payload.category || "Categoria em falta") : String(entry.payload.venueType || "Tipo em falta")} · {[entry.payload.municipality, entry.payload.province].filter(Boolean).join(", ") || "Localização por preencher"}</small>{entry.photos.length > 0 && <small>Fotografias: {entry.photos.map(photo => photo.name).join(", ")}</small>}{entry.errors.length > 0 && <ul>{entry.errors.map(message => <li key={message}>{message}</li>)}</ul>}</div><label className="admin-bulk-photo-picker">{entry.photos.length ? "Alterar fotografias" : "Associar fotografias"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => attachPhotos(index, event)} disabled={completed}/></label></article>)}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}{result && <p className="admin-bulk-result" role="status">{result}</p>}{photoErrors.length > 0 && <details className="admin-bulk-photo-errors"><summary>Ver fotografias que falharam</summary><ul>{photoErrors.map(item => <li key={item}>{item}</li>)}</ul></details>}
    <footer><button className="button button-primary" type="button" disabled={!validEntries.length || busy || completed} onClick={() => void submit()}>{busy ? "A importar…" : completed ? "Importação concluída" : `Importar ${validEntries.length} registo(s)`}</button>{invalidCount > 0 && <small>Corrige as linhas assinaladas no CSV e carrega-o novamente.</small>}</footer>
  </section>;
}
