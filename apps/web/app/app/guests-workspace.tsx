"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "../lib/api";

type Guest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  groupName: string | null;
  maxPartySize: number;
  seatingTableId: string | null;
  rsvpToken: string;
  rsvps: { status: string; partySize: number }[];
};
type Table = {
  id: string;
  name: string;
  capacity: number | null;
  capacityUsed: number;
  _count: { guests: number };
};
type StatusFilter = "ALL" | "PENDING" | "ACCEPTED" | "DECLINED";
type GuestRow = {
  name: string;
  email?: string;
  phone?: string;
  groupName?: string;
  maxPartySize?: number;
};

const rsvpStatus = (guest: Guest) => guest.rsvps[0]?.status ?? "PENDING";
const seatsFor = (guest: Guest) => {
  const status = rsvpStatus(guest);
  if (status === "DECLINED") return 0;
  return status === "ACCEPTED" ? guest.rsvps[0].partySize : guest.maxPartySize;
};
const statusLabel = (status: string) =>
  status === "ACCEPTED"
    ? "Confirmado"
    : status === "DECLINED"
      ? "Não vai"
      : "Sem resposta";
const escapeCsv = (value: string | number) => {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  let commaCount = 0;
  let semicolonCount = 0;
  let quoted = false;
  for (let i = 0; i < firstLine.length; i += 1) {
    if (firstLine[i] === '"') {
      if (quoted && firstLine[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && firstLine[i] === ",") commaCount += 1;
    else if (!quoted && firstLine[i] === ";") semicolonCount += 1;
  }
  const delimiter = semicolonCount > commaCount ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-AO")
    .replace(/[^a-z0-9]/g, "");

function csvRows(rows: string[][]): { guests: GuestRow[]; error?: string } {
  if (rows.length < 2)
    return { guests: [], error: "O CSV não tem linhas de convidados." };
  const headers = rows[0].map(normalizeHeader);
  const findColumn = (...names: string[]) =>
    headers.findIndex((header) => names.includes(header));
  const nameIndex = findColumn("nome", "name", "convidado");
  if (nameIndex < 0)
    return { guests: [], error: "Inclui uma coluna chamada nome ou name." };
  const emailIndex = findColumn("email", "correioeletronico");
  const phoneIndex = findColumn("telefone", "telemovel", "celular", "phone");
  const groupIndex = findColumn(
    "grupo",
    "familia",
    "grupofamilia",
    "group",
    "groupname",
  );
  const partyIndex = findColumn(
    "maxpartysize",
    "pessoas",
    "acompanhantes",
    "limitepessoas",
  );
  const guests: GuestRow[] = [];
  for (const row of rows.slice(1)) {
    const name = row[nameIndex]?.trim();
    if (!name) continue;
    const rawParty = partyIndex >= 0 ? row[partyIndex]?.trim() : "";
    const maxPartySize = rawParty ? Number(rawParty) : 1;
    if (
      !Number.isInteger(maxPartySize) ||
      maxPartySize < 1 ||
      maxPartySize > 10
    ) {
      return {
        guests: [],
        error: `O limite de pessoas de “${name}” deve ser entre 1 e 10.`,
      };
    }
    guests.push({
      name,
      email: emailIndex >= 0 ? row[emailIndex]?.trim() || undefined : undefined,
      phone: phoneIndex >= 0 ? row[phoneIndex]?.trim() || undefined : undefined,
      groupName:
        groupIndex >= 0 ? row[groupIndex]?.trim() || undefined : undefined,
      maxPartySize,
    });
  }
  if (!guests.length)
    return { guests: [], error: "Não encontrei nomes válidos no ficheiro." };
  if (guests.length > 500)
    return { guests: [], error: "Importa até 500 convidados por ficheiro." };
  return { guests };
}

export function GuestsWorkspace({
  projectId,
  guests,
  tables,
  invitationSlug,
  onRefresh,
  onNotice,
  onError,
}: {
  projectId: string;
  guests: Guest[];
  tables: Table[];
  invitationSlug?: string;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [groupFilter, setGroupFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [group, setGroup] = useState("");
  const [maxPartySize, setMaxPartySize] = useState("1");
  const [tableName, setTableName] = useState("");
  const [tableCapacity, setTableCapacity] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const confirmedPeople = guests.reduce(
    (sum, guest) =>
      sum + (rsvpStatus(guest) === "ACCEPTED" ? guest.rsvps[0].partySize : 0),
    0,
  );
  const expectedPeople = guests.reduce(
    (sum, guest) => sum + seatsFor(guest),
    0,
  );
  const pendingInvites = guests.filter(
    (guest) =>
      rsvpStatus(guest) !== "ACCEPTED" && rsvpStatus(guest) !== "DECLINED",
  ).length;
  const declinedInvites = guests.filter(
    (guest) => rsvpStatus(guest) === "DECLINED",
  ).length;
  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          guests
            .map((guest) => guest.groupName)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-AO")),
    [guests],
  );
  const filteredGuests = useMemo(
    () =>
      guests.filter((guest) => {
        const haystack =
          `${guest.name} ${guest.email ?? ""} ${guest.phone ?? ""} ${guest.groupName ?? ""}`.toLocaleLowerCase(
            "pt-AO",
          );
        if (search && !haystack.includes(search.toLocaleLowerCase("pt-AO")))
          return false;
        if (statusFilter !== "ALL" && rsvpStatus(guest) !== statusFilter)
          return false;
        if (groupFilter && guest.groupName !== groupFilter) return false;
        if (tableFilter === "UNASSIGNED" && guest.seatingTableId) return false;
        if (
          tableFilter &&
          tableFilter !== "UNASSIGNED" &&
          guest.seatingTableId !== tableFilter
        )
          return false;
        return true;
      }),
    [guests, search, statusFilter, groupFilter, tableFilter],
  );

  function resetForm() {
    setFormOpen(false);
    setEditingId("");
    setName("");
    setContact("");
    setGroup("");
    setMaxPartySize("1");
  }

  function openNewGuestForm() {
    setEditingId("");
    setName("");
    setContact("");
    setGroup("");
    setMaxPartySize("1");
    setFormOpen(true);
  }

  function editGuest(guest: Guest) {
    setEditingId(guest.id);
    setName(guest.name);
    setContact(guest.email || guest.phone || "");
    setGroup(guest.groupName || "");
    setMaxPartySize(String(guest.maxPartySize));
    setFormOpen(true);
  }

  async function saveGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api(
        `/projects/${projectId}/guests${editingId ? `/${editingId}` : ""}`,
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({
            name,
            groupName: group || null,
            maxPartySize: Number(maxPartySize),
            email: contact.includes("@") ? contact || null : null,
            phone: contact && !contact.includes("@") ? contact : null,
          }),
        },
      );
      resetForm();
      await onRefresh();
      onNotice("Convidado guardado.");
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível guardar o convidado.",
      );
    }
  }

  async function assignTable(guest: Guest, seatingTableId: string) {
    const table = tables.find((item) => item.id === seatingTableId);
    if (table?.capacity) {
      const needed = seatsFor(guest);
      const occupiedWithoutGuest =
        table.capacityUsed -
        (guest.seatingTableId === table.id ? seatsFor(guest) : 0);
      if (occupiedWithoutGuest + needed > table.capacity) {
        onError(
          `A mesa “${table.name}” não tem lugares suficientes para este grupo.`,
        );
        return;
      }
    }
    try {
      await api(`/projects/${projectId}/guests/${guest.id}`, {
        method: "PATCH",
        body: JSON.stringify({ seatingTableId: seatingTableId || null }),
      });
      await onRefresh();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível atribuir a mesa.",
      );
    }
  }

  async function removeGuest(guest: Guest) {
    if (!window.confirm(`Remover ${guest.name} e a respectiva resposta RSVP?`))
      return;
    try {
      await api(`/projects/${projectId}/guests/${guest.id}`, {
        method: "DELETE",
      });
      await onRefresh();
      onNotice("Convidado removido.");
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o convidado.",
      );
    }
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api(`/projects/${projectId}/tables`, {
        method: "POST",
        body: JSON.stringify({
          name: tableName,
          capacity: tableCapacity ? Number(tableCapacity) : undefined,
        }),
      });
      setTableName("");
      setTableCapacity("");
      await onRefresh();
      onNotice("Mesa criada.");
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar a mesa.",
      );
    }
  }

  function exportCsv() {
    const header = [
      "nome",
      "email",
      "telefone",
      "grupo",
      "maxPartySize",
      "rsvp",
      "pessoasConfirmadas",
      "mesa",
    ];
    const rows = guests.map((guest) => [
      guest.name,
      guest.email ?? "",
      guest.phone ?? "",
      guest.groupName ?? "",
      guest.maxPartySize,
      statusLabel(rsvpStatus(guest)),
      rsvpStatus(guest) === "ACCEPTED" ? guest.rsvps[0].partySize : "",
      tables.find((table) => table.id === guest.seatingTableId)?.name ?? "",
    ]);
    const csv = `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "convidados-evento.csv";
    link.click();
    URL.revokeObjectURL(url);
    onNotice(
      "A lista de convidados foi exportada. O ficheiro contém dados pessoais; guarda-o com cuidado.",
    );
  }

  function downloadCsvTemplate() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFFnome,email,telefone,grupo,maxPartySize\r\n"], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-convidados.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    onError("");
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("O ficheiro não pode exceder 5 MB.");
      const parsed = csvRows(
        parseCsv((await file.text()).replace(/^\uFEFF/, "")),
      );
      if (parsed.error) throw new Error(parsed.error);
      const result = await api<{ createdCount: number; skippedCount: number }>(
        `/projects/${projectId}/guests/import`,
        { method: "POST", body: JSON.stringify({ guests: parsed.guests }) },
      );
      await onRefresh();
      onNotice(
        `${result.createdCount} convidados importados${result.skippedCount ? `; ${result.skippedCount} duplicados ignorados` : ""}.`,
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível importar o ficheiro.",
      );
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  async function downloadQr(guest: Guest) {
    if (!invitationSlug) {
      onError("Publica primeiro o convite para gerar QR Codes individuais.");
      return;
    }
    try {
      const url = `${window.location.origin}/c/${invitationSlug}?token=${guest.rsvpToken}`;
      const image = await QRCode.toDataURL(url, {
        width: 560,
        margin: 2,
        color: { dark: "#173b29", light: "#ffffff" },
      });
      const link = document.createElement("a");
      link.href = image;
      link.download = `convite-${guest.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      link.click();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o QR Code.",
      );
    }
  }

  function shareRsvp(guest: Guest) {
    if (!invitationSlug) {
      onError("Publica primeiro o convite para partilhar links individuais.");
      return;
    }
    const link = `${window.location.origin}/c/${invitationSlug}?token=${guest.rsvpToken}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`Olá ${guest.name}, partilhamos o nosso convite: ${link}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <section className="dash-panel guest-workspace">
      <header className="guest-workspace-heading">
        <div>
          <p className="eyebrow">Lista privada do evento</p>
          <h2>Convidados</h2>
          <p>
            Controla os convites, as respostas e a distribuição pelas mesas.
          </p>
        </div>
        <div className="guest-workspace-actions">
          <button
            className="button button-outline compact"
            onClick={downloadCsvTemplate}
          >
            Modelo CSV
          </button>
          <button
            className="button button-outline compact"
            onClick={exportCsv}
            disabled={!guests.length}
          >
            Exportar CSV
          </button>
          <label className="button button-outline compact guest-file-button">
            {importing ? "A importar…" : "Importar CSV"}
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void importCsv(event)}
              disabled={importing}
            />
          </label>
          <button
            className="button button-primary compact"
            onClick={() => {
              if (formOpen && !editingId) resetForm();
              else openNewGuestForm();
            }}
          >
            {formOpen && !editingId
              ? "Fechar formulário"
              : "+ Adicionar convidado"}
          </button>
        </div>
      </header>
      <div className="guest-privacy-note">
        A lista e os contactos são visíveis às pessoas com acesso a este evento.
        Os ficheiros CSV incluem dados pessoais; partilha-os apenas com quem
        precisa deles.
      </div>
      <div className="guest-summary-grid">
        <article>
          <small>Convites</small>
          <strong>{guests.length}</strong>
          <span>registos na lista</span>
        </article>
        <article>
          <small>Pessoas previstas</small>
          <strong>{expectedPeople}</strong>
          <span>confirmados e respostas pendentes</span>
        </article>
        <article>
          <small>Confirmadas</small>
          <strong>{confirmedPeople}</strong>
          <span>pessoas com RSVP positivo</span>
        </article>
        <article>
          <small>Sem resposta</small>
          <strong>{pendingInvites}</strong>
          <span>convites pendentes</span>
        </article>
        <article>
          <small>Recusadas</small>
          <strong>{declinedInvites}</strong>
          <span>convites sem presença</span>
        </article>
      </div>
      {formOpen && (
        <form className="guest-entry-form" onSubmit={saveGuest}>
          <div className="guest-entry-title">
            <strong>
              {editingId ? "Editar convidado" : "Adicionar convidado"}
            </strong>
            <span>
              O limite inclui as pessoas que este convite pode confirmar.
            </span>
          </div>
          <label>
            Nome
            <input
              required
              minLength={2}
              maxLength={120}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Família ou grupo
            <input
              maxLength={100}
              value={group}
              onChange={(event) => setGroup(event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label>
            Email ou telemóvel
            <input
              maxLength={180}
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <label>
            Pessoas permitidas
            <input
              type="number"
              min="1"
              max="10"
              value={maxPartySize}
              onChange={(event) => setMaxPartySize(event.target.value)}
            />
          </label>
          <div className="guest-entry-controls">
            <button className="button button-primary compact">
              {editingId ? "Guardar alterações" : "Guardar convidado"}
            </button>
            <button
              type="button"
              className="button button-outline compact"
              onClick={resetForm}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <div className="guest-filters">
        <label>
          Pesquisar
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, email, telefone ou grupo"
          />
        </label>
        <label>
          RSVP
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
          >
            <option value="ALL">Todos os estados</option>
            <option value="PENDING">Sem resposta</option>
            <option value="ACCEPTED">Confirmados</option>
            <option value="DECLINED">Recusados</option>
          </select>
        </label>
        <label>
          Grupo
          <select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
          >
            <option value="">Todos os grupos</option>
            {groups.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Mesa
          <select
            value={tableFilter}
            onChange={(event) => setTableFilter(event.target.value)}
          >
            <option value="">Todas as mesas</option>
            <option value="UNASSIGNED">Sem mesa</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name}
              </option>
            ))}
          </select>
        </label>
        <span className="guest-filter-count">
          {filteredGuests.length} de {guests.length}
        </span>
      </div>
      <div className="guest-list" aria-live="polite">
        {filteredGuests.map((guest) => {
          const status = rsvpStatus(guest);
          const currentTable = tables.find(
            (table) => table.id === guest.seatingTableId,
          );
          return (
            <article className="guest-card" key={guest.id}>
              <div className="guest-card-main">
                <span className="guest-avatar" aria-hidden="true">
                  {guest.name.trim().slice(0, 1).toLocaleUpperCase("pt-AO")}
                </span>
                <div>
                  <div className="guest-name-line">
                    <strong>{guest.name}</strong>
                    <span
                      className={`guest-rsvp-status ${status.toLowerCase()}`}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>
                  <p>
                    {guest.groupName || "Sem grupo"}
                    {guest.email ? ` · ${guest.email}` : ""}
                    {guest.phone ? ` · ${guest.phone}` : ""}
                  </p>
                  <small>
                    {status === "ACCEPTED"
                      ? `${guest.rsvps[0].partySize} pessoa(s) confirmada(s)`
                      : status === "DECLINED"
                        ? "Não ocupa lugares nas mesas"
                        : `Até ${guest.maxPartySize} pessoa(s) · lugares reservados enquanto aguarda`}
                  </small>
                </div>
              </div>
              <div className="guest-card-table">
                <label>
                  Mesa
                  <select
                    aria-label={`Mesa de ${guest.name}`}
                    value={guest.seatingTableId || ""}
                    onChange={(event) =>
                      void assignTable(guest, event.target.value)
                    }
                  >
                    <option value="">Sem mesa</option>
                    {tables.map((table) => {
                      const seats = seatsFor(guest);
                      const usedWithout =
                        table.capacityUsed -
                        (guest.seatingTableId === table.id ? seats : 0);
                      const fits =
                        !table.capacity ||
                        usedWithout + seats <= table.capacity;
                      return (
                        <option
                          key={table.id}
                          value={table.id}
                          disabled={!fits && guest.seatingTableId !== table.id}
                        >
                          {table.name}
                          {table.capacity
                            ? ` · ${Math.max(0, table.capacity - usedWithout)} livres`
                            : ""}
                          {!fits && guest.seatingTableId !== table.id
                            ? " · sem lugares"
                            : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
                {guest.seatingTableId && !currentTable && (
                  <small className="guest-warning">Mesa já não existe</small>
                )}
              </div>
              <div className="guest-card-actions">
                <button
                  type="button"
                  onClick={() => shareRsvp(guest)}
                  disabled={!invitationSlug}
                >
                  Partilhar RSVP
                </button>
                <button
                  type="button"
                  onClick={() => void downloadQr(guest)}
                  disabled={!invitationSlug}
                >
                  QR Code
                </button>
                <button type="button" onClick={() => editGuest(guest)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="guest-remove-action"
                  onClick={() => void removeGuest(guest)}
                >
                  Remover
                </button>
              </div>
            </article>
          );
        })}
        {!filteredGuests.length && (
          <p className="empty-copy">
            {guests.length
              ? "Nenhum convidado corresponde aos filtros."
              : "A lista é privada. Adiciona convidados ou importa um ficheiro CSV para começar."}
          </p>
        )}
      </div>
      <section className="guest-table-management">
        <div className="guest-table-heading">
          <div>
            <p className="eyebrow">Distribuição</p>
            <h3>Mesas e lugares</h3>
          </div>
          <span>{tables.length} mesas</span>
        </div>
        {tables.length ? (
          <div className="guest-table-grid">
            {tables.map((table) => {
              const remaining =
                table.capacity === null
                  ? null
                  : table.capacity - table.capacityUsed;
              const percent = table.capacity
                ? Math.min(
                    100,
                    Math.round((table.capacityUsed / table.capacity) * 100),
                  )
                : 0;
              const overloaded = remaining !== null && remaining < 0;
              return (
                <article
                  className={`guest-table-card ${overloaded ? "overloaded" : ""}`}
                  key={table.id}
                >
                  <header>
                    <strong>{table.name}</strong>
                    <span>{table._count.guests} convites</span>
                  </header>
                  <div className="guest-table-capacity">
                    <span>
                      {table.capacityUsed}
                      {table.capacity ? ` / ${table.capacity}` : ""} lugares
                      ocupados
                    </span>
                    {remaining !== null && (
                      <strong>
                        {overloaded
                          ? `Excede ${Math.abs(remaining)}`
                          : `${remaining} livres`}
                      </strong>
                    )}
                  </div>
                  {table.capacity !== null && (
                    <div
                      className="guest-table-progress"
                      role="progressbar"
                      aria-valuenow={Math.max(
                        0,
                        Math.min(table.capacity, table.capacityUsed),
                      )}
                      aria-valuemin={0}
                      aria-valuemax={table.capacity}
                    >
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  )}
                  {overloaded && (
                    <small className="guest-warning">
                      Esta mesa excede a capacidade definida. Redistribui alguns
                      convites.
                    </small>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="empty-copy">
            Ainda não existem mesas. Podes criar uma abaixo.
          </p>
        )}
        <form className="guest-table-form" onSubmit={createTable}>
          <label>
            Nome da mesa
            <input
              required
              maxLength={80}
              value={tableName}
              onChange={(event) => setTableName(event.target.value)}
              placeholder="Ex.: Família da noiva"
            />
          </label>
          <label>
            Capacidade
            <input
              type="number"
              min="1"
              max="1000"
              value={tableCapacity}
              onChange={(event) => setTableCapacity(event.target.value)}
              placeholder="Opcional"
            />
          </label>
          <button className="button button-outline compact">Criar mesa</button>
        </form>
      </section>
    </section>
  );
}
