type BrandedEmailInput = {
  preheader: string;
  title: string;
  greeting?: string;
  paragraphs: string[];
  actionLabel: string;
  actionUrl: string;
  note?: string;
};

export type RenderedEmail = { html: string; text: string };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]!));

function brandedEmail(input: BrandedEmailInput): RenderedEmail {
  const brandUrl = escapeHtml((process.env.WEB_ORIGIN || "http://localhost:3000").replace(/\/$/, ""));
  const greeting = input.greeting ? `<p style="margin:0 0 14px;color:#263b2d;font-size:15px;line-height:1.6">Olá ${escapeHtml(input.greeting)},</p>` : "";
  const paragraphs = input.paragraphs.map((paragraph) => `<p style="margin:0 0 14px;color:#536055;font-size:14px;line-height:1.7">${escapeHtml(paragraph)}</p>`).join("");
  const note = input.note ? `<p style="margin:20px 0 0;padding:12px 14px;border-radius:8px;background:#f7f4ec;color:#77796f;font-size:12px;line-height:1.6">${escapeHtml(input.note)}</p>` : "";
  const html = `<!doctype html><html lang="pt-AO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title></head><body style="margin:0;padding:0;background:#f5f3ed;font-family:Arial,Helvetica,sans-serif;color:#263b2d"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ed;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #e9e2d6;border-radius:16px;background:#fffefa;overflow:hidden"><tr><td style="padding:22px 28px;border-bottom:1px solid #eee9df"><a href="${brandUrl}" style="color:#183e2b;text-decoration:none;font-family:Georgia,serif;font-size:25px;font-weight:bold;letter-spacing:-.5px">nuvia<span style="color:#b98b37">.</span></a><div style="margin-top:5px;color:#777b70;font-size:10px;letter-spacing:.08em;text-transform:uppercase">Eventos e celebrações em Angola</div></td></tr><tr><td style="padding:30px 28px 28px"><div style="margin:0 0 10px;color:#9b742e;font-size:10px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase">Uma mensagem da Nuvia</div><h1 style="margin:0 0 20px;color:#193d2a;font-family:Georgia,serif;font-size:27px;line-height:1.2">${escapeHtml(input.title)}</h1>${greeting}${paragraphs}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0"><tr><td align="center" style="border-radius:999px;background:#204a32"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;padding:13px 22px;border:1px solid #204a32;border-radius:999px;color:#fff;text-decoration:none;font-size:14px;font-weight:bold">${escapeHtml(input.actionLabel)}</a></td></tr></table>${note}</td></tr><tr><td style="padding:18px 28px;border-top:1px solid #eee9df"><p style="margin:0;color:#85877d;font-size:11px;line-height:1.6">Recebeste esta mensagem por uma acção na Nuvia.<br>Se não esperavas este email, podes ignorá-lo.</p><p style="margin:10px 0 0;color:#9b742e;font-family:Georgia,serif;font-size:13px">Nuvia · O teu grande dia começa aqui.</p></td></tr></table><p style="margin:14px 0 0;color:#92948b;font-size:10px;line-height:1.5;text-align:center">Se o botão não abrir, copia este endereço para o navegador:<br><a href="${escapeHtml(input.actionUrl)}" style="color:#526d52;overflow-wrap:anywhere">${escapeHtml(input.actionUrl)}</a></p></td></tr></table></body></html>`;
  const text = [input.title, "", ...(input.greeting ? [`Olá ${input.greeting},`, ""] : []), ...input.paragraphs, "", `${input.actionLabel}: ${input.actionUrl}`, ...(input.note ? ["", input.note] : []), "", "Nuvia · O teu grande dia começa aqui."].join("\n");
  return { html, text };
}

export const passwordResetEmail = (name: string | null, url: string) => brandedEmail({
  preheader: "Segue o link para escolheres uma nova palavra-passe da tua conta Nuvia.",
  title: "Recupera o acesso à tua conta",
  greeting: name || undefined,
  paragraphs: ["Recebemos um pedido para alterar a palavra-passe da tua conta Nuvia.", "O link é válido durante 30 minutos e só pode ser utilizado uma vez."],
  actionLabel: "Criar nova palavra-passe",
  actionUrl: url,
  note: "Se não pediste esta alteração, ignora este email. A tua palavra-passe actual continuará válida.",
});

export const welcomeEmail = (name: string | null, url: string) => brandedEmail({
  preheader: "A tua conta Nuvia está pronta. Começa a organizar o teu evento.",
  title: "Bem-vindo à Nuvia",
  greeting: name || undefined,
  paragraphs: ["A tua conta está pronta. Podes organizar um casamento, alambamento, festa ou outra celebração num só lugar.", "Cria o teu primeiro evento e convida as pessoas que vão ajudar nos preparativos."],
  actionLabel: "Abrir a minha dashboard",
  actionUrl: url,
});

export const projectSharedEmail = (input: { recipient: string | null; inviter: string; project: string; role: string; url: string }) => brandedEmail({
  preheader: `${input.inviter} partilhou contigo um evento na Nuvia.`,
  title: "Partilharam um evento contigo",
  greeting: input.recipient || undefined,
  paragraphs: [`${input.inviter} deu-te acesso ao evento “${input.project}” na Nuvia.`, `O teu nível de acesso é: ${input.role}. Entra na tua conta para veres os detalhes e começares a colaborar.`],
  actionLabel: "Ver o evento",
  actionUrl: input.url,
  note: "O acesso está associado a este endereço de email. Entra na Nuvia com a conta que recebeu esta mensagem.",
});

export const supportReceivedEmail = (input: { name: string; subject: string; url: string }) => brandedEmail({
  preheader: "Recebemos o teu pedido de apoio e vamos acompanhá-lo.",
  title: "Recebemos o teu pedido",
  greeting: input.name,
  paragraphs: [`O pedido “${input.subject}” chegou à equipa de suporte da Nuvia.`, "Podes acompanhar o estado e consultar a resposta na área de suporte da tua conta."],
  actionLabel: "Acompanhar pedido",
  actionUrl: input.url,
});

export const supportResponseEmail = (input: { name: string; subject: string; response: string; url: string }) => brandedEmail({
  preheader: "A equipa de suporte da Nuvia respondeu ao teu pedido.",
  title: "Temos uma resposta para ti",
  greeting: input.name,
  paragraphs: [`Respondemos ao pedido “${input.subject}”.`, input.response],
  actionLabel: "Ver pedido e responder",
  actionUrl: input.url,
  note: "Podes continuar a conversa na área de suporte da tua conta.",
});

export const accountSecurityEmail = (input: { name: string | null; title: string; detail: string; url: string }) => brandedEmail({
  preheader: input.title,
  title: input.title,
  greeting: input.name || undefined,
  paragraphs: [input.detail, "Se não reconheces esta actividade, altera a palavra-passe e contacta o suporte."],
  actionLabel: "Rever a minha conta",
  actionUrl: input.url,
});

export const emailChangeVerificationEmail = (name: string | null, url: string) => brandedEmail({
  preheader: "Confirma o novo endereço de email da tua conta Nuvia.",
  title: "Confirma o teu novo email",
  greeting: name || undefined,
  paragraphs: ["Recebemos um pedido para alterar o email da tua conta Nuvia.", "Confirma o novo endereço dentro de 30 minutos. O email actual só será substituído depois desta confirmação."],
  actionLabel: "Confirmar novo email",
  actionUrl: url,
  note: "Se não pediste esta alteração, ignora esta mensagem. O endereço actual continuará associado à tua conta.",
});

export const projectAccessChangedEmail = (input: { name: string | null; actor: string; project: string; detail: string; url: string }) => brandedEmail({
  preheader: `${input.actor} actualizou o teu acesso a ${input.project}.`,
  title: "O teu acesso ao evento foi actualizado",
  greeting: input.name || undefined,
  paragraphs: [`${input.actor} actualizou o teu acesso ao evento “${input.project}”.`, input.detail],
  actionLabel: "Ver os meus eventos",
  actionUrl: input.url,
});

export const projectAccessRemovedEmail = (input: { name: string | null; actor: string; project: string; url: string }) => brandedEmail({
  preheader: `O teu acesso a ${input.project} foi removido.`,
  title: "Acesso ao evento removido",
  greeting: input.name || undefined,
  paragraphs: [`${input.actor} removeu o teu acesso ao evento “${input.project}”.`, "Se acreditas que isto aconteceu por engano, contacta a pessoa responsável pelo evento."],
  actionLabel: "Abrir os meus eventos",
  actionUrl: input.url,
});

export const guestInvitationEmail = (input: { name: string; project: string; date: string; location: string; url: string }) => brandedEmail({
  preheader: `Recebeste um convite para ${input.project}.`,
  title: "Tens um convite especial",
  greeting: input.name,
  paragraphs: [`A organização de “${input.project}” convida-te para celebrar este momento.`, `${input.date}${input.location ? ` · ${input.location}` : ""}`, "Consulta o convite e confirma a tua presença no link individual."],
  actionLabel: "Ver convite e responder",
  actionUrl: input.url,
  note: "Este link é pessoal. Não o reencaminhes; fala com a organização se precisares de actualizar os teus dados.",
});

export const eventUpdateEmail = (input: { name: string; project: string; detail: string; url: string }) => brandedEmail({
  preheader: `Há uma actualização em ${input.project}.`,
  title: "Actualização do evento",
  greeting: input.name,
  paragraphs: [`A organização de “${input.project}” actualizou informação importante.`, input.detail],
  actionLabel: "Consultar convite actualizado",
  actionUrl: input.url,
});

export const contributionNoticeEmail = (input: { name: string | null; project: string; amount?: string; status: "received" | "confirmed" | "rejected"; url: string }) => {
  const received = input.status === "received";
  const confirmed = input.status === "confirmed";
  return brandedEmail({
    preheader: received ? `Nova contribuição registada para ${input.project}.` : confirmed ? "A tua contribuição foi confirmada." : "A organização actualizou o estado da tua contribuição.",
    title: received ? "Nova contribuição recebida" : confirmed ? "Contribuição confirmada" : "Estado da contribuição actualizado",
    greeting: input.name || undefined,
    paragraphs: received
      ? [`Foi registada uma nova contribuição para “${input.project}”.`, "Entra na dashboard para rever os dados e o comprovativo, se foi enviado."]
      : [`A organização actualizou o estado da contribuição para “${input.project}”: ${confirmed ? "confirmada" : "não confirmada"}.`, input.amount ? `Valor registado: ${input.amount}.` : ""].filter(Boolean),
    actionLabel: received ? "Rever contribuição" : "Visitar a Nuvia",
    actionUrl: input.url,
    note: received ? "O comprovativo permanece privado e só pode ser consultado por membros autorizados do evento." : undefined,
  });
};

export const vendorRequestEmail = (input: { name: string | null; project: string; vendor: string; response: string | null; amount: string | null; url: string; received: boolean }) => brandedEmail({
  preheader: input.received ? `Novo pedido de orçamento para ${input.vendor}.` : `${input.vendor} respondeu ao teu pedido.`,
  title: input.received ? "Novo pedido de orçamento" : "Resposta de fornecedor recebida",
  greeting: input.name || undefined,
  paragraphs: input.received
    ? [`Recebeste um pedido para “${input.project}” através da Nuvia.`, "Consulta os detalhes na área de gestão do fornecedor e responde quando puderes."]
    : [`${input.vendor} respondeu ao pedido para “${input.project}”.`, ...(input.amount ? [`Valor proposto: ${input.amount}.`] : []), ...(input.response ? [input.response] : [])],
  actionLabel: input.received ? "Abrir pedidos" : "Ver resposta",
  actionUrl: input.url,
});

export const weeklyDigestEmail = (input: { name: string | null; summary: string[]; url: string }) => brandedEmail({
  preheader: "O resumo semanal dos teus eventos está pronto.",
  title: "Resumo semanal dos teus eventos",
  greeting: input.name || undefined,
  paragraphs: input.summary,
  actionLabel: "Abrir a dashboard",
  actionUrl: input.url,
  note: "Recebes este resumo porque activaste os emails semanais nas definições da tua conta.",
});
