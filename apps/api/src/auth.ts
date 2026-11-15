import { Body, createParamDecorator, ExecutionContext, Injectable, Post, Req, Res, UnauthorizedException, ForbiddenException, UseGuards, Controller, Get, ConflictException, Delete, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { DatabaseService } from './database';

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @MinLength(2) name!: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}
export class ChangePasswordDto { @IsString() @MinLength(8) currentPassword!:string; @IsString() @MinLength(8) newPassword!:string }
export class DeleteAccountDto { @IsString() @MinLength(8) password!:string; @IsString() @MinLength(8) confirmation!:string }
export class PasswordResetRequestDto { @IsEmail() @MaxLength(180) email!: string }
export class PasswordResetDto { @IsString() @MinLength(32) @MaxLength(128) token!: string; @IsString() @MinLength(8) @MaxLength(128) newPassword!: string }
export interface SessionUser { id: string; email: string; name: string | null }
const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
const sessionToken=(request:Request)=>request.headers.cookie?.split(';').map((part)=>part.trim()).find((part)=>part.startsWith('casar_session='))?.slice('casar_session='.length);

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
    const session=await this.db.session.findUnique({where:{tokenHash:tokenHash(raw)},include:{user:{select:{id:true,email:true,name:true}}}});
    if(!session||session.expiresAt<=new Date())throw new UnauthorizedException('A sessão expirou. Inicia sessão novamente.');
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

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request & { user: SessionUser }>().user);

@Controller('auth')
export class AuthController {
  constructor(private readonly db: DatabaseService) {}

  private async issue(user: { id: string; email: string; name: string | null }, response: Response) {
    const token=randomBytes(32).toString('base64url');
    await this.db.session.create({data:{userId:user.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+7*24*60*60*1000)}});
    response.setHeader('Set-Cookie', sessionCookie(token, process.env.NODE_ENV === 'production'));
    return { user };
  }

  @Post('register')
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const email = body.email.trim().toLowerCase();
    if (await this.db.user.findUnique({ where: { email } })) throw new ConflictException('Este email já tem uma conta.');
    const user = await this.db.user.create({ data: { email, name: body.name.trim(), passwordHash: await hash(body.password, 12) }, select: { id: true, email: true, name: true } });
    return this.issue(user, response);
  }

  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const user = await this.db.user.findUnique({ where: { email: body.email.trim().toLowerCase() } });
    if (!user || !(await compare(body.password, user.passwordHash))) throw new UnauthorizedException('Email ou palavra-passe incorrectos.');
    return this.issue({ id: user.id, email: user.email, name: user.name }, response);
  }

  @Post('password-reset/request')
  async requestPasswordReset(@Body() body: PasswordResetRequestDto) {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('A recuperação por email ainda não está configurada. Contacta o suporte.');
    }
    const message = 'Se existir uma conta associada a este email, poderás redefinir a palavra-passe através do link de recuperação.';
    const email = body.email.trim().toLowerCase();
    const user = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return { message };

    const now = new Date();
    const recentToken = await this.db.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: now }, createdAt: { gt: new Date(now.getTime() - 60_000) } },
      select: { id: true },
    });
    if (recentToken) return { message };

    const token = randomBytes(32).toString('base64url');
    await this.db.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await this.db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(now.getTime() + 30 * 60_000) },
    });
    const origin = (process.env.WEB_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
    return { message, devResetUrl: `${origin}/repor-senha?token=${encodeURIComponent(token)}` };
  }

  @Post('password-reset/reset')
  async resetPassword(@Body() body: PasswordResetDto) {
    const now = new Date();
    const hashedToken = tokenHash(body.token);
    const passwordHash = await hash(body.newPassword, 12);
    await this.db.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashedToken } });
      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
        throw new BadRequestException('Este link já não é válido. Pede um novo link de recuperação.');
      }
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: resetToken.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) throw new BadRequestException('Este link já foi utilizado. Pede um novo link de recuperação.');
      await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId: resetToken.userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId: resetToken.userId, id: { not: resetToken.id } } });
    });
    return { message: 'Palavra-passe alterada. Já podes entrar com a nova palavra-passe.' };
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
      select: { id: true, email: true, name: true, role: true },
    });
    if (!account) throw new UnauthorizedException('A sessão já não está associada a uma conta activa.');
    return { user: account };
  }

  @Get('export') @UseGuards(SessionGuard)
  async exportData(@CurrentUser()user:SessionUser){const account=await this.db.user.findUnique({where:{id:user.id},select:{id:true,email:true,name:true,createdAt:true,projects:{include:{project:{include:{events:true,tasks:true,guests:{include:{rsvps:true}},expenses:true,invitations:true,quoteRequests:{include:{vendor:{select:{name:true,category:true}}}}}}}}}});if(!account)throw new UnauthorizedException();return {exportedAt:new Date().toISOString(),account};}

  @Post('change-password') @UseGuards(SessionGuard)
  async changePassword(@CurrentUser()user:SessionUser,@Body()body:ChangePasswordDto,@Res({passthrough:true})response:Response){const account=await this.db.user.findUnique({where:{id:user.id}});if(!account||!(await compare(body.currentPassword,account.passwordHash)))throw new UnauthorizedException('A palavra-passe actual está incorrecta.');if(body.currentPassword===body.newPassword)throw new BadRequestException('Escolhe uma palavra-passe diferente da actual.');await this.db.user.update({where:{id:user.id},data:{passwordHash:await hash(body.newPassword,12)}});await this.db.session.deleteMany({where:{userId:user.id}});return this.issue({id:account.id,email:account.email,name:account.name},response);}

  @Delete('me') @UseGuards(SessionGuard)
  async deleteAccount(@CurrentUser()user:SessionUser,@Body()body:DeleteAccountDto,@Res({passthrough:true})response:Response){if(body.confirmation!=='ELIMINAR')throw new BadRequestException('Escreve ELIMINAR para confirmar a eliminação.');const account=await this.db.user.findUnique({where:{id:user.id}});if(!account||!(await compare(body.password,account.passwordHash)))throw new UnauthorizedException('A palavra-passe está incorrecta.');if(account.role==='ADMIN'||account.role==='MODERATOR')throw new ForbiddenException('A equipa administrativa não pode eliminar a conta por esta via.');await this.db.$transaction(async(tx)=>{const memberships=await tx.projectMember.findMany({where:{userId:user.id},include:{project:{include:{members:{where:{userId:{not:user.id}},orderBy:{createdAt:'asc'}}}}}});for(const membership of memberships){if(membership.role==='OWNER'){const next=membership.project.members.find((m)=>m.role==='OWNER')??membership.project.members[0];if(next)await tx.projectMember.update({where:{projectId_userId:{projectId:membership.projectId,userId:next.userId}},data:{role:'OWNER'}});else await tx.eventProject.delete({where:{id:membership.projectId}});}}await tx.user.delete({where:{id:user.id}});});response.setHeader('Set-Cookie','casar_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return {ok:true};}
}
