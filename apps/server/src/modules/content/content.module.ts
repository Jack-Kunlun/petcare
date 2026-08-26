import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { WebsiteContentModule } from "../website-content/website-content.module";
import { AdminContentController } from "./admin-content.controller";
import { ClassroomArticleService } from "./classroom-article.service";
import { CommunityMediaController } from "./community-media.controller";
import { CommunityMediaService } from "./community-media.service";
import {
  CommunityPostController,
  PublicCommunityPostController,
} from "./community-post.controller";
import { CommunityPostService } from "./community-post.service";
import { ContentService } from "./content.service";
import { PublicContentController } from "./public-content.controller";

/** 内容管理模块，集中注册后台内容查询与课堂文章生命周期接口。 */
@Module({
  imports: [AuthModule, WebsiteContentModule],
  controllers: [
    AdminContentController,
    CommunityMediaController,
    CommunityPostController,
    PublicCommunityPostController,
    PublicContentController,
  ],
  providers: [ContentService, ClassroomArticleService, CommunityMediaService, CommunityPostService],
})
export class ContentModule {}
