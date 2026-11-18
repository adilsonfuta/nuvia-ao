import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import {
  passwordResetEmail,
  projectSharedEmail,
  supportReceivedEmail,
  supportResponseEmail,
  welcomeEmail,
} from "./email-templates";

type EmailContent = { subject: string; html: string; text: string };

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  private readonly from = process.env.RESEND_FROM_EMAIL?.trim() ?? "";
  private readonly resend = this.apiKey ? new Resend(this.apiKey) : null;

  get isConfigured() {
    return Boolean(this.apiKey && this.from);
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

  sendWelcome(to: string, name: string | null, url: string, userId: string) {
    return this.send(to, { subject: "Bem-vindo à Nuvia", ...welcomeEmail(name, url) }, `welcome/${userId}`);
  }

  sendPasswordReset(to: string, name: string | null, url: string, tokenId: string) {
    return this.send(to, { subject: "Recupera o acesso à tua conta Nuvia", ...passwordResetEmail(name, url) }, `password-reset/${tokenId}`);
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
