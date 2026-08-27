import { WEBSITE_MANAGEMENT_CONTENT_KEYS } from "./content-registry";
import { ManagedContentOverview } from "./ManagedContentOverview";

/** Lists Website-only content without mixing shared support and legal configuration. */
export default function WebsiteContent() {
  return (
    <ManagedContentOverview
      eyebrow="官网管理"
      title="官网内容"
      description="这里只维护官网自身的全站框架、首页和关于页。客服、帮助与协议内容已拆分到公共内容配置。"
      contentKeys={WEBSITE_MANAGEMENT_CONTENT_KEYS}
      listLabel="官网内容单元"
    />
  );
}
