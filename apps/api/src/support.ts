import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SupportRequestStatus } from '@casar/database';
import { CurrentUser, SessionGuard, SessionUser, SupportStaffGuard } from './auth';
import { DatabaseService } from './database';
import { EmailService, webOrigin } from './email';

class CreateSupportRequestDto {
  @IsString() @MinLength(4) @MaxLength(120) subject!: string;
  @IsString() @MinLength(10) @MaxLength(4000) message!: string;
}

class PublicSupportRequestDto extends CreateSupportRequestDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail() @MaxLength(180) email!: string;
}

class UpdateSupportRequestDto {
  @IsOptional() @IsEnum(SupportRequestStatus) status?: SupportRequestStatus;
  @IsOptional() @IsString() @MinLength(5) @MaxLength(4000) response?: string;
}

@Controller('support')
@UseGuards(SessionGuard)
export class SupportController {
  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}

  @Get('my-requests')
  myRequests(@CurrentUser() user: SessionUser) {
    return this.db.supportRequest.findMany({
      where: { userId: user.id },
      select: { id: true, subject: true, message: true, status: true, response: true, respondedAt: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }

  @Post('requests')
  async create(@CurrentUser() user: SessionUser, @Body() body: CreateSupportRequestDto) {
    const openCount = await this.db.supportRequest.count({
      where: { userId: user.id, status: { in: [SupportRequestStatus.OPEN, SupportRequestStatus.IN_PROGRESS] } },
    });
    if (openCount >= 5) throw new BadRequestException('Já tens cinco pedidos por resolver. Aguarda uma resposta antes de abrir outro.');
    const request = await this.db.supportRequest.create({
      data: { userId: user.id, requesterName: user.name, requesterEmail: user.email, subject: body.subject.trim(), message: body.message.trim() },
      select: { id: true, subject: true, message: true, status: true, response: true, respondedAt: true, createdAt: true, updatedAt: true },
    });
    await this.db.auditLog.create({ data: { actorId: user.id, action: 'SUPPORT_REQUEST_CREATED', resource: 'SupportRequest', resourceId: request.id } });
    const emailSent = await this.email.sendSupportReceived(user.email, { name: user.name || user.email, subject: request.subject, url: `${webOrigin()}/suporte` }, request.id);
    return { ...request, emailSent };
  }

  @Get('requests')
  @UseGuards(SupportStaffGuard)
  async requests(@Query('status') status?: string, @Query('q') search?: string, @Query('page') pageValue?: string) {
    const statuses = Object.values(SupportRequestStatus);
    const page = Math.max(1, Math.min(10000, Number.parseInt(pageValue ?? '1', 10) || 1));
    const pageSize = 25;
    const query = search?.trim().slice(0, 100);
    const where = {
      ...(status && statuses.includes(status as SupportRequestStatus) ? { status: status as SupportRequestStatus } : {}),
      ...(query ? { OR: [
        { subject: { contains: query, mode: 'insensitive' as const } },
        { requesterName: { contains: query, mode: 'insensitive' as const } },
        { requesterEmail: { contains: query, mode: 'insensitive' as const } },
        { user: { is: { email: { contains: query, mode: 'insensitive' as const } } } },
        { user: { is: { name: { contains: query, mode: 'insensitive' as const } } } },
      ] } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.supportRequest.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.supportRequest.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  @Patch('requests/:id')
  @UseGuards(SupportStaffGuard)
  async update(@Param('id') id: string, @CurrentUser() actor: SessionUser, @Body() body: UpdateSupportRequestDto) {
    const existing = await this.db.supportRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pedido de suporte não encontrado.');
    if (!body.status && !body.response) throw new BadRequestException('Indica uma resposta ou altera o estado do pedido.');
    const request = await this.db.supportRequest.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        ...(body.response ? { response: body.response.trim(), respondedAt: new Date() } : {}),
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await this.db.auditLog.create({
      data: {
        actorId: actor.id,
        action: body.response ? 'SUPPORT_REQUEST_ANSWERED' : 'SUPPORT_REQUEST_STATUS_CHANGED',
        resource: 'SupportRequest',
        resourceId: id,
        metadata: { from: existing.status, to: request.status },
      },
    });
    const emailSent = body.response && request.requesterEmail
      ? await this.email.sendSupportResponse(request.requesterEmail, { name: request.requesterName || request.requesterEmail, subject: request.subject, response: body.response.trim(), url: `${webOrigin()}/suporte` }, `${request.id}/${request.respondedAt?.getTime() ?? request.updatedAt.getTime()}`)
      : false;
    return { ...request, emailSent };
  }
}

@Controller('support')
export class PublicSupportController {
  constructor(private readonly db: DatabaseService, private readonly email: EmailService) {}

  @Post('public-requests')
  async create(@Body() body: PublicSupportRequestDto) {
    const email = body.email.trim().toLowerCase();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.db.supportRequest.count({ where: { userId: null, requesterEmail: email, createdAt: { gte: since } } });
    if (recent >= 5) throw new BadRequestException('Já recebemos vários pedidos deste email hoje. Tenta novamente mais tarde.');
    const request = await this.db.supportRequest.create({
      data: { requesterName: body.name.trim(), requesterEmail: email, subject: body.subject.trim(), message: body.message.trim() },
      select: { id: true, subject: true, status: true, createdAt: true },
    });
    const emailSent = await this.email.sendSupportReceived(email, { name: body.name.trim(), subject: request.subject, url: `${webOrigin()}/suporte` }, request.id);
    return { ...request, emailSent, message: emailSent ? 'Pedido recebido. Enviámos uma confirmação para o teu email.' : 'Pedido recebido. A equipa poderá responder pelo email indicado.' };
  }
}
