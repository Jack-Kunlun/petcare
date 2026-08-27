import { SHARED_CONTENT_KEYS } from "../WebsiteContent/content-registry";
import { ManagedContentOverview } from "../WebsiteContent/ManagedContentOverview";

/** Lists support and legal content shared by public Website and Miniapp surfaces. */
export default function SharedContent() {
  return (
    <ManagedContentOverview
      eyebrow="公共配置"
      title="公共内容配置"
      description="集中维护联系客服、帮助中心和协议内容。发布结果会由官网、小程序或两端共同读取，不再与官网页面编排混在同一列表。"
      contentKeys={SHARED_CONTENT_KEYS}
      listLabel="公共内容单元"
    />
  );
}
