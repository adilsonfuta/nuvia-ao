import { Controller, Get, Module } from '@nestjs/common';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(__dirname, '../../../.env') });
import { AdminGuard, AuthController, SessionGuard } from './auth';
import { AdminController } from './admin';
import { CatalogConfigController, GuidesController, LegalController, QuoteRequestsController, VendorFavoritesController, VenuesController, VendorsController } from './catalog';
import { DatabaseService } from './database';
import { NotificationsController } from './notifications';
import { PublicInvitationController, ProjectsController } from './projects';
import { VendorApplicationsController } from './vendor-applications';
import { PublicVendorPortfolioController, VendorPortalController } from './vendor-portal';

@Controller('health')
class HealthController {
  constructor(private readonly db:DatabaseService){}
  @Get() async health(){try{await this.db.$queryRaw`SELECT 1`;return {status:'ok',database:'connected',service:'casar-api',version:'v1'};}catch{return {status:'degraded',database:'unavailable',service:'casar-api',version:'v1'};}}
}

@Module({
  controllers: [HealthController, AuthController, AdminController, ProjectsController, PublicInvitationController, NotificationsController, VendorsController, CatalogConfigController, VendorFavoritesController, QuoteRequestsController, GuidesController, LegalController, VenuesController, VendorApplicationsController, VendorPortalController, PublicVendorPortfolioController],
  providers: [DatabaseService, SessionGuard, AdminGuard],
})
export class AppModule {}
