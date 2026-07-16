import { Module } from "@nestjs/common";
import { ConfigModule } from "../../config/config.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [ConfigModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
