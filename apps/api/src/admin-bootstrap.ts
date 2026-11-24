import { AccountStatus, UserRole } from "@casar/database";
import { compare, hash } from "bcryptjs";
import { DatabaseService } from "./database";

/** Create the initial administrator from deployment secrets, without depending on a one-off CLI. */
export async function bootstrapAdminFromEnvironment(db: DatabaseService) {
  const configuredEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!configuredEmail && !password) {
    console.info("Admin bootstrap ignorado: SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD não configurados.");
    return;
  }
  if (!configuredEmail || !password) {
    throw new Error("Configura SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD em conjunto para criar o administrador inicial.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)) {
    throw new Error("SEED_ADMIN_EMAIL tem de ser um endereço de email válido.");
  }
  if (password.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD precisa de pelo menos 12 caracteres.");
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("SEED_ADMIN_PASSWORD não pode exceder 72 bytes (limite do bcrypt).");
  }

  const existing = await db.user.findUnique({ where: { email: configuredEmail } });
  if (existing) {
    // Once an administrator exists, normal password changes must not prevent future deploys.
    if (existing.role === UserRole.ADMIN) {
      console.info(`Admin bootstrap: a conta ${configuredEmail} já é administradora.`);
      return;
    }
    if (!(await compare(password, existing.passwordHash))) {
      console.warn(`Admin bootstrap: ${configuredEmail} já tem uma conta, mas a palavra-passe não corresponde; o papel não foi alterado.`);
      return;
    }
    await db.user.update({ where: { id: existing.id }, data: { role: UserRole.ADMIN } });
    console.info(`Admin bootstrap: papel de administrador confirmado para ${configuredEmail}.`);
    return;
  }

  try {
    await db.user.create({
      data: {
        email: configuredEmail,
        name: "Administrador",
        passwordHash: await hash(password, 12),
        role: UserRole.ADMIN,
        accountStatus: AccountStatus.ACTIVE,
      },
    });
    console.info(`Admin bootstrap: conta administrativa criada para ${configuredEmail}.`);
  } catch (error) {
    // A second API replica may create the same account concurrently during first startup.
    if ((error as { code?: string })?.code !== "P2002") throw error;
    const concurrentAccount = await db.user.findUnique({ where: { email: configuredEmail } });
    if (!concurrentAccount || !(await compare(password, concurrentAccount.passwordHash))) throw error;
    if (concurrentAccount.role !== UserRole.ADMIN) {
      await db.user.update({ where: { id: concurrentAccount.id }, data: { role: UserRole.ADMIN } });
    }
    console.info(`Admin bootstrap: conta administrativa confirmada para ${configuredEmail}.`);
  }
}
