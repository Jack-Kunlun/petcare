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
import { BountyModule } from "./modules/bounty/bounty.module";
import { ContentModule } from "./modules/content/content.module";
import { PetModule } from "./modules/pet/pet.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { UserModule } from "./modules/user/user.module";
import { WebsiteContentModule } from "./modules/website-content/website-content.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    UserModule,
    PetModule,
    ContentModule,
    RbacModule,
    AdminAccountModule,
    BountyModule,
    WebsiteContentModule,
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
