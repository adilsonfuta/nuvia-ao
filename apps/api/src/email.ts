import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { DatabaseService } from "./database";
import {
  accountSecurityEmail,
  contributionNoticeEmail,
  emailChangeVerificationEmail,
  eventUpdateEmail,
  guestInvitationEmail,
  passwordResetEmail,
  projectAccessChangedEmail,
  projectAccessRemovedEmail,
  projectSharedEmail,
  supportReceivedEmail,
  supportResponseEmail,
  vendorRequestEmail,
  welcomeEmail,
  weeklyDigestEmail,
} from "./email-templates";

type EmailContent = { subject: string; html: string; text: string };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly enabled = process.env.RESEND_ENABLED?.trim().toLowerCase() === "true";
  private readonly apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  private readonly from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  private readonly resend = this.enabled && this.apiKey ? new Resend(this.apiKey) : null;

  constructor(private readonly db: DatabaseService) {}

  get isConfigured() {
    return this.enabled && Boolean(this.apiKey && this.from);
  }

  private async send(to: string, content: EmailContent, idempotencyKey: string): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      const result = await this.resend!.emails.send(
        {
          from: this.from,
          to: [to],
          subject: content.subject.replace(/[\r\n\u0000-\u001f]+/g, " ").slice(0, 180),
          html: content.html,
          text: content.text,
        },
        { idempotencyKey: idempotencyKey.slice(0, 256) },
      );
      if (result.error) {
        this.logger.warn(`Resend rejected an email request (${result.error.name}).`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Could not reach Resend: ${error instanceof Error ? error.name : "unknown error"}.`);
      return false;
    }
  }

  private async sendToUser(userId: string, content: EmailContent, key: string, security = false) {
    const recipient = await this.db.user.findUnique({ where: { id: userId }, select: { email: true, emailEventNotifications: true } });
    if (!recipient || (!security && !recipient.emailEventNotifications)) return false;
    return this.send(recipient.email, content, key);
  }

  private async sendToProjectMembers(projectId: string, content: EmailContent, key: string, excludeUserId?: string) {
    const members = await this.db.projectMember.findMany({ where: { projectId, ...(excludeUserId ? { userId: { not: excludeUserId } } : {}) }, select: { userId: true } });
    const results = await Promise.all(members.map(({ userId }) => this.sendToUser(userId, content, `${key}/${userId}`)));
    return results.filter(Boolean).length;
  }

  sendWelcome(to: string, name: string | null, url: string, userId: string) {
    return this.send(to, { subject: "Bem-vindo à Nuvia", ...welcomeEmail(name, url) }, `welcome/${userId}`);
  }

  sendPasswordReset(to: string, name: string | null, url: string, tokenId: string) {
    return this.send(to, { subject: "Recupera o acesso à tua conta Nuvia", ...passwordResetEmail(name, url) }, `password-reset/${tokenId}`);
  }

  sendPasswordChanged(to: string, name: string | null, key: string) {
    return this.send(to, { subject: "A palavra-passe da tua conta Nuvia foi alterada", ...accountSecurityEmail({ name, title: "Palavra-passe alterada", detail: "A palavra-passe da tua conta Nuvia foi alterada com sucesso.", url: `${webOrigin()}/dashboard?tab=definicoes` }) }, `password-changed/${key}`);
  }

  sendNewLogin(to: string, name: string | null, occurredAt: Date, key: string) {
    const when = new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Luanda" }).format(occurredAt);
    return this.send(to, { subject: "Novo acesso à tua conta Nuvia", ...accountSecurityEmail({ name, title: "Novo acesso à tua conta", detail: `Foi detectado um acesso num navegador diferente em ${when} (hora de Luanda).`, url: `${webOrigin()}/dashboard?tab=definicoes` }) }, `new-login/${key}`);
  }

  sendEmailChangeVerification(to: string, name: string | null, url: string, key: string) {
    return this.send(to, { subject: "Confirma o novo email da tua conta Nuvia", ...emailChangeVerificationEmail(name, url) }, `email-change-verify/${key}`);
  }

  sendEmailChanged(to: string, name: string | null, changedAddress: string, key: string) {
    return this.send(to, { subject: "O email da tua conta Nuvia foi alterado", ...accountSecurityEmail({ name, title: "Email da conta alterado", detail: `O endereço de email da tua conta Nuvia foi alterado para ${changedAddress}.`, url: `${webOrigin()}/entrar` }) }, `email-changed/${key}`);
  }

  sendEmailChangeRequested(to: string, name: string | null, key: string) {
    return this.send(to, { subject: "Pedido para alterar o email da tua conta Nuvia", ...accountSecurityEmail({ name, title: "Pedido de alteração de email", detail: "Foi pedido que o email da tua conta Nuvia fosse alterado. A alteração só será concluída depois de confirmar o novo endereço.", url: `${webOrigin()}/entrar` }) }, `email-change-requested/${key}`);
  }

  sendMemberAccessChanged(input: { to: string; name: string | null; actor: string; project: string; projectId: string; detail: string; key: string }) {
    return this.send(input.to, { subject: `Acesso actualizado: ${input.project}`, ...projectAccessChangedEmail({ name: input.name, actor: input.actor, project: input.project, detail: input.detail, url: `${webOrigin()}/dashboard?tab=eventos&event=${encodeURIComponent(input.projectId)}` }) }, `project-access/${input.key}`);
  }

  sendMemberAccessRemoved(input: { to: string; name: string | null; actor: string; project: string; projectId: string; key: string }) {
    return this.send(input.to, { subject: `Acesso removido: ${input.project}`, ...projectAccessRemovedEmail({ name: input.name, actor: input.actor, project: input.project, url: `${webOrigin()}/dashboard?tab=eventos` }) }, `project-access-removed/${input.key}`);
  }

  sendGuestInvitation(input: { to: string; name: string; project: string; date: string; location: string; url: string; key: string }) {
    return this.send(input.to, { subject: `Convite: ${input.project}`, ...guestInvitationEmail(input) }, `guest-invitation/${input.key}`);
  }

  sendEventUpdate(input: { to: string; name: string; project: string; detail: string; url: string; key: string }) {
    return this.send(input.to, { subject: `Actualização: ${input.project}`, ...eventUpdateEmail(input) }, `event-update/${input.key}`);
  }

  async sendContributionReceived(projectId: string, project: string, amount: number, key: string) {
    const content = { subject: `Nova contribuição para ${project}`, ...contributionNoticeEmail({ name: null, project, amount: new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(amount), status: "received", url: `${webOrigin()}/dashboard?tab=contributions&event=${encodeURIComponent(projectId)}` }) };
    return this.sendToProjectMembers(projectId, content, `contribution-received/${key}`);
  }

  sendContributionDecision(input: { to: string; name: string | null; project: string; amount: number; confirmed: boolean; key: string }) {
    const amount = new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(input.amount);
    return this.send(input.to, { subject: input.confirmed ? "Contribuição confirmada" : "Estado da contribuição actualizado", ...contributionNoticeEmail({ name: input.name, project: input.project, amount, status: input.confirmed ? "confirmed" : "rejected", url: `${webOrigin()}/` }) }, `contribution-decision/${input.key}`);
  }

  sendVendorInquiry(input: { userId: string; name: string | null; project: string; vendor: string; key: string }) {
    return this.sendToUser(input.userId, { subject: `Novo pedido para ${input.vendor}`, ...vendorRequestEmail({ ...input, response: null, amount: null, url: `${webOrigin()}/fornecedor/gestao?tab=pedidos`, received: true }) }, `vendor-inquiry/${input.key}`);
  }

  sendVendorResponse(input: { userId: string; name: string | null; projectId: string; project: string; vendor: string; response: string | null; amount: number | null; key: string }) {
    const amount = input.amount === null ? null : new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(input.amount);
    return this.sendToUser(input.userId, { subject: `Resposta de ${input.vendor}`, ...vendorRequestEmail({ ...input, amount, url: `${webOrigin()}/dashboard?tab=fornecedores&event=${encodeURIComponent(input.projectId)}`, received: false }) }, `vendor-response/${input.key}`);
  }

  sendWeeklyDigest(to: string, name: string | null, summary: string[], key: string) {
    return this.send(to, { subject: "O resumo semanal dos teus eventos na Nuvia", ...weeklyDigestEmail({ name, summary, url: `${webOrigin()}/dashboard` }) }, `weekly-digest/${key}`);
  }

  sendProjectShared(to: string, input: { recipient: string | null; inviter: string; project: string; role: string; url: string }, key: string) {
    return this.send(to, { subject: `${input.inviter} partilhou um evento contigo`, ...projectSharedEmail(input) }, `project-share/${key}`);
  }

  sendSupportReceived(to: string, input: { name: string; subject: string; url: string }, key: string) {
    return this.send(to, { subject: "Recebemos o teu pedido de apoio", ...supportReceivedEmail(input) }, `support-received/${key}`);
  }

  sendSupportResponse(to: string, input: { name: string; subject: string; response: string; url: string }, key: string) {
    return this.send(to, { subject: `Resposta da Nuvia: ${input.subject}`, ...supportResponseEmail(input) }, `support-response/${key}`);
  }
}

export const webOrigin = () => (process.env.WEB_ORIGIN || "http://localhost:3000").replace(/\/$/, "");
