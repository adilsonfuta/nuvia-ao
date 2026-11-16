import { config } from 'dotenv';
import { PrismaClient } from '@casar/database';
import bcrypt from 'bcryptjs';

config({ path: new URL('../../.env', import.meta.url) });

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error('Define SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD no .env antes de criar a conta.');
}
if (password.length < 12) {
  throw new Error('SEED_ADMIN_PASSWORD precisa de pelo menos 12 caracteres.');
}
if (Buffer.byteLength(password, 'utf8') > 72) {
  throw new Error('SEED_ADMIN_PASSWORD não pode exceder 72 bytes (limite do bcrypt).');
}

const db = new PrismaClient();
try {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } })
    ?? await db.user.findUnique({ where: { email: 'admin@localhost' }, select: { id: true, role: true } });
  if (existing) {
    const account = await db.user.findUnique({ where: { id: existing.id }, select: { email: true, passwordHash: true } });
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      throw new Error('A conta já existe e a palavra-passe configurada não corresponde. Nenhum email ou papel foi alterado.');
    }
    const wasLegacyAddress = account.email !== email;
    if (wasLegacyAddress || existing.role !== 'ADMIN') {
      await db.user.update({ where: { id: existing.id }, data: { email, role: 'ADMIN' } });
    }
    console.log(JSON.stringify({ action: wasLegacyAddress ? 'email-updated' : existing.role === 'ADMIN' ? 'already-admin' : 'promoted', email }));
  } else {
    await db.user.create({
      data: {
        email,
        name: 'Administrador',
        passwordHash: await bcrypt.hash(password, 12),
        role: 'ADMIN',
      },
    });
    console.log(JSON.stringify({ action: 'created', email }));
  }
} finally {
  await db.$disconnect();
}
