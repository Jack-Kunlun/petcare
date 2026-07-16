import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { OrderModule } from "./modules/order/order.module";
import { UserModule } from "./modules/user/user.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [ConfigModule, PrismaModule, UserModule, OrderModule],
})
export class AppModule {}
