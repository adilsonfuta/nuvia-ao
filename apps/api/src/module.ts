import { Controller, Get, Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(__dirname, '../../../.env') });
import { AdminGuard, AuthController, SessionGuard } from './auth';
import { AdminController } from './admin';
import { CatalogConfigController, GuidesController, LegalController, QuoteRequestsController, VendorFavoritesController, VenuesController, VendorsController } from './catalog';
import { DatabaseService } from './database';
import { NotificationsController } from './notifications';
import { PublicEventSummaryController, PublicInvitationController, ProjectsController } from './projects';
import { VendorApplicationsController } from './vendor-applications';
import { PublicVendorPortfolioController, VendorPortalController } from './vendor-portal';
import { ProjectContributionsController, PublicContributionsController } from './contributions';
import { ProjectActivityController } from './project-activity';
import { ProjectDocumentsController } from './project-documents';

@Controller('health')
class HealthController {
  constructor(private readonly db:DatabaseService){}
  @Get() async health(){try{await this.db.$queryRaw`SELECT 1`;return {status:'ok',database:'connected',service:'casar-api',version:'v1'};}catch{return {status:'degraded',database:'unavailable',service:'casar-api',version:'v1'};}}
}

@Module({
  controllers: [HealthController, AuthController, AdminController, ProjectsController, ProjectActivityController, ProjectDocumentsController, PublicInvitationController, PublicEventSummaryController, NotificationsController, VendorsController, CatalogConfigController, VendorFavoritesController, QuoteRequestsController, GuidesController, LegalController, VenuesController, VendorApplicationsController, VendorPortalController, PublicVendorPortfolioController, ProjectContributionsController, PublicContributionsController],
  providers: [DatabaseService, SessionGuard, AdminGuard],
})
export class AppModule {}
