import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "./database";
import { EmailService } from "./email";

const WEEK = 7 * 24 * 60 * 60 * 1000;
const CLAIM_TTL = 23 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class EmailDigestWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailDigestWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), 60 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async run() {
    if (this.running || !this.email.isConfigured) return;
    this.running = true;
    try {
      const now = new Date();
      const cutoff = new Date(now.getTime() - WEEK);
      const staleClaim = new Date(now.getTime() - CLAIM_TTL);
      const users = await this.db.user.findMany({
        where: {
          weeklyDigestEnabled: true,
          OR: [{ weeklyDigestLastSentAt: null }, { weeklyDigestLastSentAt: { lt: cutoff } }],
          AND: [{ OR: [{ weeklyDigestClaimedAt: null }, { weeklyDigestClaimedAt: { lt: staleClaim } }] }],
        },
        select: { id: true, name: true, email: true, createdAt: true, weeklyDigestLastSentAt: true },
        orderBy: { id: "asc" },
        take: 100,
      });
      for (const user of users) {
        const claimed = await this.db.user.updateMany({
          where: {
            id: user.id,
            weeklyDigestEnabled: true,
            AND: [
              { OR: [{ weeklyDigestLastSentAt: null }, { weeklyDigestLastSentAt: { lt: cutoff } }] },
              { OR: [{ weeklyDigestClaimedAt: null }, { weeklyDigestClaimedAt: { lt: staleClaim } }] },
            ],
          },
          data: { weeklyDigestClaimedAt: now },
        });
        if (!claimed.count) continue;
        await this.sendDigest(user, now).catch((error) => {
          this.logger.warn(`Weekly digest failed for account ${user.id}: ${error instanceof Error ? error.name : "unknown error"}.`);
        });
      }
    } catch (error) {
      this.logger.error(`Weekly digest scan failed: ${error instanceof Error ? error.name : "unknown error"}.`);
    } finally {
      this.running = false;
    }
  }

  private async sendDigest(user: { id: string; name: string | null; email: string; createdAt: Date; weeklyDigestLastSentAt: Date | null }, now: Date) {
    const since = user.weeklyDigestLastSentAt ?? user.createdAt;
    const projectRows = await this.db.eventProject.findMany({
      where: { archivedAt: null, members: { some: { userId: user.id } } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    });
    const projectIds = projectRows.map(({ id }) => id);
    const finishWithoutEmail = async () => this.db.user.updateMany({ where: { id: user.id, weeklyDigestEnabled: true }, data: { weeklyDigestLastSentAt: now, weeklyDigestClaimedAt: null } });
    if (!projectIds.length) {
      await finishWithoutEmail();
      return;
    }
    const weekEnd = new Date(now.getTime() + WEEK);
    const [tasks, rsvps, guestRows, contributions, quotes] = await Promise.all([
      this.db.task.findMany({
        where: { projectId: { in: projectIds }, status: { not: "DONE" }, dueAt: { lte: weekEnd } },
        select: { id: true, title: true, dueAt: true, projectId: true },
        orderBy: [{ dueAt: "asc" }, { projectId: "asc" }],
        take: 100,
      }),
      this.db.rSVP.findMany({
        where: { eventKey: "all", updatedAt: { gte: since }, guest: { projectId: { in: projectIds } } },
        select: { status: true, updatedAt: true },
      }),
      this.db.guest.findMany({
        where: { projectId: { in: projectIds } },
        select: { maxPartySize: true, rsvps: { where: { eventKey: "all" }, select: { status: true, partySize: true } } },
      }),
      this.db.eventContribution.findMany({
        where: { campaign: { projectId: { in: projectIds } }, OR: [{ createdAt: { gte: since } }, { reviewedAt: { gte: since } }] },
        select: { status: true, amount: true, createdAt: true, reviewedAt: true },
      }),
      this.db.quoteRequest.findMany({
        where: { projectId: { in: projectIds }, OR: [{ createdAt: { gte: since } }, { respondedAt: { gte: since } }] },
        select: { status: true, createdAt: true, respondedAt: true },
      }),
    ]);
    const paragraphs: string[] = [];
    const overdue = tasks.filter((task) => task.dueAt && task.dueAt < now).length;
    const dueSoon = tasks.filter((task) => task.dueAt && task.dueAt >= now).length;
    if (overdue) paragraphs.push(`${overdue} tarefa(s) com prazo ultrapassado precisam da tua atenção.`);
    if (dueSoon) paragraphs.push(`${dueSoon} tarefa(s) têm prazo nos próximos 7 dias.`);
    const accepted = guestRows.reduce((sum, guest) => sum + (guest.rsvps[0]?.status === "ACCEPTED" ? guest.rsvps[0].partySize : 0), 0);
    const pending = guestRows.reduce((sum, guest) => sum + (!guest.rsvps[0] || guest.rsvps[0].status === "PENDING" ? guest.maxPartySize : 0), 0);
    const declined = guestRows.filter((guest) => guest.rsvps[0]?.status === "DECLINED").length;
    if (rsvps.length) paragraphs.push(`${accepted} pessoas confirmadas, ${pending} pessoas em convites pendentes e ${declined} convites recusados. ${rsvps.length} resposta(s) RSVP actualizadas nesta semana.`);
    const pendingContributions = contributions.filter((item) => item.status === "PENDING").length;
    const reviewedContributions = contributions.filter((item) => item.status !== "PENDING");
    const confirmedAmount = reviewedContributions.filter((item) => item.status === "CONFIRMED").reduce((sum, item) => sum + Number(item.amount), 0);
    const amountLabel = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(confirmedAmount);
    if (contributions.length) paragraphs.push(`${contributions.length} contribuição(ões) novas ou revistas; ${pendingContributions} aguardam confirmação e ${reviewedContributions.length} já foram revistas. Confirmado nesta semana: ${amountLabel}.`);
    const respondedQuotes = quotes.filter((item) => item.respondedAt && item.respondedAt >= since).length;
    const newQuotes = quotes.filter((item) => item.createdAt >= since && (item.status === "NEW" || item.status === "SENT")).length;
    if (respondedQuotes || newQuotes) paragraphs.push(`${respondedQuotes} resposta(s) de fornecedores e ${newQuotes} pedido(s) recente(s) ainda sem resposta.`);
    if (!paragraphs.length) {
      await finishWithoutEmail();
      return;
    }
    const weekKey = new Date(Math.floor(now.getTime() / WEEK) * WEEK).toISOString().slice(0, 10);
    const sent = await this.email.sendWeeklyDigest(user.email, user.name, paragraphs, `${user.id}/${weekKey}`);
    if (sent) await finishWithoutEmail();
  }
}
