import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { AdminContentController } from "./admin-content.controller";
import { ContentService } from "./content.service";
import { PublicContentController } from "./public-content.controller";

/** 内容管理模块，集中注册后台内容查询接口和权限依赖。 */
@Module({
  imports: [AuthModule],
  controllers: [AdminContentController, PublicContentController],
  providers: [ContentService],
})
export class ContentModule {}
