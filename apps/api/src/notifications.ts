import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { NotificationType } from "@casar/database";
import { CurrentUser, SessionGuard, SessionUser } from "./auth";
import { DatabaseService } from "./database";

type NotificationDetails = {
  type: NotificationType;
  key: string;
  sourceId?: string;
  title: string;
  body: string;
  href: string;
};

export async function notifyProjectMembers(
  db: DatabaseService,
  projectId: string,
  details: NotificationDetails,
  excludeUserId?: string,
) {
  const members = await db.projectMember.findMany({
    where: { projectId, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) },
    select: { userId: true },
  });
  if (!members.length) return;
  await db.notification.createMany({
    data: members.map(({ userId }) => ({
      ...details,
      userId,
      projectId,
    })),
    skipDuplicates: true,
  });
}

export async function notifyUser(
  db: DatabaseService,
  userId: string,
  projectId: string,
  details: NotificationDetails,
) {
  await db.notification.upsert({
    where: { userId_key: { userId, key: details.key } },
    create: { ...details, userId, projectId },
    update: {},
  });
}

export async function dismissSourceNotifications(
  db: DatabaseService,
  projectId: string,
  type: NotificationType,
  sourceId: string,
) {
  await db.notification.updateMany({
    where: { projectId, type, sourceId, readAt: null },
    data: { readAt: new Date() },
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dateLabel = (date: Date) =>
  new Intl.DateTimeFormat("pt-AO", {
    dateStyle: "medium",
    timeZone: "Africa/Luanda",
  }).format(date);

function deadlineMessage(date: Date, now: Date) {
  if (date.getTime() < now.getTime()) return "O prazo passou";
  const days = Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
  if (days <= 1) return "O prazo é hoje";
  if (days === 2) return "O prazo é amanhã";
  return `O prazo é daqui a ${days} dias`;
}

@ApiTags("Notificações")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async list(@CurrentUser() user: SessionUser) {
    const memberships = await this.db.projectMember.findMany({
      where: { userId: user.id, project: { archivedAt: null } },
      select: { projectId: true },
    });
    const projectIds = memberships.map((membership) => membership.projectId);

    if (projectIds.length) {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 3 * DAY_MS);
      const staleBefore = new Date(now.getTime() - 14 * DAY_MS);
      const [tasks, expenses] = await Promise.all([
        this.db.task.findMany({
          where: {
            projectId: { in: projectIds },
            status: { not: "DONE" },
            dueAt: { gte: staleBefore, lte: windowEnd },
            project: { archivedAt: null },
          },
          select: { id: true, title: true, dueAt: true, projectId: true },
        }),
        this.db.expense.findMany({
          where: {
            projectId: { in: projectIds },
            status: "COMMITTED",
            dueAt: { gte: staleBefore, lte: windowEnd },
            project: { archivedAt: null },
          },
          select: { id: true, title: true, dueAt: true, projectId: true },
        }),
      ]);

      for (const task of tasks) {
        if (!task.dueAt) continue;
        const phase = task.dueAt < now ? "overdue" : "upcoming";
        const key = `task-due:${task.id}:${task.dueAt.toISOString()}:${phase}`;
        await this.db.notification.updateMany({
          where: {
            userId: user.id,
            type: "TASK_DUE",
            sourceId: task.id,
            readAt: null,
            key: { not: key },
          },
          data: { readAt: now },
        });
        await this.db.notification.upsert({
          where: { userId_key: { userId: user.id, key } },
          create: {
            userId: user.id,
            projectId: task.projectId,
            type: "TASK_DUE",
            key,
            sourceId: task.id,
            title: task.dueAt < now ? "Tarefa atrasada" : "Prazo de tarefa próximo",
            body: `${task.title} · ${deadlineMessage(task.dueAt, now)} (${dateLabel(task.dueAt)}).`,
            href: `/dashboard?tab=planeamento&event=${encodeURIComponent(task.projectId)}`,
          },
          update: {},
        });
      }

      for (const expense of expenses) {
        if (!expense.dueAt) continue;
        const phase = expense.dueAt < now ? "overdue" : "upcoming";
        const key = `expense-due:${expense.id}:${expense.dueAt.toISOString()}:${phase}`;
        await this.db.notification.updateMany({
          where: {
            userId: user.id,
            type: "EXPENSE_DUE",
            sourceId: expense.id,
            readAt: null,
            key: { not: key },
          },
          data: { readAt: now },
        });
        await this.db.notification.upsert({
          where: { userId_key: { userId: user.id, key } },
          create: {
            userId: user.id,
            projectId: expense.projectId,
            type: "EXPENSE_DUE",
            key,
            sourceId: expense.id,
            title: expense.dueAt < now ? "Pagamento atrasado" : "Pagamento próximo",
            body: `${expense.title} · ${deadlineMessage(expense.dueAt, now)} (${dateLabel(expense.dueAt)}).`,
            href: `/dashboard?tab=orcamento&event=${encodeURIComponent(expense.projectId)}`,
          },
          update: {},
        });
      }
    }

    const visibleProjectScope = {
      userId: user.id,
      projectId: { in: projectIds },
    };
    const [items, unreadCount] = await Promise.all([
      this.db.notification.findMany({
        where: visibleProjectScope,
        include: { project: { select: { title: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      this.db.notification.count({ where: { ...visibleProjectScope, readAt: null } }),
    ]);
    return { items, unreadCount };
  }

  @Patch(":id/read")
  async markRead(@Param("id") id: string, @CurrentUser() user: SessionUser) {
    await this.db.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  @Patch("read-all")
  async markAllRead(@CurrentUser() user: SessionUser) {
    const result = await this.db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, count: result.count };
  }
}
