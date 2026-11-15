import Planner from './planner';

export const metadata = { title: 'Começar um projecto | Nuvia' };

export default function PlanearPage() {
  return <main className="planner-page">
    <a className="planner-back" href="/">← Voltar ao início</a>
    <div className="planner-shell"><p className="eyebrow">O teu projecto começa aqui</p><h1>Que evento estás a organizar?</h1><p className="planner-intro">Escolhe casamento, alambamento, festa ou outro evento. Podes rever as respostas mais tarde.</p><Planner/></div>
  </main>;
}
