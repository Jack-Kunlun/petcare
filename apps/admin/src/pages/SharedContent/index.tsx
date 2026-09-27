import { SHARED_CONTENT_KEYS } from "../WebsiteContent/content-registry";
import { ManagedContentOverview } from "../WebsiteContent/ManagedContentOverview";

/** Lists support and legal content shared by public Website and Miniapp surfaces. */
export default function SharedContent() {
  return (
    <ManagedContentOverview
      eyebrow="用户支持"
      title="客服与协议"
      description="集中维护联系客服、帮助中心和协议内容，供小程序及相应公共页面读取。"
      contentKeys={SHARED_CONTENT_KEYS}
      listLabel="公共内容单元"
    />
  );
}
