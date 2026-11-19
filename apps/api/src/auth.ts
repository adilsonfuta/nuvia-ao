import { Body, createParamDecorator, ExecutionContext, Injectable, Post, Req, Res, UnauthorizedException, ForbiddenException, UseGuards, Controller, Get, ConflictException, Delete, BadRequestException, ServiceUnavailableException, Patch } from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { DatabaseService } from './database';
import { EmailService, webOrigin } from './email';

export class RegisterDto {
  @IsEmail() @MaxLength(180) email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
}
export class LoginDto {
  @IsEmail() @MaxLength(180) email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
export class ChangePasswordDto { @IsString() @MinLength(8) @MaxLength(128) currentPassword!:string; @IsString() @MinLength(8) @MaxLength(128) newPassword!:string }
export class DeleteAccountDto { @IsString() @MinLength(8) @MaxLength(128) password!:string; @IsString() @MinLength(8) @MaxLength(128) confirmation!:string }
export class PasswordResetRequestDto { @IsEmail() @MaxLength(180) email!: string }
export class EmailChangeRequestDto { @IsEmail() @MaxLength(180) newEmail!: string; @IsString() @MinLength(8) @MaxLength(128) currentPassword!: string }
export class EmailChangeConfirmationDto { @IsString() @MinLength(32) @MaxLength(128) token!: string }
export class EmailPreferencesDto {
  @IsOptional() @IsBoolean() emailEventNotifications?: boolean;
  @IsOptional() @IsBoolean() weeklyDigestEnabled?: boolean;
}
export class PasswordResetDto { @IsString() @MinLength(32) @MaxLength(128) token!: string; @IsString() @MinLength(8) @MaxLength(128) newPassword!: string }
export interface SessionUser { id: string; email: string; name: string | null }
const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
const loginAgentHash=(request:Request)=>createHash('sha256').update(String(request.headers['user-agent'] ?? 'unknown').slice(0,500)).digest('hex');
const sessionToken=(request:Request)=>request.headers.cookie?.split(';').map((part)=>part.trim()).find((part)=>part.startsWith('casar_session='))?.slice('casar_session='.length);
const assertPasswordFitsBcrypt=(password:string)=>{if(Buffer.byteLength(password,'utf8')>72)throw new BadRequestException('A palavra-passe não pode exceder 72 bytes.');};

function sessionCookie(token: string, production: boolean) {
  return `casar_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${production ? '; Secure' : ''}`;
}

@Injectable()
export class SessionGuard {
  constructor(private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    const raw = sessionToken(request);
    if (!raw) throw new UnauthorizedException('Inicia sessão para continuar.');
    const session=await this.db.session.findUnique({where:{tokenHash:tokenHash(raw)},include:{user:{select:{id:true,email:true,name:true,accountStatus:true}}}});
    if(!session||session.expiresAt<=new Date())throw new UnauthorizedException('A sessão expirou. Inicia sessão novamente.');
    if(session.user.accountStatus==='SUSPENDED'){
      await this.db.session.deleteMany({where:{userId:session.user.id}});
      throw new ForbiddenException('Esta conta está suspensa. Contacta o suporte da Nuvia.');
    }
    request.user=session.user;
    return true;
  }
}

@Injectable()
export class AdminGuard {
  constructor(private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    if (!request.user) throw new UnauthorizedException();
    const user = await this.db.user.findUnique({ where: { id: request.user.id }, select: { role: true } });
    if (!user || !['ADMIN','MODERATOR'].includes(user.role)) throw new ForbiddenException('Acesso reservado à equipa de moderação.');
    return true;
  }
}

@Injectable()
export class AdminOnlyGuard {
  constructor(private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    if (!request.user) throw new UnauthorizedException();
    const user = await this.db.user.findUnique({ where: { id: request.user.id }, select: { role: true } });
    if (user?.role !== 'ADMIN') throw new ForbiddenException('Esta acção está reservada a administradores.');
    return true;
  }
}

@Injectable()
export class SupportStaffGuard {
  constructor(private readonly db: DatabaseService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    if (!request.user) throw new UnauthorizedException();
    const user = await this.db.user.findUnique({ where: { id: request.user.id }, select: { role: true } });
    if (!user || !['SUPPORT', 'MODERATOR', 'ADMIN'].includes(user.role))
      throw new ForbiddenException('Acesso reservado à equipa de suporte.');
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request & { user: SessionUser }>().user);

@Controller('auth')
export class AuthController {
  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}

  private async issue(user: { id: string; email: string; name: string | null }, response: Response, agentHash?: string) {
    await this.db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), ...(agentHash ? { lastLoginAgentHash: agentHash } : {}) } });
    const token=randomBytes(32).toString('base64url');
    await this.db.session.create({data:{userId:user.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+7*24*60*60*1000)}});
    response.setHeader('Set-Cookie', sessionCookie(token, process.env.NODE_ENV === 'production'));
    return { user };
  }

  @Post('register')
  async register(@Body() body: RegisterDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    assertPasswordFitsBcrypt(body.password);
    const email = body.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where: { email } })) throw new ConflictException('Este email já tem uma conta.');
    const user = await this.db.user.create({ data: { email, name: body.name.trim(), passwordHash: await hash(body.password, 12) }, select: { id: true, email: true, name: true } });
    const session = await this.issue(user, response, loginAgentHash(request));
    void this.email.sendWelcome(user.email, user.name, `${webOrigin()}/dashboard`, user.id);
    return session;
  }

  @Post('login')
  async login(@Body() body: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const user = await this.db.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
    if (!user || !(await compare(body.password, user.passwordHash))) throw new UnauthorizedException('Email ou palavra-passe incorrectos.');
    if (user.accountStatus === 'SUSPENDED') throw new ForbiddenException('Esta conta está suspensa. Contacta o suporte da Nuvia.');
    const agentHash = loginAgentHash(request);
    const isNewBrowser = Boolean(user.lastLoginAgentHash && user.lastLoginAgentHash !== agentHash);
    const session = await this.issue({ id: user.id, email: user.email, name: user.name }, response, agentHash);
    if (isNewBrowser) void this.email.sendNewLogin(user.email, user.name, new Date(), `${user.id}/${agentHash}/${Date.now()}`);
    return session;
  }

  @Post('password-reset/request')
  async requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    if (process.env.NODE_ENV === 'production' && !this.email.isConfigured) {
      throw new ServiceUnavailableException('A recuperação por email ainda não está configurada. Contacta o suporte.');
    }
    const message = 'Se existir uma conta associada a este email, poderás redefinir a palavra-passe através do link de recuperação.';
    const email = body.email.trim().toLowerCase();
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
    if (!user) return { message };

    const now = new Date();
    const recentToken = await this.db.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: now }, createdAt: { gt: new Date(now.getTime() - 60_000) } },
      select: { id: true },
    });
    if (recentToken) return { message };

    const token = randomBytes(32).toString('base64url');
    await this.db.passwordResetToken.deleteMany({ where: { userId: user.id } });
    const resetRecord = await this.db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(now.getTime() + 30 * 60_000) },
      select: { id: true },
    });
    const resetUrl = `${webOrigin()}/repor-senha?token=${encodeURIComponent(token)}`;
    if (this.email.isConfigured) {
      const sent = await this.email.sendPasswordReset(user.email, user.name, resetUrl, resetRecord.id);
      if (!sent) await this.db.passwordResetToken.deleteMany({ where: { id: resetRecord.id } });
      return { message };
    }
    return { message, devResetUrl: resetUrl };
  }

  @Post('password-reset/reset')
  async resetPassword(@Body() body: PasswordResetDto) {
    assertPasswordFitsBcrypt(body.newPassword);
    const now = new Date();
    const hashedToken = tokenHash(body.token);
    const passwordHash = await hash(body.newPassword, 12);
    const account = await this.db.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashedToken } });
      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
        throw new BadRequestException('Este link já não é válido. Pede um novo link de recuperação.');
      }
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new BadRequestException('Este link já foi utilizado. Pede um novo link de recuperação.');
      const updatedAccount = await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash }, select: { id: true, name: true, email: true } });
      await tx.session.deleteMany({ where: { userId: resetToken.userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId, id: { not: resetToken.id } } });
      return updatedAccount;
    });
    void this.email.sendPasswordChanged(account.email, account.name, `reset/${account.id}/${now.getTime()}`);
    return { message: 'Palavra-passe alterada. Já podes entrar com a nova palavra-passe.' };
  }

  @Post('email-change/request') @UseGuards(SessionGuard)
  async requestEmailChange(@CurrentUser() user: SessionUser, @Body() body: EmailChangeRequestDto) {
    const account = await this.db.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, name: true, passwordHash: true } });
    if (!account || !(await compare(body.currentPassword, account.passwordHash))) throw new UnauthorizedException('A palavra-passe actual está incorrecta.');
    const newEmail = body.newEmail.trim().toLowerCase();
    if (newEmail === account.email.toLowerCase()) throw new BadRequestException('Este já é o email actual da tua conta.');
    if (await this.db.user.findUnique({ where: { email: newEmail }, select: { id: true } })) throw new ConflictException('Este email já está associado a outra conta.');
    await this.db.emailChangeToken.deleteMany({ where: { userId: account.id } });
    const token = randomBytes(32).toString('base64url');
    const record = await this.db.emailChangeToken.create({ data: { userId: account.id, newEmail, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 30 * 60_000) }, select: { id: true } });
    const confirmUrl = `${webOrigin()}/confirmar-email?token=${encodeURIComponent(token)}`;
    const sent = this.email.isConfigured ? await this.email.sendEmailChangeVerification(newEmail, account.name, confirmUrl, record.id) : false;
    if (!sent && process.env.NODE_ENV === 'production') {
      await this.db.emailChangeToken.deleteMany({ where: { id: record.id } });
      throw new ServiceUnavailableException('A confirmação de email não está disponível neste momento.');
    }
    void this.email.sendEmailChangeRequested(account.email, account.name, record.id);
    return { message: 'Enviámos um link de confirmação para o novo endereço. O email actual só muda depois de confirmares.', ...(sent ? {} : { devConfirmUrl: confirmUrl }) };
  }

  @Post('email-change/confirm')
  async confirmEmailChange(@Body() body: EmailChangeConfirmationDto) {
    const now = new Date();
    const reset = await this.db.$transaction(async (tx) => {
      const record = await tx.emailChangeToken.findUnique({ where: { tokenHash: tokenHash(body.token) }, include: { user: { select: { id: true, email: true, name: true } } } });
      if (!record || record.usedAt || record.expiresAt <= now) throw new BadRequestException('Este link já não é válido. Inicia novamente a alteração do email.');
      if (await tx.user.findUnique({ where: { email: record.newEmail }, select: { id: true } })) throw new ConflictException('Este email já está associado a outra conta.');
      const consumed = await tx.emailChangeToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (consumed.count !== 1) throw new BadRequestException('Este link já foi utilizado.');
      const updated = await tx.user.update({ where: { id: record.userId }, data: { email: record.newEmail }, select: { id: true, email: true, name: true } });
      await tx.session.deleteMany({ where: { userId: record.userId } });
      await tx.emailChangeToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } });
      return { previousEmail: record.user.email, updated };
    });
    void this.email.sendEmailChanged(reset.previousEmail, reset.updated.name, reset.updated.email, `old/${reset.updated.id}/${now.getTime()}`);
    void this.email.sendEmailChanged(reset.updated.email, reset.updated.name, reset.updated.email, `new/${reset.updated.id}/${now.getTime()}`);
    return { message: 'Email actualizado. Entra novamente com o novo endereço.' };
  }

  @Post('logout')
  async logout(@Req() request:Request,@Res({ passthrough: true }) response: Response) {
    const token=sessionToken(request);
    if(token)await this.db.session.deleteMany({where:{tokenHash:tokenHash(token)}});
    response.setHeader('Set-Cookie', 'casar_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return { ok: true };
  }

  @Get('me') @UseGuards(SessionGuard)
  async me(@CurrentUser() user: SessionUser) {
    const account = await this.db.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, role: true, emailEventNotifications: true, weeklyDigestEnabled: true },
    });
    if (!account) throw new UnauthorizedException('A sessão já não está associada a uma conta activa.');
    return { user: account };
  }

  @Patch('email-preferences') @UseGuards(SessionGuard)
  async updateEmailPreferences(@CurrentUser() user: SessionUser, @Body() body: EmailPreferencesDto) {
    if (body.emailEventNotifications === undefined && body.weeklyDigestEnabled === undefined)
      throw new BadRequestException('Indica pelo menos uma preferência de email.');
    const current = await this.db.user.findUnique({ where: { id: user.id }, select: { weeklyDigestEnabled: true } });
    if (!current) throw new UnauthorizedException();
    const enablingDigest = body.weeklyDigestEnabled === true && !current.weeklyDigestEnabled;
    return this.db.user.update({
      where: { id: user.id },
      data: {
        ...(body.emailEventNotifications !== undefined ? { emailEventNotifications: body.emailEventNotifications } : {}),
        ...(body.weeklyDigestEnabled !== undefined ? { weeklyDigestEnabled: body.weeklyDigestEnabled } : {}),
        ...(enablingDigest ? { weeklyDigestLastSentAt: new Date(), weeklyDigestClaimedAt: null } : {}),
        ...(body.weeklyDigestEnabled === false ? { weeklyDigestClaimedAt: null } : {}),
      },
      select: { emailEventNotifications: true, weeklyDigestEnabled: true },
    });
  }

  @Get('export') @UseGuards(SessionGuard)
  async exportData(@CurrentUser()user:SessionUser){const account=await this.db.user.findUnique({where:{id:user.id},select:{id:true,email:true,name:true,createdAt:true,projects:{include:{project:{include:{events:true,tasks:true,guests:{select:{id:true,projectId:true,name:true,email:true,phone:true,groupName:true,maxPartySize:true,seatingTableId:true,createdAt:true,rsvps:true}},expenses:true,invitations:true,quoteRequests:{include:{vendor:{select:{name:true,category:true}}}}}}}}}});if(!account)throw new UnauthorizedException();return {exportedAt:new Date().toISOString(),account};}

  @Post('change-password') @UseGuards(SessionGuard)
  async changePassword(@CurrentUser()user:SessionUser,@Body()body:ChangePasswordDto,@Res({passthrough:true})response:Response){assertPasswordFitsBcrypt(body.newPassword);const account=await this.db.user.findUnique({where:{id:user.id}});if(!account||!(await compare(body.currentPassword,account.passwordHash)))throw new UnauthorizedException('A palavra-passe actual está incorrecta.');if(body.currentPassword===body.newPassword)throw new BadRequestException('Escolhe uma palavra-passe diferente da actual.');const changedAt=new Date();await this.db.user.update({where:{id:user.id},data:{passwordHash:await hash(body.newPassword,12)}});await this.db.session.deleteMany({where:{userId:user.id}});void this.email.sendPasswordChanged(account.email,account.name,`settings/${account.id}/${changedAt.getTime()}`);return this.issue({id:account.id,email:account.email,name:account.name},response);}

  @Delete('me') @UseGuards(SessionGuard)
  async deleteAccount(@CurrentUser()user:SessionUser,@Body()body:DeleteAccountDto,@Res({passthrough:true})response:Response){if(body.confirmation!=='ELIMINAR')throw new BadRequestException('Escreve ELIMINAR para confirmar a eliminação.');const account=await this.db.user.findUnique({where:{id:user.id}});if(!account||!(await compare(body.password,account.passwordHash)))throw new UnauthorizedException('A palavra-passe está incorrecta.');if(['ADMIN','MODERATOR','SUPPORT'].includes(account.role))throw new ForbiddenException('A equipa da Nuvia não pode eliminar a conta por esta via.');await this.db.$transaction(async(tx)=>{const memberships=await tx.projectMember.findMany({where:{userId:user.id},include:{project:{include:{members:{where:{userId:{not:user.id}},orderBy:{createdAt:'asc'}}}}}});for(const membership of memberships){if(membership.role==='OWNER'){const next=membership.project.members.find((m)=>m.role==='OWNER')??membership.project.members[0];if(next)await tx.projectMember.update({where:{projectId_userId:{projectId:membership.projectId,userId:next.userId}},data:{role:'OWNER'}});else await tx.eventProject.delete({where:{id:membership.projectId}});}}await tx.user.delete({where:{id:user.id}});});response.setHeader('Set-Cookie','casar_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return {ok:true};}
}
