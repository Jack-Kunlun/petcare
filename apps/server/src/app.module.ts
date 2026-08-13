import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { ApiExceptionFilter } from "./common/http/api-exception.filter";
import { ApiResponseInterceptor } from "./common/http/api-response.interceptor";
import { RequestIdMiddleware } from "./common/http/request-id.middleware";
import { ConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { HttpLoggingMiddleware } from "./logging/http-logging.middleware";
import { LoggingModule } from "./logging/logging.module";
import { AdminAccountModule } from "./modules/admin-account/admin-account.module";
import { ComplaintDisputeModule } from "./modules/complaint-dispute/complaint-dispute.module";
import { ContentModule } from "./modules/content/content.module";
import { OrderModule } from "./modules/order/order.module";
import { ProviderModule } from "./modules/provider/provider.module";
import { ProviderCertificationModule } from "./modules/provider-certification/provider-certification.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { SystemSettingsModule } from "./modules/system-settings/system-settings.module";
import { UserModule } from "./modules/user/user.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    UserModule,
    OrderModule,
    ContentModule,
    ComplaintDisputeModule,
    ProviderCertificationModule,
    ProviderModule,
    SystemSettingsModule,
    RbacModule,
    AdminAccountModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, HttpLoggingMiddleware).forRoutes("*");
  }
}
