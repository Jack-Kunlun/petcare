import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { ConfigModule } from "../../config/config.module";
import { SystemSettingsModule } from "../system-settings/system-settings.module";
import { AdminOrderController } from "./admin-order.controller";
import { OrderConfigSnapshotService } from "./order-config-snapshot.service";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [AuthModule, ConfigModule, SystemSettingsModule],
  controllers: [AdminOrderController, OrderController],
  providers: [OrderConfigSnapshotService, OrderService],
})
export class OrderModule {}
