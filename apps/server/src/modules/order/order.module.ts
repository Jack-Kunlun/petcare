import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { ConfigModule } from "../../config/config.module";
import { AdminOrderController } from "./admin-order.controller";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [AdminOrderController, OrderController],
  providers: [OrderService],
})
export class OrderModule {}
