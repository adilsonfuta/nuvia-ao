"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { luandaDateInput, luandaDateToIso } from "../lib/time";
import { ListPagination } from "../lib/list-pagination";

type ProjectMember = { id: string; name: string | null; email: string };
export type TaskUpdate = {
  title: string;
  category: string;
  priority: BoardTask["priority"];
  status: BoardTask["status"];
  dueAt: string | null;
  assigneeName: string | null;
  assigneeUserId: string | null;
};

export type BoardTask = {
  id: string;
  title: string;
  dueAt: string | null;
  assigneeName: string | null;
  assigneeUserId: string | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
  status: "TODO" | "IN_PROGRESS" | "WAITING" | "DONE";
  priority: "LOW" | "NORMAL" | "HIGH";
  category: string;
};

const columns: { status: BoardTask["status"]; title: string; hint: string }[] =
  [
    { status: "TODO", title: "Por organizar", hint: "Ainda por começar" },
    {
      status: "IN_PROGRESS",
      title: "Em andamento",
      hint: "A ser tratado agora",
    },
    { status: "WAITING", title: "A aguardar", hint: "Depende de uma resposta" },
    { status: "DONE", title: "Concluído", hint: "Feito e confirmado" },
  ];

const priorityLabel = { LOW: "Baixa", NORMAL: "Normal", HIGH: "Alta" };
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("pt-AO", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Luanda",
  }).format(new Date(value));
const assigneeLabel = (task: BoardTask) =>
  task.assignedTo?.name || task.assignedTo?.email || task.assigneeName;
const assigneeKey = (task: BoardTask) =>
  task.assigneeUserId
    ? `member:${task.assigneeUserId}`
    : task.assigneeName
      ? `name:${task.assigneeName}`
      : "";
const todayLuanda = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Luanda",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const daysUntil = (value: string, today: string) =>
  Math.round(
    (Date.parse(`${value.slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${today}T00:00:00Z`)) /
      86_400_000,
  );

function deadline(task: BoardTask, today: string) {
  if (!task.dueAt || task.status === "DONE") return null;
  const days = daysUntil(task.dueAt, today);
  if (days < 0)
    return { state: "overdue", label: `Atrasada ${Math.abs(days)} d` };
  if (days === 0) return { state: "today", label: "Vence hoje" };
  if (days <= 7) return { state: "soon", label: `Vence em ${days} d` };
  return null;
}

export function TaskBoard({
  tasks,
  members,
  onMove,
  onCreate,
  onSave,
  onDelete,
  onExpense,
}: {
  tasks: BoardTask[];
  members: ProjectMember[];
  onMove: (task: BoardTask, status: BoardTask["status"]) => void;
  onCreate: (title: string, status: BoardTask["status"]) => Promise<boolean>;
  onSave: (id: string, update: TaskUpdate) => Promise<boolean>;
  onDelete: (id: string) => void;
  onExpense: (task: BoardTask) => void;
}) {
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [dueFilter, setDueFilter] = useState("all");
  const [lanePages, setLanePages] = useState<Record<string, number>>({});
  const [lanePageSizes, setLanePageSizes] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<BoardTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPriority, setEditPriority] =
    useState<BoardTask["priority"]>("NORMAL");
  const [editStatus, setEditStatus] = useState<BoardTask["status"]>("TODO");
  const [editDueAt, setEditDueAt] = useState("");
  const [editAssigneeUserId, setEditAssigneeUserId] = useState("");
  const [editAssigneeName, setEditAssigneeName] = useState("");
  const [saving, setSaving] = useState(false);
  const [creatingStatus, setCreatingStatus] = useState<
    BoardTask["status"] | null
  >(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (editing && !dialog.open) dialog.showModal();
    if (!editing && dialog.open) dialog.close();
  }, [editing]);
  const today = todayLuanda();
  const assignees = useMemo(
    () =>
      Array.from(
        new Map(
          tasks
            .filter((task) => assigneeKey(task))
            .map((task) => [
              assigneeKey(task),
              assigneeLabel(task) || "Responsável",
            ]),
        ).entries(),
      ),
    [tasks],
  );
  const categories = useMemo(
    () =>
      Array.from(new Set(tasks.map((task) => task.category))).sort((a, b) =>
        a.localeCompare(b, "pt-AO"),
      ),
    [tasks],
  );
  const overdueCount = tasks.filter(
    (task) => deadline(task, today)?.state === "overdue",
  ).length;
  const upcomingCount = tasks.filter((task) =>
    ["today", "soon"].includes(deadline(task, today)?.state || ""),
  ).length;
  function openEditor(task: BoardTask) {
    setEditTitle(task.title);
    setEditCategory(task.category);
    setEditPriority(task.priority);
    setEditStatus(task.status);
    setEditDueAt(luandaDateInput(task.dueAt));
    setEditAssigneeUserId(task.assigneeUserId || "");
    setEditAssigneeName(task.assigneeUserId ? "" : task.assigneeName || "");
    setEditing(task);
  }
  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editTitle.trim()) return;
    setSaving(true);
    const saved = await onSave(editing.id, {
      title: editTitle.trim(),
      category: editCategory,
      priority: editPriority,
      status: editStatus,
      dueAt: editDueAt ? luandaDateToIso(editDueAt) : null,
      assigneeUserId: editAssigneeUserId || null,
      assigneeName: editAssigneeUserId ? null : editAssigneeName.trim() || null,
    });
    setSaving(false);
    if (saved) setEditing(null);
  }
  async function submitCreate(
    event: FormEvent<HTMLFormElement>,
    status: BoardTask["status"],
  ) {
    event.preventDefault();
    if (!newTaskTitle.trim()) return;
    setCreating(true);
    const created = await onCreate(newTaskTitle.trim(), status);
    setCreating(false);
    if (created) {
      setNewTaskTitle("");
      setCreatingStatus(null);
    }
  }
  const filtered = tasks.filter((task) => {
    if (
      search &&
      !`${task.title} ${task.category} ${assigneeLabel(task) || ""}`
        .toLocaleLowerCase("pt-AO")
        .includes(search.toLocaleLowerCase("pt-AO"))
    )
      return false;
    if (assignee && assigneeKey(task) !== assignee) return false;
    if (category && task.category !== category) return false;
    if (priority && task.priority !== priority) return false;
    const urgency = deadline(task, today)?.state;
    if (dueFilter === "overdue" && urgency !== "overdue") return false;
    if (dueFilter === "soon" && !["today", "soon"].includes(urgency || ""))
      return false;
    if (dueFilter === "none" && task.dueAt) return false;
    return true;
  });

  return (
    <>
      <div className="task-deadline-summary" aria-live="polite">
        <span className={overdueCount ? "has-overdue" : ""}>
          {overdueCount} atrasadas
        </span>
        <span>{upcomingCount} com prazo nos próximos 7 dias</span>
      </div>
      <div className="task-board-filters" aria-label="Filtros de tarefas">
        <label>
          Pesquisar
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tarefa, categoria ou pessoa"
          />
        </label>
        <label>
          Responsável
          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option value="">Toda a equipa</option>
            {assignees.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoria
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Todas</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prioridade
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="">Todas</option>
            <option value="HIGH">Alta</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Baixa</option>
          </select>
        </label>
        <label>
          Prazo
          <select
            value={dueFilter}
            onChange={(event) => setDueFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            <option value="overdue">Atrasadas</option>
            <option value="soon">Próximos 7 dias</option>
            <option value="none">Sem prazo</option>
          </select>
        </label>
        <span className="task-filter-count">
          {filtered.length} de {tasks.length} tarefas
        </span>
      </div>
      <div className="task-board" aria-label="Quadro de tarefas">
        {columns.map((column) => {
          const items = filtered.filter(
            (task) => task.status === column.status,
          );
          const pageSize = lanePageSizes[column.status] ?? 10;
          const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
          const page = Math.min(lanePages[column.status] ?? 1, totalPages);
          const displayedItems = items.slice((page - 1) * pageSize, page * pageSize);
          return (
            <section
              className="task-board-column"
              key={column.status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const task = tasks.find(
                  (item) =>
                    item.id === event.dataTransfer.getData("text/task-id"),
                );
                if (task && task.status !== column.status)
                  onMove(task, column.status);
              }}
            >
              <header>
                <div>
                  <h3>{column.title}</h3>
                  <small>{column.hint}</small>
                </div>
                <div className="task-column-header-actions">
                  <span>{items.length}</span>
                  <button
                    type="button"
                    aria-label={`Adicionar tarefa em ${column.title}`}
                    title="Adicionar tarefa nesta coluna"
                    onClick={() => {
                      setNewTaskTitle("");
                      setCreatingStatus(
                        creatingStatus === column.status ? null : column.status,
                      );
                    }}
                  >
                    +
                  </button>
                </div>
              </header>
              {creatingStatus === column.status && (
                <form
                  className="task-quick-create"
                  onSubmit={(event) => void submitCreate(event, column.status)}
                >
                  <label htmlFor={`new-task-${column.status}`}>
                    Nova tarefa
                    <input
                      id={`new-task-${column.status}`}
                      autoFocus
                      required
                      minLength={2}
                      maxLength={180}
                      value={newTaskTitle}
                      onChange={(event) => setNewTaskTitle(event.target.value)}
                      placeholder="Escreve o título"
                    />
                  </label>
                  <div>
                    <button
                      type="button"
                      onClick={() => setCreatingStatus(null)}
                    >
                      Cancelar
                    </button>
                    <button type="submit" disabled={creating}>
                      {creating ? "A guardar…" : "Adicionar"}
                    </button>
                  </div>
                </form>
              )}
              <div className="task-board-cards">
                {displayedItems.map((task) => {
                  const due = deadline(task, today);
                  return (
                    <article
                      className={`task-card priority-${task.priority.toLowerCase()}`}
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/task-id", task.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <div className="task-card-tags">
                        <span>{task.category}</span>
                        <span>{priorityLabel[task.priority]}</span>
                      </div>
                      <h4>{task.title}</h4>
                      <div className="task-card-meta">
                        {assigneeLabel(task) && (
                          <span aria-label="Responsável">
                            ♙ {assigneeLabel(task)}
                          </span>
                        )}
                        {task.dueAt && (
                          <span aria-label="Prazo">
                            ◷ {dateLabel(task.dueAt)}
                          </span>
                        )}
                      </div>
                      {due && (
                        <span
                          className={`task-deadline-badge ${due.state}`}
                          role="status"
                        >
                          {due.label}
                        </span>
                      )}
                      <label className="task-move-label">
                        Mover para
                        <select
                          aria-label={`Mover ${task.title}`}
                          value={task.status}
                          onChange={(event) =>
                            onMove(
                              task,
                              event.target.value as BoardTask["status"],
                            )
                          }
                        >
                          {columns.map((item) => (
                            <option key={item.status} value={item.status}>
                              {item.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <footer>
                        <button type="button" onClick={() => openEditor(task)}>
                          Editar
                        </button>
                        {task.category !== "Outro" && (
                          <button type="button" onClick={() => onExpense(task)}>
                            Registar despesa
                          </button>
                        )}
                        <button type="button" onClick={() => onDelete(task.id)}>
                          Remover
                        </button>
                      </footer>
                    </article>
                  );
                })}
                {!items.length && (
                  <p className="task-board-empty">
                    {filtered.length
                      ? "Sem tarefas nesta coluna."
                      : "Nenhuma tarefa corresponde aos filtros."}
                  </p>
                )}
              </div>
              <ListPagination page={page} pageSize={pageSize} total={items.length} label="tarefas" onPageChange={(next) => setLanePages((current) => ({ ...current, [column.status]: next }))} onPageSizeChange={(size) => { setLanePageSizes((current) => ({ ...current, [column.status]: size })); setLanePages((current) => ({ ...current, [column.status]: 1 })); }} />
            </section>
          );
        })}
      </div>
      <dialog
        className="task-edit-dialog"
        ref={dialogRef}
        onClose={() => setEditing(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setEditing(null);
        }}
        aria-labelledby="task-edit-title"
      >
        {editing && (
          <form onSubmit={submitEdit}>
            <header>
              <div>
                <p className="eyebrow">Editar cartão</p>
                <h2 id="task-edit-title">Detalhes da tarefa</h2>
              </div>
              <button
                type="button"
                className="task-dialog-close"
                aria-label="Fechar"
                onClick={() => setEditing(null)}
              >
                ×
              </button>
            </header>
            <label>
              Título
              <input
                autoFocus
                required
                minLength={2}
                maxLength={180}
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </label>
            <div className="task-edit-fields">
              <label>
                Categoria
                <select
                  value={editCategory}
                  onChange={(event) => setEditCategory(event.target.value)}
                >
                  {Array.from(
                    new Set([
                      editCategory,
                      "Planeamento",
                      "Convidados",
                      "Fornecedores",
                      "Programa",
                      "Convites",
                      "Espaço",
                      "Catering",
                      "Decoração",
                      "Fotografia e vídeo",
                      "Música",
                      "Roupa e beleza",
                      "Transporte",
                      "Documentação",
                      "Outros",
                      "Outro",
                    ]),
                  )
                    .filter(Boolean)
                    .map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                </select>
              </label>
              <label>
                Prioridade
                <select
                  value={editPriority}
                  onChange={(event) =>
                    setEditPriority(event.target.value as BoardTask["priority"])
                  }
                >
                  <option value="LOW">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Alta</option>
                </select>
              </label>
              <label>
                Estado
                <select
                  value={editStatus}
                  onChange={(event) =>
                    setEditStatus(event.target.value as BoardTask["status"])
                  }
                >
                  {columns.map((item) => (
                    <option key={item.status} value={item.status}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prazo
                <input
                  type="date"
                  value={editDueAt}
                  onChange={(event) => setEditDueAt(event.target.value)}
                />
              </label>
              <label className="task-edit-assignee">
                Membro responsável
                <select
                  value={editAssigneeUserId}
                  onChange={(event) => {
                    setEditAssigneeUserId(event.target.value);
                    if (event.target.value) setEditAssigneeName("");
                  }}
                >
                  <option value="">Sem membro atribuído</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email}
                    </option>
                  ))}
                </select>
              </label>
              {!editAssigneeUserId && (
                <label className="task-edit-assignee">
                  Outro responsável
                  <input
                    maxLength={120}
                    value={editAssigneeName}
                    onChange={(event) =>
                      setEditAssigneeName(event.target.value)
                    }
                    placeholder="Nome de alguém fora da equipa"
                  />
                </label>
              )}
            </div>
            <footer>
              <button
                type="button"
                className="button button-outline compact"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </button>
              <button
                className="button button-primary compact"
                disabled={saving}
              >
                {saving ? "A guardar…" : "Guardar alterações"}
              </button>
            </footer>
          </form>
        )}
      </dialog>
    </>
  );
}
