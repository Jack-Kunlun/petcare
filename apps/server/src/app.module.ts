import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { OrderModule } from "./modules/order/order.module";
import { UserModule } from "./modules/user/user.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, HealthModule, UserModule, OrderModule],
})
export class AppModule {}
