import { SHARED_CONTENT_KEYS } from "../WebsiteContent/content-registry";
import { ManagedContentOverview } from "../WebsiteContent/ManagedContentOverview";

/** Lists support and legal content used by the Miniapp public experience. */
export default function SharedContent() {
  return (
    <ManagedContentOverview
      eyebrow="用户支持"
      title="客服与协议"
      description="集中维护小程序联系客服、帮助中心和协议内容；官网布局与营销内容由产品代码统一维护。"
      contentKeys={SHARED_CONTENT_KEYS}
      listLabel="公共内容单元"
    />
  );
}
