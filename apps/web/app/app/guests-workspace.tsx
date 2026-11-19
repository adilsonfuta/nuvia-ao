"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "../lib/api";
import { ListPagination, useListPage } from "../lib/list-pagination";

type Guest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  groupName: string | null;
  maxPartySize: number;
  seatingTableId: string | null;
  rsvpToken: string;
  invitationSentAt?: string | null;
  rsvps: { status: string; partySize: number; source?: "PUBLIC_LINK" | "MANUAL" }[];
};
type GuestRequest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  contactChannels: ("WHATSAPP" | "PHONE" | "EMAIL")[];
  partySize: number;
  requestedRsvp: "ACCEPTED" | "DECLINED";
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  createdAt: string;
};
type GuestRequestPage = { items: GuestRequest[]; total: number; pendingCount: number; page: number; pageSize: number };
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
const COMMON_GUEST_GROUPS = [
  "Família",
  "Amigos",
  "Colegas de trabalho",
  "Colegas de estudo",
  "Padrinhos e madrinhas",
  "Vizinhos",
  "Comunidade",
  "Convidados da família",
];
function whatsAppNumber(value: string | null | undefined) {
  let digits = (value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = digits.slice(1);
  if (digits.length === 9) digits = `244${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? digits : "";
}

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
const guestContactChannelLabel: Record<GuestRequest["contactChannels"][number], string> = {
  WHATSAPP: "WhatsApp",
  PHONE: "Chamada/SMS",
  EMAIL: "Email",
};
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
  canEdit,
  onRefresh,
  onNotice,
  onError,
}: {
  projectId: string;
  guests: Guest[];
  tables: Table[];
  invitationSlug?: string;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [workspaceView, setWorkspaceView] = useState<"guests" | "requests">("guests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [groupFilter, setGroupFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [guestPage, setGuestPage] = useState(1);
  const [guestPageSize, setGuestPageSize] = useState(10);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [group, setGroup] = useState("");
  const [customGroupName, setCustomGroupName] = useState("");
  const [maxPartySize, setMaxPartySize] = useState("1");
  const [tableName, setTableName] = useState("");
  const [tableCapacity, setTableCapacity] = useState("");
  const [editingTableId, setEditingTableId] = useState("");
  const [manualRsvpGuestId, setManualRsvpGuestId] = useState("");
  const [manualRsvpStatus, setManualRsvpStatus] = useState<"ACCEPTED" | "DECLINED">("ACCEPTED");
  const [manualRsvpPartySize, setManualRsvpPartySize] = useState("1");
  const [savingManualRsvp, setSavingManualRsvp] = useState(false);
  const [selectedForWhatsApp, setSelectedForWhatsApp] = useState<string[]>([]);
  const [whatsAppBatch, setWhatsAppBatch] = useState<Guest[]>([]);
  const [whatsAppBatchIndex, setWhatsAppBatchIndex] = useState(0);
  const [origin, setOrigin] = useState("");
  const whatsAppEligibleGuests = guests.filter((guest) => Boolean(invitationSlug && whatsAppNumber(guest.phone)));
  const allWhatsAppEligibleSelected = whatsAppEligibleGuests.length > 0 && whatsAppEligibleGuests.every((guest) => selectedForWhatsApp.includes(guest.id));
  const selectedWhatsAppGuests = guests.filter((guest) => selectedForWhatsApp.includes(guest.id) && Boolean(whatsAppNumber(guest.phone)));
  const batchGuest = whatsAppBatch[whatsAppBatchIndex];
  useEffect(() => setOrigin(window.location.origin), []);
  const [importing, setImporting] = useState(false);
  const [sendingGuestId, setSendingGuestId] = useState("");
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
          [
            ...COMMON_GUEST_GROUPS,
            ...guests
              .map((guest) => guest.groupName)
              .filter((value): value is string => Boolean(value)),
          ],
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
  const { pageItems: displayedGuests } = useListPage(filteredGuests, guestPage, guestPageSize);
  const { pageItems: displayedTables } = useListPage(tables, tablePage, tablePageSize);

  function resetForm() {
    setFormOpen(false);
    setEditingId("");
    setName("");
    setContact("");
    setGroup("");
    setCustomGroupName("");
    setMaxPartySize("1");
  }

  function openNewGuestForm() {
    setEditingId("");
    setName("");
    setContact("");
    setGroup("");
    setCustomGroupName("");
    setMaxPartySize("1");
    setFormOpen(true);
  }

  function editGuest(guest: Guest) {
    setEditingId(guest.id);
    setName(guest.name);
    setContact(guest.email || guest.phone || "");
    setGroup(guest.groupName || "");
    setCustomGroupName("");
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
            groupName: (group === "__other__" ? customGroupName.trim() : group) || null,
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

  function openManualRsvp(guest: Guest) {
    const existing = guest.rsvps[0];
    setManualRsvpGuestId(guest.id);
    setManualRsvpStatus(existing?.status === "DECLINED" ? "DECLINED" : "ACCEPTED");
    setManualRsvpPartySize(String(existing?.status === "ACCEPTED" ? existing.partySize : 1));
  }

  async function saveManualRsvp(event: FormEvent<HTMLFormElement>, guest: Guest) {
    event.preventDefault();
    setSavingManualRsvp(true);
    try {
      await api(`/projects/${projectId}/guests/${guest.id}/rsvp`, {
        method: "PATCH",
        body: JSON.stringify({ status: manualRsvpStatus, partySize: manualRsvpStatus === "ACCEPTED" ? Number(manualRsvpPartySize) : undefined }),
      });
      setManualRsvpGuestId("");
      await onRefresh();
      onNotice(manualRsvpStatus === "ACCEPTED" ? "Presença confirmada manualmente." : "Resposta registada manualmente.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Não foi possível registar a resposta.");
    } finally {
      setSavingManualRsvp(false);
    }
  }

  function whatsappUrl(guest: Guest) {
    if (!invitationSlug || !origin) return "";
    const phone = whatsAppNumber(guest.phone);
    if (!phone) return "";
    const link = `${origin}/c/${invitationSlug}?token=${encodeURIComponent(guest.rsvpToken)}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(`Olá ${guest.name}, este é o teu convite pessoal para o nosso evento: ${link}`)}`;
  }

  function toggleWhatsAppGuest(guestId: string) {
    setSelectedForWhatsApp((current) => current.includes(guestId) ? current.filter((id) => id !== guestId) : [...current, guestId]);
  }

  function startWhatsAppBatch() {
    const invalidSelected = guests.filter((guest) => selectedForWhatsApp.includes(guest.id) && !whatsAppNumber(guest.phone)).length;
    if (!selectedWhatsAppGuests.length) {
      onError("Selecciona convidados com um número de WhatsApp válido.");
      return;
    }
    setWhatsAppBatch(selectedWhatsAppGuests);
    setWhatsAppBatchIndex(0);
    setSelectedForWhatsApp([]);
    if (invalidSelected) onNotice(`${invalidSelected} convidado(s) sem telefone válido ficaram fora da fila.`);
  }

  function closeWhatsAppBatch() {
    setWhatsAppBatch([]);
    setWhatsAppBatchIndex(0);
  }

  function editTable(table: Table) {
    setEditingTableId(table.id);
    setTableName(table.name);
    setTableCapacity(table.capacity === null ? "" : String(table.capacity));
    requestAnimationFrame(() => document.getElementById("guest-table-name")?.focus());
  }

  function cancelTableEdit() {
    setEditingTableId("");
    setTableName("");
    setTableCapacity("");
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api(`/projects/${projectId}/tables${editingTableId ? `/${editingTableId}` : ""}`, {
        method: editingTableId ? "PATCH" : "POST",
        body: JSON.stringify({
          name: tableName,
          capacity: tableCapacity ? Number(tableCapacity) : null,
        }),
      });
      const wasEditing = Boolean(editingTableId);
      cancelTableEdit();
      await onRefresh();
      onNotice(wasEditing ? "Mesa actualizada." : "Mesa criada.");
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

  function previewRsvp(guest: Guest) {
    if (!invitationSlug) return;
    const link = `/c/${invitationSlug}?token=${encodeURIComponent(guest.rsvpToken)}`;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function emailInvitation(guest: Guest) {
    if (!invitationSlug || !guest.email || sendingGuestId) return;
    setSendingGuestId(guest.id);
    try {
      const result = await api<{ sent: number; message: string }>(`/projects/${projectId}/invitations/send`, {
        method: "POST",
        body: JSON.stringify({ guestIds: [guest.id] }),
      });
      if (!result.sent) throw new Error(result.message);
      await onRefresh();
      onNotice(result.message);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Não foi possível enviar o convite por email.");
    } finally {
      setSendingGuestId("");
    }
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
          {whatsAppEligibleGuests.length > 1 && <button type="button" className="button button-outline compact" onClick={() => setSelectedForWhatsApp(allWhatsAppEligibleSelected ? [] : whatsAppEligibleGuests.map((guest) => guest.id))}>{allWhatsAppEligibleSelected ? "Limpar selecção" : `Seleccionar WhatsApp (${whatsAppEligibleGuests.length})`}</button>}
          {selectedWhatsAppGuests.length > 0 && <button type="button" className="button button-primary compact" onClick={startWhatsAppBatch}>WhatsApp · {selectedWhatsAppGuests.length}</button>}
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
      <nav className="guest-workspace-tabs" aria-label="Gestão de convidados">
        <button type="button" className={workspaceView === "guests" ? "active" : ""} aria-pressed={workspaceView === "guests"} onClick={() => setWorkspaceView("guests")}>Lista de convidados</button>
        <button type="button" className={workspaceView === "requests" ? "active" : ""} aria-pressed={workspaceView === "requests"} onClick={() => setWorkspaceView("requests")}>
          Pedidos de inclusão
          {invitationSlug && <GuestRequestCount projectId={projectId} />}
        </button>
      </nav>
      {workspaceView === "requests" ? (
        <GuestRequestsPanel projectId={projectId} onRefresh={onRefresh} onNotice={onNotice} onError={onError} />
      ) : <>
      {whatsAppBatch.length > 0 && batchGuest && <section className="guest-whatsapp-batch" aria-live="polite"><div><p className="eyebrow">Envio em lote · {whatsAppBatchIndex + 1} de {whatsAppBatch.length}</p><strong>{batchGuest.name}</strong><span>{batchGuest.phone} · esta pessoa recebe o seu link RSVP individual.</span><small>Abre esta conversa, envia a mensagem no WhatsApp e volta aqui para continuar com o próximo convidado.</small></div><div className="guest-whatsapp-batch-actions"><a className="button button-primary compact" href={whatsappUrl(batchGuest)} target="_blank" rel="noreferrer">Abrir WhatsApp ↗</a><button type="button" className="button button-outline compact" onClick={() => whatsAppBatchIndex + 1 < whatsAppBatch.length ? setWhatsAppBatchIndex((index) => index + 1) : closeWhatsAppBatch()}>{whatsAppBatchIndex + 1 < whatsAppBatch.length ? "Próximo convidado →" : "Concluir"}</button><button type="button" className="guest-whatsapp-cancel" onClick={closeWhatsAppBatch}>Cancelar</button></div></section>}
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
            <select
              value={group}
              onChange={(event) => setGroup(event.target.value)}
            >
              <option value="">Sem grupo</option>
              {COMMON_GUEST_GROUPS.map((item) => <option key={item} value={item}>{item}</option>)}
              {groups.filter((item) => !COMMON_GUEST_GROUPS.includes(item)).map((item) => <option key={item} value={item}>{item}</option>)}
              <option value="__other__">+ Criar outro grupo…</option>
            </select>
            {group === "__other__" && <input maxLength={100} required autoFocus value={customGroupName} onChange={(event) => setCustomGroupName(event.target.value)} placeholder="Nome do novo grupo" />}
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
        {displayedGuests.map((guest) => {
          const status = rsvpStatus(guest);
          const currentTable = tables.find(
            (table) => table.id === guest.seatingTableId,
          );
          return (
            <article className="guest-card" key={guest.id}>
              <div className="guest-card-main">
                <input type="checkbox" className="guest-whatsapp-select" aria-label={`Seleccionar ${guest.name} para partilha por WhatsApp`} checked={selectedForWhatsApp.includes(guest.id)} onChange={() => toggleWhatsAppGuest(guest.id)} disabled={!invitationSlug || !whatsAppNumber(guest.phone)} title={!whatsAppNumber(guest.phone) ? "Adiciona um número de telefone válido" : "Adicionar à fila de WhatsApp"}/>
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
                    {guest.rsvps[0]?.source === "MANUAL" && <span className="guest-manual-source">Manual</span>}
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
                <button type="button" onClick={() => void emailInvitation(guest)} disabled={!invitationSlug || !guest.email || Boolean(sendingGuestId)}>
                  {sendingGuestId === guest.id ? "A enviar…" : guest.invitationSentAt ? "Reenviar email" : "Enviar convite por email"}
                </button>
                <button
                  type="button"
                  onClick={() => shareRsvp(guest)}
                  disabled={!invitationSlug}
                >
                  Partilhar RSVP
                </button>
                {whatsappUrl(guest) ? <a className="guest-whatsapp-button" href={whatsappUrl(guest)} target="_blank" rel="noreferrer">WhatsApp</a> : <button type="button" disabled title="Adiciona um número de WhatsApp válido para este convidado">WhatsApp</button>}
                <button type="button" onClick={() => previewRsvp(guest)} disabled={!invitationSlug}>
                  Pré-visualizar RSVP
                </button>
                {canEdit && <button type="button" onClick={() => manualRsvpGuestId === guest.id ? setManualRsvpGuestId("") : openManualRsvp(guest)}>{status === "PENDING" ? "Registar resposta" : "Alterar presença"}</button>}
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
              {canEdit && manualRsvpGuestId === guest.id && <form className="guest-manual-rsvp" onSubmit={(event) => void saveManualRsvp(event, guest)}><strong>Resposta confirmada pela organização</strong><label>Presença<select value={manualRsvpStatus} onChange={(event) => setManualRsvpStatus(event.target.value as "ACCEPTED" | "DECLINED")}><option value="ACCEPTED">Vai estar presente</option><option value="DECLINED">Não poderá estar presente</option></select></label>{manualRsvpStatus === "ACCEPTED" && <label>Pessoas confirmadas<input type="number" min="1" max={guest.maxPartySize} value={manualRsvpPartySize} onChange={(event) => setManualRsvpPartySize(event.target.value)} /></label>}<small>Fica registado no histórico como uma resposta manual.</small><div><button className="button button-primary compact" disabled={savingManualRsvp}>{savingManualRsvp ? "A guardar…" : "Guardar resposta"}</button><button type="button" className="button button-outline compact" onClick={() => setManualRsvpGuestId("")}>Cancelar</button></div></form>}
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
      <ListPagination page={guestPage} pageSize={guestPageSize} total={filteredGuests.length} label="convidados" onPageChange={setGuestPage} onPageSizeChange={(size) => { setGuestPageSize(size); setGuestPage(1); }} />
      <section className="guest-table-management">
        <div className="guest-table-heading">
          <div>
            <p className="eyebrow">Distribuição</p>
            <h3>Mesas e lugares</h3>
          </div>
          <span>{tables.length} mesas</span>
        </div>
        {tables.length ? (
          <><div className="guest-table-grid">
            {displayedTables.map((table) => {
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
                    <div className="guest-table-card-actions"><span>{table._count.guests} convites</span><button type="button" onClick={() => editTable(table)}>Editar</button></div>
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
          <ListPagination page={tablePage} pageSize={tablePageSize} total={tables.length} label="mesas" onPageChange={setTablePage} onPageSizeChange={(size) => { setTablePageSize(size); setTablePage(1); }} />
          </>
        ) : (
          <p className="empty-copy">
            Ainda não existem mesas. Podes criar uma abaixo.
          </p>
        )}
        <form className="guest-table-form" onSubmit={createTable}>
          <label>
            {editingTableId ? "Editar nome da mesa" : "Nome da mesa"}
            <input
              id="guest-table-name"
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
          <div className="guest-table-form-actions">
            {editingTableId && <button type="button" className="button button-outline compact" onClick={cancelTableEdit}>Cancelar</button>}
            <button className="button button-outline compact">{editingTableId ? "Guardar alterações" : "Criar mesa"}</button>
          </div>
        </form>
      </section>
      </>}
    </section>
  );
}

function GuestRequestCount({ projectId }: { projectId: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    api<GuestRequestPage>(`/projects/${projectId}/guest-requests?page=1`).then((result) => {
      if (active) setCount(result.pendingCount);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [projectId]);
  return count ? <span className="guest-request-count">{count}</span> : null;
}

function GuestRequestsPanel({ projectId, onRefresh, onNotice, onError }: {
  projectId: string;
  onRefresh: () => Promise<void>;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [result, setResult] = useState<GuestRequestPage | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [busyId, setBusyId] = useState("");
  const load = async (nextPage = page, nextPageSize = pageSize) => {
    try { setResult(await api<GuestRequestPage>(`/projects/${projectId}/guest-requests?page=${nextPage}&pageSize=${nextPageSize}`)); }
    catch (error) { onError(error instanceof Error ? error.message : "Não foi possível carregar os pedidos."); }
  };
  useEffect(() => { void load(1); setPage(1); }, [projectId]);
  async function decide(request: GuestRequest, action: "approve" | "reject" | "revoke") {
    setBusyId(request.id);
    try {
      const response = await api<{ invitationSent?: boolean }>(`/projects/${projectId}/guest-requests/${request.id}/${action}`, { method: "POST" });
      await load(page);
      if (action === "approve") onNotice(response.invitationSent ? "Pedido aprovado e convite individual enviado por email." : "Pedido aprovado e adicionado à lista de convidados.");
      else if (action === "reject") onNotice("Pedido recusado.");
      else onNotice("Inclusão revogada e convite removido da lista.");
      if (action !== "reject") await onRefresh();
    } catch (error) { onError(error instanceof Error ? error.message : "Não foi possível actualizar o pedido."); }
    finally { setBusyId(""); }
  }
  const requests = result?.items ?? [];
  return (
    <section className="guest-request-workspace">
      <header className="guest-request-heading">
        <div><p className="eyebrow">Revisão da lista</p><h3>Pedidos de inclusão</h3><p>{result?.pendingCount ?? "…"} por analisar · os pedidos só entram nas contagens depois de aprovados.</p></div>
      </header>
      {requests.length ? <div className="guest-request-list">
        {requests.map((request) => <article className="guest-request-card" key={request.id}>
          <div className="guest-request-main"><div className="guest-request-title"><strong>{request.name}</strong><span className={`guest-request-status ${request.status.toLowerCase()}`}>{request.status === "PENDING" ? "Por analisar" : request.status === "APPROVED" ? "Aprovado" : request.status === "REJECTED" ? "Recusado" : "Revogado"}</span></div>
            <p>{request.contactChannels?.length ? request.contactChannels.map((channel) => guestContactChannelLabel[channel]).join(" · ") : "Preferência de contacto não indicada"} · {new Intl.DateTimeFormat("pt-AO", { dateStyle: "medium", timeZone: "Africa/Luanda" }).format(new Date(request.createdAt))}</p>
            {(request.email || request.phone) && <div className="guest-request-contact-details">
              {request.contactChannels?.includes("EMAIL") && request.email && <a href={`mailto:${request.email}`}>{request.email}</a>}
              {request.contactChannels?.includes("PHONE") && request.phone && <a href={`tel:${request.phone}`}>{request.phone}</a>}
              {request.contactChannels?.includes("WHATSAPP") && request.phone && (() => {
                const number = whatsAppNumber(request.phone);
                return number ? <a href={`https://wa.me/${number}?text=${encodeURIComponent(`Olá ${request.name}, estamos a dar seguimento ao teu pedido para participar no evento.`)}`} target="_blank" rel="noreferrer">Abrir conversa no WhatsApp ↗</a> : <span>{request.phone}</span>;
              })()}
            </div>}
            <small>{request.requestedRsvp === "ACCEPTED" ? `Pretende participar${request.partySize > 1 ? ` com ${request.partySize - 1} acompanhante(s)` : ""}.` : "Indicou que não poderá estar presente."}{request.note ? ` Nota: ${request.note}` : ""}</small>
          </div>
          <div className="guest-request-actions">
            {request.status === "PENDING" ? <>
              <button type="button" className="approve" disabled={Boolean(busyId)} onClick={() => void decide(request, "approve")}>{busyId === request.id ? "A actualizar…" : "Aprovar"}</button>
              <button type="button" className="reject" disabled={Boolean(busyId)} onClick={() => void decide(request, "reject")}>Recusar</button>
            </> : request.status === "APPROVED" ? <button type="button" className="reject" disabled={Boolean(busyId)} onClick={() => void decide(request, "revoke")}>{busyId === request.id ? "A actualizar…" : "Revogar inclusão"}</button> : null}
          </div>
        </article>)}
        <ListPagination page={page} pageSize={result?.pageSize ?? pageSize} total={result?.total ?? 0} label="pedidos" onPageChange={(next) => { setPage(next); void load(next); }} onPageSizeChange={(size) => { setPageSize(size); setPage(1); void load(1, size); }} />
      </div> : <div className="guest-request-empty"><strong>{result ? "Ainda não há pedidos de inclusão" : "A carregar pedidos…"}</strong><p>Quando alguém enviar os seus dados pelo convite, poderás aprovar ou recusar aqui.</p></div>}
      <p className="guest-privacy-note">Os dados de contacto enviados são privados e ficam visíveis apenas às pessoas com acesso ao evento. Ao aprovar, o convidado é adicionado à lista e recebe o link individual por email, quando indicado.</p>
    </section>
  );
}
