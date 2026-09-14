import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { AdminDemoController, MiniappDemoController } from "./demo.controller";
import { DemoService } from "./demo.service";

@Module({
  imports: [AuthModule],
  controllers: [MiniappDemoController, AdminDemoController],
  providers: [DemoService],
})
export class DemoModule {}
