'use client';

import { FormEvent, useState } from 'react';
import { formatAOA } from '../lib/format';
import { luandaDateInput, luandaDateToIso } from '../lib/time';
import './budget-panel.css';

export type BudgetPayment = {
  id: string;
  title: string;
  amount: number | string;
  dueAt: string | null;
  status: 'PENDING' | 'PAID';
  paidAt: string | null;
};

export type BudgetExpense = {
  id: string;
  title: string;
  category: string;
  amount: number | string;
  status: 'ESTIMATED' | 'COMMITTED' | 'PAID';
  dueAt: string | null;
  taskId: string | null;
  task: { id: string; title: string } | null;
  quoteRequest?: { id: string; vendor: { name: string } } | null;
  payments: BudgetPayment[];
};

const categories = ['Espaço','Catering','Decoração','Fotografia e vídeo','Música','Roupa e beleza','Transporte','Convites','Documentação','Outros'];
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const displayDate = (value: string) => new Intl.DateTimeFormat('pt-AO', { dateStyle: 'medium', timeZone: 'Africa/Luanda' }).format(new Date(value));
const statusLabels = { ESTIMATED: 'Prevista', COMMITTED: 'Contratada', PAID: 'Paga' };

export function BudgetPanel({
  limit, expenses, tasks, title, setTitle, category, setCategory, amount, setAmount, status, setStatus, dueAt, setDueAt, taskId, setTaskId, editingId, onSubmit, onCancel, onEdit, onDelete, onOpenTask, onSetLimit, onAddPayment, onUpdatePayment, onDeletePayment,
}: {
  limit: number | string | null;
  expenses: BudgetExpense[];
  tasks: { id: string; title: string }[];
  title: string; setTitle: (value: string) => void;
  category: string; setCategory: (value: string) => void;
  amount: string; setAmount: (value: string) => void;
  status: 'ESTIMATED' | 'COMMITTED' | 'PAID'; setStatus: (value: 'ESTIMATED' | 'COMMITTED' | 'PAID') => void;
  dueAt: string; setDueAt: (value: string) => void;
  taskId: string; setTaskId: (value: string) => void;
  editingId: string; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void; onEdit: (expense: BudgetExpense) => void; onDelete: (id: string) => void;
  onOpenTask: (id: string) => void; onSetLimit: () => void;
  onAddPayment: (expenseId: string, payment: { title: string; amount: number; dueAt: string | null }) => Promise<void>;
  onUpdatePayment: (expenseId: string, paymentId: string, update: { status: 'PENDING' | 'PAID' }) => Promise<void>;
  onDeletePayment: (expenseId: string, paymentId: string) => Promise<void>;
}) {
  const paidAmount = (expense: BudgetExpense) => expense.status === 'PAID'
    ? Number(expense.amount)
    : expense.payments.reduce((sum, payment) => sum + (payment.status === 'PAID' ? Number(payment.amount) : 0), 0);
  const totals = expenses.reduce((result, expense) => {
    const value = Number(expense.amount);
    if (expense.status === 'ESTIMATED') result.estimated += value;
    if (expense.status !== 'ESTIMATED') {
      const paid = paidAmount(expense);
      result.committed += Math.max(0, value - paid);
      result.paid += paid;
    }
    const group = result.byCategory.get(expense.category) ?? { estimated: 0, spent: 0 };
    if (expense.status === 'ESTIMATED') group.estimated += value;
    else group.spent += Math.max(0, value - paidAmount(expense)) + paidAmount(expense);
    result.byCategory.set(expense.category, group);
    return result;
  }, { estimated: 0, committed: 0, paid: 0, byCategory: new Map<string, { estimated: number; spent: number }>() });
  const totalRegistered = totals.estimated + totals.committed + totals.paid;
  const limitValue = limit === null ? null : Number(limit);
  const balance = limitValue === null ? null : limitValue - totalRegistered;
  const progress = limitValue && limitValue > 0 ? Math.min(100, Math.round(totalRegistered / limitValue * 100)) : 0;
  const maxCategoryValue = Math.max(1, ...Array.from(totals.byCategory.values()).flatMap((item) => [item.estimated, item.spent]));
  const allCategories = Array.from(new Set([...categories, ...totals.byCategory.keys()]));
  const todayValue = today();
  const overdue = (expense: BudgetExpense) => Boolean(expense.dueAt && expense.status !== 'PAID' && expense.dueAt.slice(0, 10) < todayValue);
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, { title: string; amount: string; dueAt: string }>>({});
  const [paymentBusyId, setPaymentBusyId] = useState('');
  const [paymentError, setPaymentError] = useState('');

  async function addPayment(event: FormEvent<HTMLFormElement>, expense: BudgetExpense) {
    event.preventDefault();
    const draft = paymentDrafts[expense.id];
    if (!draft?.title.trim() || !draft.amount) return;
    setPaymentBusyId(expense.id); setPaymentError('');
    try {
      await onAddPayment(expense.id, { title: draft.title.trim(), amount: Number(draft.amount), dueAt: draft.dueAt ? luandaDateToIso(draft.dueAt) : null });
      setPaymentDrafts(current => ({ ...current, [expense.id]: { title: '', amount: '', dueAt: '' } }));
    } catch (error) { setPaymentError(error instanceof Error ? error.message : 'Não foi possível registar a prestação.'); }
    finally { setPaymentBusyId(''); }
  }

  async function updatePayment(expense: BudgetExpense, payment: BudgetPayment) {
    setPaymentBusyId(payment.id); setPaymentError('');
    try { await onUpdatePayment(expense.id, payment.id, { status: payment.status === 'PAID' ? 'PENDING' : 'PAID' }); }
    catch (error) { setPaymentError(error instanceof Error ? error.message : 'Não foi possível actualizar a prestação.'); }
    finally { setPaymentBusyId(''); }
  }

  async function deletePayment(expense: BudgetExpense, payment: BudgetPayment) {
    if (!window.confirm(`Remover a prestação “${payment.title}”?`)) return;
    setPaymentBusyId(payment.id); setPaymentError('');
    try { await onDeletePayment(expense.id, payment.id); }
    catch (error) { setPaymentError(error instanceof Error ? error.message : 'Não foi possível remover a prestação.'); }
    finally { setPaymentBusyId(''); }
  }

  return <div className="budget-module">
    <section className={`budget-summary ${balance !== null && balance < 0 ? 'over-budget' : ''}`} aria-label="Resumo do orçamento">
      <div className="budget-summary-heading"><div><p className="eyebrow">Controlo financeiro</p><h2>Resumo do orçamento</h2></div>{balance !== null && balance < 0 && <span className="budget-alert" role="status">Previsão acima do limite em {formatAOA(Math.abs(balance))}</span>}</div>
      <div className="budget-summary-grid">
        <article><small>Limite do evento</small><strong>{limitValue === null ? 'Por definir' : formatAOA(limitValue)}{limitValue === null && <button type="button" className="budget-define-link" onClick={onSetLimit}>Definir limite</button>}</strong></article>
        <article><small>Estimado</small><strong>{formatAOA(totals.estimated)}</strong></article>
        <article><small>Contratado</small><strong>{formatAOA(totals.committed)}</strong></article>
        <article><small>Pago</small><strong>{formatAOA(totals.paid)}</strong></article>
        <article className="budget-balance"><small>{balance !== null && balance < 0 ? 'Previsão acima do limite' : 'Saldo após despesas registadas'}</small><strong>{balance === null ? 'Define um limite' : formatAOA(balance)}</strong></article>
      </div>
      {limitValue !== null && <div className="budget-progress-block"><div><span>Total das despesas registadas</span><strong>{formatAOA(totalRegistered)} · {progress}% do limite</strong></div><div className="budget-progress" role="progressbar" aria-label="Despesas registadas face ao limite do orçamento" aria-valuemin={0} aria-valuemax={limitValue || 1} aria-valuenow={Math.min(totalRegistered, limitValue || 1)}><span style={{ width: `${progress}%` }}/></div></div>}
    </section>

    <section className="budget-category-panel" aria-labelledby="budget-categories-title">
      <div className="budget-section-heading"><div><p className="eyebrow">Onde está o dinheiro</p><h3 id="budget-categories-title">Despesas por categoria</h3></div><div className="budget-legend"><span><i className="estimated-key"/>Estimado</span><span><i className="spent-key"/>Contratado ou pago</span></div></div>
      {Array.from(totals.byCategory.entries()).sort((a, b) => (b[1].estimated + b[1].spent) - (a[1].estimated + a[1].spent)).map(([name, item]) => <article className="budget-category-row" key={name}>
        <div className="budget-category-label"><strong>{name}</strong><small>Estimado {formatAOA(item.estimated)} <span>·</span> Contratado/pago {formatAOA(item.spent)}</small></div>
        <div className="budget-category-bars" aria-label={`${name}: estimado ${formatAOA(item.estimated)}, contratado ou pago ${formatAOA(item.spent)}`}><span className="estimated-bar" style={{ width: `${item.estimated / maxCategoryValue * 100}%` }}/><span className="spent-bar" style={{ width: `${item.spent / maxCategoryValue * 100}%` }}/></div>
      </article>)}
      {!totals.byCategory.size && <p className="empty-copy">Regista despesas para comparar estimativas com valores contratados ou pagos.</p>}
    </section>

    <section className="budget-expenses-panel" aria-labelledby="expenses-title">
      <div className="budget-section-heading"><div><p className="eyebrow">Registos do evento</p><h3 id="expenses-title">Despesas</h3></div><span>{expenses.length} {expenses.length === 1 ? 'registo' : 'registos'}</span></div>
      <form className="budget-entry-form" onSubmit={onSubmit}>
        <label className="budget-entry-title">Descrição<input required minLength={2} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Sinal do espaço"/></label>
        <label>Categoria<select value={category} onChange={(event) => setCategory(event.target.value)}>{allCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Valor (Kz)<input required type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0"/></label>
        <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="ESTIMATED">Prevista</option><option value="COMMITTED">Contratada</option><option value="PAID">Paga</option></select></label>
        <label>Prazo de pagamento<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)}/></label>
        <label className="budget-entry-task">Tarefa relacionada<select value={taskId} onChange={(event) => setTaskId(event.target.value)}><option value="">Sem tarefa ligada</option>{tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select></label>
        <div className="budget-entry-actions"><button className="button button-primary compact">{editingId ? 'Guardar alterações' : 'Registar despesa'}</button>{editingId && <button type="button" className="button button-outline compact" onClick={onCancel}>Cancelar</button>}</div>
      </form>
      {expenses.length ? <>
        <div className="budget-expense-table-wrap"><table className="budget-expense-table"><thead><tr><th>Despesa</th><th>Categoria</th><th>Estado</th><th>Prazo</th><th>Valor</th><th>Tarefa</th><th>Acções</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}>
          <td data-label="Despesa"><strong>{expense.title}</strong>{expense.quoteRequest && <small className="budget-vendor-line">Fornecedor: {expense.quoteRequest.vendor.name}</small>}</td><td data-label="Categoria">{expense.category}</td>
          <td data-label="Estado"><span className={`expense-status ${expense.status.toLowerCase()}`}>{statusLabels[expense.status]}</span></td>
          <td data-label="Prazo">{expense.dueAt ? <span className={overdue(expense) ? 'expense-overdue' : ''}>{displayDate(expense.dueAt)}{overdue(expense) && <small>Atrasada</small>}</span> : '—'}</td>
          <td data-label="Valor" className="expense-amount">{formatAOA(Number(expense.amount))}</td>
          <td data-label="Tarefa">{expense.task ? <button type="button" className="budget-task-link" onClick={() => onOpenTask(expense.task!.id)}>{expense.task.title} ↗</button> : '—'}</td>
          <td data-label="Acções"><div className="budget-row-actions"><button type="button" onClick={() => onEdit(expense)}>Editar</button><button type="button" onClick={() => onDelete(expense.id)}>Remover</button></div></td>
        </tr>)}</tbody></table></div>
        <div className="budget-expense-cards">{expenses.map((expense) => <article className="budget-expense-card" key={expense.id}>
          <header><strong>{expense.title}</strong><span className={`expense-status ${expense.status.toLowerCase()}`}>{statusLabels[expense.status]}</span></header>
          <div className="budget-expense-card-meta"><span>{expense.category}</span><strong>{formatAOA(Number(expense.amount))}</strong></div>
          {expense.quoteRequest && <p className="budget-vendor-line">Fornecedor: {expense.quoteRequest.vendor.name}</p>}
          {expense.dueAt && <p className={overdue(expense) ? 'expense-overdue' : ''}>Prazo: {displayDate(expense.dueAt)}{overdue(expense) && ' · Atrasada'}</p>}
          {expense.task && <button type="button" className="budget-task-link" onClick={() => onOpenTask(expense.task!.id)}>Tarefa: {expense.task.title} ↗</button>}
          <footer><button type="button" onClick={() => onEdit(expense)}>Editar</button><button type="button" onClick={() => onDelete(expense.id)}>Remover</button></footer>
        </article>)}</div>
        {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
        <section className="budget-payment-plans" aria-label="Planos de pagamento das despesas">
          <div className="budget-section-heading"><div><p className="eyebrow">Sinais e prestações</p><h3>Plano de pagamentos</h3></div></div>
          {expenses.map((expense) => {
            const payments = expense.payments ?? [];
            const paid = paidAmount(expense);
            const remaining = Math.max(0, Number(expense.amount) - paid);
            const draft = paymentDrafts[expense.id] ?? { title: '', amount: '', dueAt: '' };
            return <details className="budget-payment-expense" key={expense.id}>
              <summary><span><strong>{expense.title}</strong><small>{payments.length ? `${payments.filter(item => item.status === 'PAID').length} de ${payments.length} prestações pagas` : 'Sem prestações registadas'}</small></span><span><strong>{formatAOA(remaining)}</strong><small>por pagar</small></span></summary>
              {payments.length > 0 && <div className="budget-payment-list">{payments.map(payment => <article key={payment.id}>
                <div><strong>{payment.title}</strong><small>{payment.dueAt ? `Prazo · ${displayDate(payment.dueAt)}` : 'Sem prazo definido'}{payment.paidAt ? ` · Pago · ${displayDate(payment.paidAt)}` : ''}</small></div>
                <strong>{formatAOA(Number(payment.amount))}</strong>
                <span className={`expense-status ${payment.status === 'PAID' ? 'paid' : 'committed'}`}>{payment.status === 'PAID' ? 'Pago' : 'Por pagar'}</span>
                <div className="budget-row-actions"><button type="button" disabled={Boolean(paymentBusyId)} onClick={() => void updatePayment(expense, payment)}>{paymentBusyId === payment.id ? 'A guardar…' : payment.status === 'PAID' ? 'Reabrir' : 'Marcar pago'}</button>{payment.status === 'PENDING' && <button type="button" disabled={Boolean(paymentBusyId)} onClick={() => void deletePayment(expense, payment)}>Remover</button>}</div>
              </article>)}</div>}
              {expense.status !== 'PAID' && <form className="budget-payment-form" onSubmit={event => void addPayment(event, expense)}>
                <label>Descrição<input required minLength={2} maxLength={120} value={draft.title} onChange={event => setPaymentDrafts(current => ({ ...current, [expense.id]: { ...draft, title: event.target.value } }))} placeholder="Ex.: Sinal"/></label>
                <label>Valor (Kz)<input required type="number" min="0.01" step="any" value={draft.amount} onChange={event => setPaymentDrafts(current => ({ ...current, [expense.id]: { ...draft, amount: event.target.value } }))} placeholder="0"/></label>
                <label>Data de pagamento<input type="date" value={draft.dueAt} onChange={event => setPaymentDrafts(current => ({ ...current, [expense.id]: { ...draft, dueAt: event.target.value } }))}/></label>
                <button className="button button-outline compact" disabled={paymentBusyId === expense.id}>{paymentBusyId === expense.id ? 'A guardar…' : 'Adicionar prestação'}</button>
              </form>}
            </details>;
          })}
        </section>
      </> : <p className="empty-copy budget-empty">Ainda não há despesas. Regista uma estimativa, contrato ou pagamento para acompanhar o orçamento.</p>}
    </section>
  </div>;
}
