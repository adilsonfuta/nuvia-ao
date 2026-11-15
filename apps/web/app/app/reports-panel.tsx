"use client";

import { luandaDateInput, luandaTodayDateInput } from "../lib/time";
import { formatAOA } from "../lib/format";
import type { BudgetExpense } from "./budget-panel";

type ReportTask = {
  id: string;
  title: string;
  category: string;
  priority: "LOW" | "NORMAL" | "HIGH";
  status: "TODO" | "IN_PROGRESS" | "WAITING" | "DONE";
  dueAt: string | null;
  assigneeName: string | null;
  assigneeUserId: string | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
};

type ReportGuest = {
  rsvps: { status: string; partySize: number }[];
};

const displayDate = (value: string) =>
  new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "medium",
    timeZone: "Africa/Luanda",
  }).format(new Date(value));

const taskStatus = (task: ReportTask) =>
  task.status === "WAITING"
    ? "A aguardar"
    : task.status === "IN_PROGRESS"
      ? "Em andamento"
      : "Por organizar";

export function ReportsPanel({
  budgetLimit,
  expenses,
  tasks,
  guests,
  onOpenBudget,
  onOpenGuests,
  onOpenTask,
  onOpenExpense,
}: {
  budgetLimit: number | string | null;
  expenses: BudgetExpense[];
  tasks: ReportTask[];
  guests: ReportGuest[];
  onOpenBudget: () => void;
  onOpenGuests: () => void;
  onOpenTask: (task: ReportTask) => void;
  onOpenExpense: (expense: BudgetExpense) => void;
}) {
  const limit = budgetLimit === null ? null : Number(budgetLimit);
  const totals = expenses.reduce(
    (result, expense) => {
      const amount = Number(expense.amount);
      if (expense.status === "ESTIMATED") result.estimated += amount;
      if (expense.status === "COMMITTED") result.committed += amount;
      if (expense.status === "PAID") result.paid += amount;
      const category = result.byCategory.get(expense.category) ?? {
        estimated: 0,
        committed: 0,
        paid: 0,
      };
      category[
        expense.status === "ESTIMATED"
          ? "estimated"
          : expense.status === "COMMITTED"
            ? "committed"
            : "paid"
      ] += amount;
      result.byCategory.set(expense.category, category);
      return result;
    },
    {
      estimated: 0,
      committed: 0,
      paid: 0,
      byCategory: new Map<
        string,
        { estimated: number; committed: number; paid: number }
      >(),
    },
  );

  // This matches the budget page: all three states count against the event limit.
  const registered = totals.estimated + totals.committed + totals.paid;
  const balance = limit === null ? null : limit - registered;
  const progress =
    limit && limit > 0
      ? Math.min(100, Math.round((registered / limit) * 100))
      : 0;
  const today = luandaTodayDateInput();
  const activeTasks = tasks.filter((task) => task.status !== "DONE");
  const overdueTasks = activeTasks
    .filter((task) => task.dueAt && luandaDateInput(task.dueAt) < today)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const upcomingTasks = activeTasks
    .filter((task) => task.dueAt && luandaDateInput(task.dueAt) >= today)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const unpaidPayments = expenses
    .filter((expense) => expense.status !== "PAID" && expense.dueAt)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const overduePayments = unpaidPayments.filter(
    (expense) => luandaDateInput(expense.dueAt) < today,
  );
  const upcomingPayments = unpaidPayments.filter(
    (expense) => luandaDateInput(expense.dueAt) >= today,
  );
  const confirmedPeople = guests.reduce(
    (total, guest) =>
      total +
      guest.rsvps
        .filter((rsvp) => rsvp.status === "ACCEPTED")
        .reduce((sum, rsvp) => sum + rsvp.partySize, 0),
    0,
  );
  const pendingInvitations = guests.filter(
    (guest) =>
      !guest.rsvps.some(
        (rsvp) => rsvp.status === "ACCEPTED" || rsvp.status === "DECLINED",
      ),
  ).length;
  const declinedInvitations = guests.filter((guest) =>
    guest.rsvps.some((rsvp) => rsvp.status === "DECLINED"),
  ).length;
  const maxCategory = Math.max(
    1,
    ...Array.from(totals.byCategory.values()).flatMap((item) => [
      item.estimated,
      item.committed,
      item.paid,
    ]),
  );

  return (
    <div className="reports-workspace">
      <section className="dash-panel wide-panel reports-finance-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Estado financeiro do evento</p>
            <h2>Orçamento e despesas</h2>
            <p className="empty-copy">
              Estimativas, contratos e pagamentos são apresentados em estados
              separados. O saldo considera todos os valores registados.
            </p>
          </div>
          <button
            type="button"
            className="button button-outline compact"
            onClick={onOpenBudget}
          >
            Abrir orçamento →
          </button>
        </div>
        {balance !== null && balance < 0 && (
          <div className="report-budget-alert" role="status">
            As despesas registadas ultrapassam o limite em{" "}
            <strong>{formatAOA(Math.abs(balance))}</strong>.
          </div>
        )}
        <div className="report-finance-grid">
          <article>
            <small>Limite do evento</small>
            <strong>{limit === null ? "Por definir" : formatAOA(limit)}</strong>
          </article>
          <article>
            <small>Estimado</small>
            <strong>{formatAOA(totals.estimated)}</strong>
          </article>
          <article>
            <small>Contratado · por pagar</small>
            <strong>{formatAOA(totals.committed)}</strong>
          </article>
          <article>
            <small>Pago</small>
            <strong>{formatAOA(totals.paid)}</strong>
          </article>
          <article
            className={balance !== null && balance < 0 ? "over" : "balance"}
          >
            <small>
              {balance !== null && balance < 0
                ? "Acima do limite"
                : "Saldo após despesas registadas"}
            </small>
            <strong>
              {balance === null ? "Define o limite" : formatAOA(balance)}
            </strong>
          </article>
        </div>
        {limit !== null && (
          <div className="report-budget-progress">
            <div>
              <span>Total registado</span>
              <strong>
                {formatAOA(registered)} · {progress}% do limite
              </strong>
            </div>
            <div
              className={balance !== null && balance < 0 ? "over" : ""}
              role="progressbar"
              aria-label="Despesas registadas face ao limite do evento"
              aria-valuemin={0}
              aria-valuemax={limit || 1}
              aria-valuenow={Math.min(registered, limit || 1)}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </section>

      <section className="dash-panel wide-panel reports-category-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Onde está o dinheiro</p>
            <h2>Despesas por categoria</h2>
            <p className="empty-copy">
              Cada coluna é independente; valores pagos não são somados aos
              contratos em aberto.
            </p>
          </div>
        </div>
        {totals.byCategory.size ? (
          <>
            <div className="report-category-head" aria-hidden="true">
              <span>Categoria</span>
              <span>Estimado</span>
              <span>Contratado</span>
              <span>Pago</span>
            </div>
            {Array.from(totals.byCategory.entries())
              .sort(
                (a, b) =>
                  b[1].estimated +
                  b[1].committed +
                  b[1].paid -
                  (a[1].estimated + a[1].committed + a[1].paid),
              )
              .map(([category, values]) => (
                <article className="report-category-row" key={category}>
                  <strong>{category}</strong>
                  <span>{formatAOA(values.estimated)}</span>
                  <span>{formatAOA(values.committed)}</span>
                  <span>{formatAOA(values.paid)}</span>
                  <div
                    className="report-category-bars"
                    aria-label={`${category}: estimado ${formatAOA(values.estimated)}, contratado ${formatAOA(values.committed)}, pago ${formatAOA(values.paid)}`}
                  >
                    <i
                      className="estimated"
                      style={{
                        width: `${(values.estimated / maxCategory) * 100}%`,
                      }}
                    />
                    <i
                      className="committed"
                      style={{
                        width: `${(values.committed / maxCategory) * 100}%`,
                      }}
                    />
                    <i
                      className="paid"
                      style={{ width: `${(values.paid / maxCategory) * 100}%` }}
                    />
                  </div>
                </article>
              ))}
            <div className="report-category-legend">
              <span>
                <i className="estimated" /> Estimado
              </span>
              <span>
                <i className="committed" /> Contratado
              </span>
              <span>
                <i className="paid" /> Pago
              </span>
            </div>
          </>
        ) : (
          <p className="empty-copy">
            Ainda não há despesas para comparar. Regista estimativas e
            pagamentos no Orçamento.
          </p>
        )}
      </section>

      <section className="dash-panel wide-panel reports-attendance-panel">
        <div className="panel-title">
          <div>
            <p className="eyebrow">Lista de convidados</p>
            <h2>Confirmações de presença</h2>
          </div>
          <button
            type="button"
            className="button button-outline compact"
            onClick={onOpenGuests}
          >
            Ver convidados →
          </button>
        </div>
        <div className="report-attendance-grid">
          <article>
            <small>Pessoas confirmadas</small>
            <strong>{confirmedPeople}</strong>
            <span>pessoas, incluindo acompanhantes confirmados</span>
          </article>
          <article>
            <small>Convites pendentes</small>
            <strong>{pendingInvitations}</strong>
            <span>convites sem resposta</span>
          </article>
          <article>
            <small>Convites recusados</small>
            <strong>{declinedInvitations}</strong>
            <span>convites com resposta negativa</span>
          </article>
        </div>
      </section>

      <div className="report-action-grid">
        <section className="dash-panel report-action-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Preparação</p>
              <h2>Tarefas com prazo</h2>
            </div>
            <span>{activeTasks.length} pendentes</span>
          </div>
          {overdueTasks.length > 0 && (
            <div className="report-alert-heading">
              Atrasadas · {overdueTasks.length}
            </div>
          )}
          {[...overdueTasks, ...upcomingTasks].slice(0, 5).length ? (
            [...overdueTasks, ...upcomingTasks].slice(0, 5).map((task) => {
              const overdue = luandaDateInput(task.dueAt) < today;
              return (
                <article
                  className={`report-action-row ${overdue ? "overdue" : ""}`}
                  key={task.id}
                >
                  <time dateTime={task.dueAt!}>{displayDate(task.dueAt!)}</time>
                  <div>
                    <strong>{task.title}</strong>
                    <small>
                      {overdue ? "Em atraso" : taskStatus(task)}
                      {task.assignedTo?.name ||
                      task.assignedTo?.email ||
                      task.assigneeName
                        ? ` · ${task.assignedTo?.name || task.assignedTo?.email || task.assigneeName}`
                        : ""}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onOpenTask(task)}
                  >
                    Abrir
                  </button>
                </article>
              );
            })
          ) : (
            <p className="empty-copy">
              Sem tarefas pendentes com prazo registado.
            </p>
          )}
        </section>

        <section className="dash-panel report-action-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">Controlo financeiro</p>
              <h2>Pagamentos por fazer</h2>
            </div>
            <button
              type="button"
              className="link-button"
              onClick={onOpenBudget}
            >
              Abrir orçamento
            </button>
          </div>
          {overduePayments.length > 0 && (
            <div className="report-alert-heading">
              Prazo ultrapassado · {overduePayments.length}
            </div>
          )}
          {unpaidPayments.slice(0, 5).length ? (
            unpaidPayments.slice(0, 5).map((expense) => {
              const overdue = luandaDateInput(expense.dueAt) < today;
              return (
                <article
                  className={`report-action-row ${overdue ? "overdue" : ""}`}
                  key={expense.id}
                >
                  <time dateTime={expense.dueAt!}>
                    {displayDate(expense.dueAt!)}
                  </time>
                  <div>
                    <strong>{expense.title}</strong>
                    <small>
                      {overdue ? "Prazo ultrapassado" : "Por pagar"} ·{" "}
                      {formatAOA(Number(expense.amount))}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onOpenExpense(expense)}
                  >
                    Abrir
                  </button>
                </article>
              );
            })
          ) : (
            <p className="empty-copy">
              Não há pagamentos pendentes com prazo registado.
            </p>
          )}
          {expenses.some(
            (expense) => expense.status !== "PAID" && !expense.dueAt,
          ) && (
            <p className="report-undated-note">
              Há despesas por pagar sem data definida. Abre o Orçamento para
              registar os prazos.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
