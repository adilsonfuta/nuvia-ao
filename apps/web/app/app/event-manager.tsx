import type { ProjectKind, ProjectSummary } from "@casar/contracts";
import { formatAOA } from "../lib/format";

type Project = ProjectSummary;

const kinds: Record<ProjectKind, { label: string; icon: string }> = {
  WEDDING: { label: "Casamento", icon: "♡" },
  ALAMBAMENTO: { label: "Alambamento", icon: "✦" },
  PARTY: { label: "Festa", icon: "✧" },
  OTHER: { label: "Outro evento", icon: "◈" },
};
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("pt-AO", {
        dateStyle: "long",
        timeZone: "Africa/Luanda",
      }).format(new Date(value))
    : "Data por definir";

export function EventManager({
  projects,
  activeId,
  onOpen,
  onCreate,
  onRestore,
  restoringId,
}: {
  projects: Project[];
  activeId: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onRestore: (id: string) => void;
  restoringId: string;
}) {
  return (
    <section className="event-manager-page">
      <header className="event-manager-heading">
        <div>
          <p className="eyebrow">A tua organização</p>
          <h1>Os meus eventos</h1>
          <p>
            Escolhe o projecto que queres gerir. Cada evento tem o seu próprio
            plano, orçamento e convidados.
          </p>
        </div>
        <button className="button button-primary compact" onClick={onCreate}>
          + Novo evento
        </button>
      </header>
      {projects.length ? (
        <div className="event-manager-grid">
          {projects.map((project) => (
            <article
              className={`event-manager-card ${project.id === activeId ? "active" : ""} ${project.archivedAt ? "archived" : ""}`}
              key={project.id}
            >
              <div className={`project-kind-badge ${project.kind}`}>
                <span aria-hidden="true">{kinds[project.kind].icon}</span>
                {kinds[project.kind].label}
              </div>
              <h2>{project.title}</h2>
              {project.archivedAt && (
                <span className="event-archived-badge">Evento arquivado</span>
              )}
              <p className="event-manager-meta">
                {date(project.date)}
                {project.province ? ` · ${project.province}` : ""}
              </p>
              <div className="event-manager-facts">
                {project.guestEstimate && (
                  <span>
                    {project.guestEstimate.toLocaleString("pt-AO")}{" "}
                    participantes estimados
                  </span>
                )}
                {project.budgetLimit != null && (
                  <span>Limite {formatAOA(project.budgetLimit)}</span>
                )}
              </div>
              <footer>
                {!project.archivedAt && project.id === activeId && (
                  <span className="active-project-label">Evento aberto</span>
                )}
                {project.archivedAt ? (
                  project.currentRole === "OWNER" ? (
                    <button
                      className="button button-outline compact"
                      disabled={restoringId === project.id}
                      onClick={() => onRestore(project.id)}
                    >
                      {restoringId === project.id ? "A restaurar…" : "Restaurar evento"}
                    </button>
                  ) : (
                    <span className="archived-event-help">
                      Pede à pessoa responsável para restaurar este evento.
                    </span>
                  )
                ) : (
                  <button
                    className="button button-outline compact"
                    onClick={() => onOpen(project.id)}
                  >
                    {project.id === activeId ? "Abrir painel" : "Gerir evento"} →
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="event-manager-empty">
          <p>Ainda não criaste projectos de evento.</p>
          <button className="button button-primary compact" onClick={onCreate}>
            Criar o primeiro evento
          </button>
        </div>
      )}
    </section>
  );
}
