import { Controller, Get, Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(__dirname, '../../../.env') });
import { AdminGuard, AdminOnlyGuard, AuthController, SessionGuard, SupportStaffGuard } from './auth';
import { AdminController } from './admin';
import { PublicSupportController, SupportController } from './support';
import { CatalogConfigController, GuidesController, LegalController, QuoteRequestsController, VendorFavoritesController, VenuesController, VendorsController } from './catalog';
import { DatabaseService } from './database';
import { NotificationsController } from './notifications';
import { PublicEventSummaryController, PublicInvitationController, ProjectsController } from './projects';
import { VendorApplicationsController } from './vendor-applications';
import { PublicVendorPortfolioController, VendorPortalController } from './vendor-portal';
import { ProjectContributionsController, PublicContributionsController } from './contributions';
import { ProjectActivityController } from './project-activity';
import { ProjectDocumentsController } from './project-documents';
import { AdminAnalyticsController } from './analytics';
import { EmailService } from './email';
import { EmailDigestController, EmailDigestWorker } from './email-digest';
import { ProjectAlbumController, PublicAlbumController } from './event-album';

@Controller('health')
class HealthController {
  constructor(private readonly db:DatabaseService){}
  @Get() async health(){try{await this.db.$queryRaw`SELECT 1`;return {status:'ok',database:'connected',service:'casar-api',version:'v1'};}catch{return {status:'degraded',database:'unavailable',service:'casar-api',version:'v1'};}}
}

@Module({
  controllers: [HealthController, AuthController, AdminController, AdminAnalyticsController, SupportController, PublicSupportController, ProjectsController, ProjectActivityController, ProjectDocumentsController, PublicInvitationController, PublicEventSummaryController, NotificationsController, VendorsController, CatalogConfigController, VendorFavoritesController, QuoteRequestsController, GuidesController, LegalController, VenuesController, VendorApplicationsController, VendorPortalController, PublicVendorPortfolioController, ProjectContributionsController, PublicContributionsController, ProjectAlbumController, PublicAlbumController, EmailDigestController],
  providers: [DatabaseService, SessionGuard, AdminGuard, AdminOnlyGuard, SupportStaffGuard, EmailService, EmailDigestWorker],
})
export class AppModule {}
