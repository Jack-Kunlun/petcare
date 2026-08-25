import { isDeepStrictEqual } from "node:util";
import {
  WEBSITE_CONTENT_KEY,
  WEBSITE_CONTENT_STATUS,
  WEBSITE_SECTION_TYPE,
  type WebsiteContentKey,
  type WebsiteContentSection,
  type WebsiteContactChannel,
  type WebsiteRichTextPart,
  type WebsiteRichTextSection,
  type WebsiteSeoContent,
} from "@petcare/shared-types";
import { Prisma, PrismaClient } from "../generated/prisma/client";

interface WebsiteSeedTemplate {
  contentKey: WebsiteContentKey;
  contentType: "global" | "page";
  seo: WebsiteSeoContent;
  sections: WebsiteContentSection[];
}

const image = (altText: string) => ({ assetId: null, altText });
const action = (label: string, href: `/${string}`) => ({ label, href });

const LEGACY_CONTACT_CHANNELS = [
  {
    channelKey: "customer_service",
    label: "客服邮箱",
    value: "service@example.com",
    href: "mailto:service@example.com",
    availability: "工作日 09:00–18:00",
  },
  {
    channelKey: "business",
    label: "商务合作",
    value: "business@example.com",
    href: "mailto:business@example.com",
    availability: "工作日 09:00–18:00",
  },
] satisfies readonly WebsiteContactChannel[];

function helpSection(
  sectionKey: string,
  sortOrder: number,
  title: string,
  parts: WebsiteRichTextPart[],
): WebsiteRichTextSection {
  return {
    sectionKey,
    sectionType: WEBSITE_SECTION_TYPE.RICH_TEXT,
    sortOrder,
    isEnabled: true,
    schemaVersion: 1,
    content: { title, effectiveDate: null, parts },
    settings: { width: "normal" },
  };
}

/** Deterministic initial snapshots used by the website seed and fixed template registry. */
export const WEBSITE_CONTENT_SEED_TEMPLATES: readonly WebsiteSeedTemplate[] = [
  {
    contentKey: WEBSITE_CONTENT_KEY.SITE_SHELL,
    contentType: "global",
    seo: {
      title: "PetCare 宠伴",
      description: "透明、专业、可信赖的宠物照护服务平台。",
      canonicalPath: "/",
      image: null,
    },
    sections: [
      {
        sectionKey: "site_header",
        sectionType: WEBSITE_SECTION_TYPE.SITE_HEADER,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          brandLabel: "PetCare 宠伴",
          navigation: [
            { itemKey: "services", label: "服务模式", href: "/services" },
            { itemKey: "trust", label: "信任保障", href: "/trust" },
            { itemKey: "companions", label: "成为宠托师", href: "/companions" },
            { itemKey: "about", label: "关于我们", href: "/about" },
          ],
          action: action("联系我们", "/contact"),
        },
        settings: { sticky: true },
      },
      {
        sectionKey: "site_footer",
        sectionType: WEBSITE_SECTION_TYPE.SITE_FOOTER,
        sortOrder: 2,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          description: "陪伴每一次托付。",
          groups: [
            {
              groupKey: "company",
              title: "PetCare",
              links: [
                { itemKey: "about", label: "关于我们", href: "/about" },
                { itemKey: "contact", label: "联系我们", href: "/contact" },
              ],
            },
            {
              groupKey: "legal",
              title: "规则与政策",
              links: [
                { itemKey: "privacy", label: "隐私政策", href: "/privacy" },
                { itemKey: "terms", label: "服务条款", href: "/terms" },
              ],
            },
          ],
          copyright: "© PetCare 宠伴",
        },
        settings: { showLogo: true },
      },
    ],
  },
  {
    contentKey: WEBSITE_CONTENT_KEY.HOME,
    contentType: "page",
    seo: {
      title: "PetCare 宠伴｜陪伴每一次托付",
      description: "发现透明、专业、可信赖的宠物照护服务。",
      canonicalPath: "/",
      image: image("宠物与照护者安心相伴"),
    },
    sections: [
      {
        sectionKey: "hero",
        sectionType: WEBSITE_SECTION_TYPE.HERO,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "PetCare 宠伴",
          title: "陪伴每一次托付",
          description: "让每一次宠物照护都更加透明、专业、可信赖。",
          primaryAction: action("了解服务", "/services"),
          secondaryAction: action("信任保障", "/trust"),
          image: image("宠物与照护者安心相伴"),
        },
        settings: { alignment: "left", imagePosition: "right" },
      },
      {
        sectionKey: "trust_evidence",
        sectionType: WEBSITE_SECTION_TYPE.TRUST_GRID,
        sortOrder: 2,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "每一次托付，都值得信赖",
          description: "从身份认证到照护记录，让服务过程清晰可见。",
          items: [
            {
              itemKey: "certification",
              title: "身份认证",
              description: "宠托师通过平台认证后提供服务。",
              icon: "certificate",
            },
            {
              itemKey: "records",
              title: "照护记录",
              description: "每一次照护，都有记录。",
              icon: "clipboard",
            },
            {
              itemKey: "support",
              title: "申诉与处理",
              description: "服务争议进入清晰的平台处理流程。",
              icon: "support",
            },
          ],
        },
        settings: { columns: 3 },
      },
      {
        sectionKey: "service_modes",
        sectionType: WEBSITE_SECTION_TYPE.FEATURE_SPLIT,
        sortOrder: 3,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "两种服务模式",
          title: "按需要选择悬赏服务或平台服务",
          description: "灵活发布照护需求，也可以选择规则清晰的平台定价服务。",
          action: action("查看服务模式", "/services"),
          image: image("宠物照护服务场景"),
        },
        settings: { imagePosition: "left", tone: "soft" },
      },
      {
        sectionKey: "home_experience",
        sectionType: WEBSITE_SECTION_TYPE.HOME_EXPERIENCE,
        sortOrder: 4,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          services: {
            eyebrow: "日常照护服务",
            title: "从一顿饭，到一段认真陪伴",
            description:
              "PetCare 围绕真实养宠场景提供上门喂养、遛狗与陪玩服务，让熟悉的环境、清楚的要求和可查看的过程一起降低托付的不确定。",
            action: action("了解服务模式", "/services"),
            items: [
              {
                itemKey: "feeding",
                label: "01",
                title: "上门喂养",
                description: "按约定完成喂食、换水与环境整理，让熟悉的家仍是它最安心的地方。",
                image: image("猫咪在家中进食"),
              },
              {
                itemKey: "walking",
                label: "02",
                title: "上门遛狗",
                description: "根据宠物习惯完成外出活动，并把关键过程清楚记录下来。",
                image: image("照护者在社区内遛狗"),
              },
              {
                itemKey: "playing",
                label: "03",
                title: "陪伴玩耍",
                description: "用合适的互动与观察，认真回应宠物独处时的陪伴需要。",
                image: image("两只狗在户外轻松玩耍"),
              },
            ],
          },
          journey: {
            eyebrow: "标准服务流程",
            title: "每一步都清楚，托付才更安心",
            description: "从提出需要到留下评价，关键动作有明确顺序，也有可以回看的服务记录。",
            action: null,
            items: [
              { itemKey: "request", title: "发布需求", description: "说明时间、地点与照护要求" },
              { itemKey: "match", title: "匹配宠托师", description: "查看资料、能力与评价记录" },
              { itemKey: "service", title: "上门服务", description: "按订单约定与 SOP 完成照护" },
              { itemKey: "records", title: "查看记录", description: "了解时间、步骤与服务媒体" },
              { itemKey: "review", title: "完成评价", description: "留下真实反馈，沉淀长期信任" },
            ],
          },
          record: {
            eyebrow: "照护记录",
            title: "不在家，也知道它今天过得怎么样",
            description:
              "服务不是一句「已经照顾好了」。PetCare 用标准步骤串起时间、图片、视频与服务反馈，让主人看见每一次认真完成的照护。",
            action: action("了解信任保障", "/trust"),
            demoTitle: "今日上门喂养",
            statusLabel: "服务进行中",
            steps: [
              { itemKey: "sanitize", time: "14:02", label: "进门消毒", state: "complete" },
              { itemKey: "check_in", time: "14:06", label: "拍照打卡", state: "complete" },
              { itemKey: "service", time: "14:12", label: "执行服务", state: "current" },
              { itemKey: "clean", time: "14:36", label: "清理现场", state: "pending" },
              { itemKey: "check_out", time: "14:42", label: "离开拍照", state: "pending" },
            ],
            images: [image("猫咪进食记录"), image("猫咪状态记录")],
            extraImageCount: 3,
            evidence: [
              { itemKey: "visible", title: "过程可见", description: "关键步骤按顺序留下记录" },
              {
                itemKey: "traceable",
                title: "信息可查",
                description: "时间与服务媒体共同说明结果",
              },
              {
                itemKey: "feedback",
                title: "异常可反馈",
                description: "发现问题时进入清楚的沟通与处理路径",
              },
            ],
          },
          trust: {
            eyebrow: "信任体系",
            title: "真正的安心，来自可以验证的细节",
            description: "不使用空泛口号。把身份、标准、过程和反馈放在用户需要判断的位置。",
            action: action("查看完整保障说明", "/trust"),
            items: [
              {
                itemKey: "identity",
                title: "身份与资料",
                description: "查看宠托师身份认证、服务资料与历史评价。",
              },
              {
                itemKey: "records",
                title: "标准与记录",
                description: "服务步骤、时间、图片与视频共同形成照护证据。",
              },
              {
                itemKey: "communication",
                title: "沟通与状态",
                description: "围绕订单持续沟通，并清楚了解当前服务进度。",
              },
              {
                itemKey: "appeal",
                title: "评价与申诉",
                description: "服务完成后可以评价；发生争议时有明确处理路径。",
              },
            ],
          },
          community: {
            eyebrow: "宠物生活",
            title: "这里不只有服务，还有认真爱宠物的人",
            description: "从日常相处到照护经验，让真实内容帮助更多宠物家庭做出更安心的选择。",
            action: action("阅读宠物课堂", "/articles"),
            items: [
              {
                itemKey: "daily_life",
                label: "宠物日常",
                title: "那些让普通一天变得柔软的小事",
                description: "",
                image: image("小狗安静地躺在沙发上休息"),
              },
              {
                itemKey: "care_guide",
                label: "养宠经验",
                title: "从状态观察开始，读懂它今天的需要",
                description: "",
                image: image("主人在家中为猫咪梳理毛发"),
              },
              {
                itemKey: "companionship",
                label: "陪伴故事",
                title: "认真相处，是服务之外更长久的连接",
                description: "",
                image: image("两只狗在户外自在互动"),
              },
            ],
          },
          brand: {
            eyebrow: "陪伴每一次托付",
            title: "因为它是家人，所以每一次托付都值得被认真对待。",
            description: "专业不是冰冷的流程，而是把关心变成清楚、稳定、可以被验证的行动。",
            image: image("猫和狗在自然光下安心相伴"),
          },
        },
        settings: {},
      },
      {
        sectionKey: "home_cta",
        sectionType: WEBSITE_SECTION_TYPE.CTA,
        sortOrder: 5,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "安心托付，不止于服务",
          description: "了解 PetCare 如何守护每一次照护。",
          primaryAction: action("了解信任保障", "/trust"),
          secondaryAction: action("联系我们", "/contact"),
        },
        settings: { tone: "brand", alignment: "center" },
      },
    ],
  },
  {
    contentKey: WEBSITE_CONTENT_KEY.SERVICES,
    contentType: "page",
    seo: {
      title: "服务模式｜PetCare 宠伴",
      description: "了解 PetCare 悬赏服务与平台服务。",
      canonicalPath: "/services",
      image: null,
    },
    sections: [
      {
        sectionKey: "hero",
        sectionType: WEBSITE_SECTION_TYPE.HERO,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "服务模式",
          title: "为不同照护需要提供合适选择",
          description: "悬赏服务强调灵活匹配，平台服务提供清晰定价。",
          primaryAction: action("了解信任保障", "/trust"),
          secondaryAction: null,
          image: image("多样化宠物照护服务"),
        },
        settings: { alignment: "left", imagePosition: "right" },
      },
      {
        sectionKey: "service_modes",
        sectionType: WEBSITE_SECTION_TYPE.FEATURE_SPLIT,
        sortOrder: 2,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "悬赏服务与平台服务",
          title: "灵活匹配，也有标准选择",
          description: "根据时间、场景和预算选择更适合的服务方式。",
          action: action("联系我们", "/contact"),
          image: image("宠托师提供专业照护"),
        },
        settings: { imagePosition: "left", tone: "plain" },
      },
      {
        sectionKey: "services_cta",
        sectionType: WEBSITE_SECTION_TYPE.CTA,
        sortOrder: 3,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "需要进一步了解？",
          description: "联系我们获取服务说明。",
          primaryAction: action("联系我们", "/contact"),
          secondaryAction: null,
        },
        settings: { tone: "soft", alignment: "center" },
      },
    ],
  },
  {
    contentKey: WEBSITE_CONTENT_KEY.TRUST,
    contentType: "page",
    seo: {
      title: "信任保障｜PetCare 宠伴",
      description: "了解认证、SOP、照护记录、评价及申诉处理机制。",
      canonicalPath: "/trust",
      image: null,
    },
    sections: [
      {
        sectionKey: "hero",
        sectionType: WEBSITE_SECTION_TYPE.HERO,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "信任保障",
          title: "每一次托付，都值得信赖",
          description: "以认证、标准、记录和反馈机制建立透明服务体验。",
          primaryAction: action("联系我们", "/contact"),
          secondaryAction: null,
          image: image("安心可信的宠物照护"),
        },
        settings: { alignment: "left", imagePosition: "background" },
      },
      {
        sectionKey: "trust_evidence",
        sectionType: WEBSITE_SECTION_TYPE.TRUST_GRID,
        sortOrder: 2,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "透明的服务保障",
          description: "关键环节有依据、有记录、有反馈。",
          items: [
            {
              itemKey: "verified",
              title: "认证",
              description: "核验服务身份。",
              icon: "certificate",
            },
            { itemKey: "sop", title: "SOP", description: "明确照护步骤。", icon: "clipboard" },
            { itemKey: "review", title: "评价", description: "积累真实反馈。", icon: "star" },
            { itemKey: "appeal", title: "申诉", description: "提供处理路径。", icon: "support" },
          ],
        },
        settings: { columns: 4 },
      },
      {
        sectionKey: "trust_process",
        sectionType: WEBSITE_SECTION_TYPE.FEATURE_SPLIT,
        sortOrder: 3,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "照护过程",
          title: "每一次照护，都有记录",
          description: "服务过程中的关键步骤形成可查看的照护记录。",
          action: null,
          image: image("记录宠物照护过程"),
        },
        settings: { imagePosition: "right", tone: "soft" },
      },
      {
        sectionKey: "trust_cta",
        sectionType: WEBSITE_SECTION_TYPE.CTA,
        sortOrder: 4,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "了解适合你的服务",
          description: "从服务模式开始认识 PetCare。",
          primaryAction: action("查看服务模式", "/services"),
          secondaryAction: null,
        },
        settings: { tone: "brand", alignment: "center" },
      },
    ],
  },
  {
    contentKey: WEBSITE_CONTENT_KEY.COMPANIONS,
    contentType: "page",
    seo: {
      title: "成为宠托师｜PetCare 宠伴",
      description: "了解宠托师加入条件、成长路径和公平机会。",
      canonicalPath: "/companions",
      image: null,
    },
    sections: [
      {
        sectionKey: "hero",
        sectionType: WEBSITE_SECTION_TYPE.HERO,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "成为宠托师",
          title: "用专业照护，守护每一次托付",
          description: "通过认证与学习，在清晰规则下获得公平服务机会。",
          primaryAction: action("联系我们", "/contact"),
          secondaryAction: null,
          image: image("宠托师陪伴宠物"),
        },
        settings: { alignment: "left", imagePosition: "right" },
      },
      {
        sectionKey: "companion_growth",
        sectionType: WEBSITE_SECTION_TYPE.FEATURE_SPLIT,
        sortOrder: 2,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "成长路径",
          title: "从认证到持续成长",
          description: "以服务标准、真实评价和持续学习建立专业能力。",
          action: action("了解信任保障", "/trust"),
          image: image("宠托师专业成长"),
        },
        settings: { imagePosition: "left", tone: "soft" },
      },
      {
        sectionKey: "companions_cta",
        sectionType: WEBSITE_SECTION_TYPE.CTA,
        sortOrder: 3,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "准备了解宠托师机会？",
          description: "联系我们获取加入说明。",
          primaryAction: action("联系我们", "/contact"),
          secondaryAction: null,
        },
        settings: { tone: "brand", alignment: "center" },
      },
    ],
  },
  {
    contentKey: WEBSITE_CONTENT_KEY.ABOUT,
    contentType: "page",
    seo: {
      title: "关于我们｜PetCare 宠伴",
      description: "认识 PetCare 的使命、价值观与品牌故事。",
      canonicalPath: "/about",
      image: null,
    },
    sections: [
      {
        sectionKey: "hero",
        sectionType: WEBSITE_SECTION_TYPE.HERO,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "关于 PetCare",
          title: "让照护关系更值得信赖",
          description: "连接宠物家庭与专业宠托师，建立透明、专业的照护体验。",
          primaryAction: action("了解服务", "/services"),
          secondaryAction: null,
          image: image("PetCare 团队与宠物"),
        },
        settings: { alignment: "left", imagePosition: "right" },
      },
      {
        sectionKey: "mission",
        sectionType: WEBSITE_SECTION_TYPE.RICH_TEXT,
        sortOrder: 2,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "我们的使命",
          effectiveDate: null,
          parts: [
            {
              partKey: "mission",
              heading: "透明、专业、可信赖",
              paragraphs: ["让每一次宠物照护都更加透明、专业、可信赖。"],
            },
          ],
        },
        settings: { width: "normal" },
      },
      {
        sectionKey: "brand_story",
        sectionType: WEBSITE_SECTION_TYPE.FEATURE_SPLIT,
        sortOrder: 3,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "品牌承诺",
          title: "陪伴每一次托付",
          description: "我们关注的不只是一次服务，而是长期可信赖的照护关系。",
          action: null,
          image: image("PetCare 品牌陪伴"),
        },
        settings: { imagePosition: "left", tone: "plain" },
      },
      {
        sectionKey: "about_cta",
        sectionType: WEBSITE_SECTION_TYPE.CTA,
        sortOrder: 4,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "与我们建立联系",
          description: "了解合作与服务信息。",
          primaryAction: action("联系我们", "/contact"),
          secondaryAction: null,
        },
        settings: { tone: "soft", alignment: "center" },
      },
    ],
  },
  {
    contentKey: WEBSITE_CONTENT_KEY.CONTACT,
    contentType: "page",
    seo: {
      title: "联系我们｜PetCare 宠伴",
      description: "联系 PetCare 客服或商务合作团队。",
      canonicalPath: "/contact",
      image: null,
    },
    sections: [
      {
        sectionKey: "hero",
        sectionType: WEBSITE_SECTION_TYPE.HERO,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          eyebrow: "联系我们",
          title: "我们愿意倾听你的需要",
          description: "通过公开渠道获取客服与商务合作支持。",
          primaryAction: null,
          secondaryAction: null,
          image: image("PetCare 联系支持"),
        },
        settings: { alignment: "center", imagePosition: "background" },
      },
      {
        sectionKey: "contact_channels",
        sectionType: WEBSITE_SECTION_TYPE.CONTACT_PANEL,
        sortOrder: 2,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "联系渠道",
          description: "以下信息为初始占位内容，发布前请由运营确认。",
          channels: [
            {
              channelKey: "customer_service",
              isEnabled: false,
              label: "客服电话",
              value: "待运营配置",
              href: "/contact",
              availability: "工作时间待运营配置",
            },
            {
              channelKey: "business",
              isEnabled: false,
              label: "客服邮箱",
              value: "待运营配置",
              href: "/contact",
              availability: "工作时间待运营配置",
            },
          ],
        },
        settings: { columns: 2 },
      },
      {
        sectionKey: "contact_cta",
        sectionType: WEBSITE_SECTION_TYPE.CTA,
        sortOrder: 3,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "先了解我们的服务",
          description: "查看服务模式与信任保障。",
          primaryAction: action("服务模式", "/services"),
          secondaryAction: action("信任保障", "/trust"),
        },
        settings: { tone: "soft", alignment: "center" },
      },
    ],
  },
  {
    contentKey: WEBSITE_CONTENT_KEY.HELP,
    contentType: "page",
    seo: {
      title: "帮助中心｜PetCare 宠伴",
      description: "PetCare 小程序常见问题与使用指南。",
      canonicalPath: "/help",
      image: null,
    },
    sections: [
      helpSection("account_and_identity", 1, "账号与认证", [
        {
          partKey: "complete_profile",
          heading: "如何完善个人信息？",
          paragraphs: ["进入“我的－个人信息－编辑个人信息”，验证手机号后即可完成资料。"],
        },
        {
          partKey: "wechat_profile",
          heading: "如何修改头像和昵称？",
          paragraphs: ["在编辑个人信息页主动选择微信头像并填写微信昵称，保存后即可更新。"],
        },
      ]),
      helpSection("bounty_and_orders", 2, "悬赏与订单", [
        {
          partKey: "publish_bounty",
          heading: "如何发布悬赏？",
          paragraphs: ["进入悬赏大厅并点击发布按钮，资料完善后按页面步骤填写需求。"],
        },
        {
          partKey: "publish_blocked",
          heading: "为什么暂时无法发布？",
          paragraphs: ["请先确认已经登录并通过短信验证手机号；页面会引导你完善资料。"],
        },
      ]),
      helpSection("care_records", 3, "服务记录", [
        {
          partKey: "service_progress",
          heading: "怎样查看服务进度？",
          paragraphs: ["从订单列表进入订单详情，可查看该订单已经开放的服务进度与照护记录。"],
        },
        {
          partKey: "service_issue",
          heading: "遇到服务问题怎么办？",
          paragraphs: ["请保留订单编号和相关记录，再通过“联系客服”页面选择已配置的渠道。"],
        },
      ]),
      helpSection("fees_and_benefits", 4, "费用与优惠", [
        {
          partKey: "coupon_location",
          heading: "优惠券在哪里查看？",
          paragraphs: ["进入“我的”页面并点击“优惠券”即可查看当前页面提供的优惠信息。"],
        },
        {
          partKey: "fee_reference",
          heading: "服务费用以哪里为准？",
          paragraphs: ["实际费用以提交订单前的确认页面和最终订单记录为准。"],
        },
      ]),
    ],
  },
  ...[
    {
      contentKey: WEBSITE_CONTENT_KEY.PRIVACY,
      title: "隐私政策",
      description: "PetCare 隐私政策。",
      canonicalPath: "/privacy" as const,
    },
    {
      contentKey: WEBSITE_CONTENT_KEY.TERMS,
      title: "服务条款",
      description: "PetCare 服务条款。",
      canonicalPath: "/terms" as const,
    },
  ].map(({ contentKey, title, description, canonicalPath }): WebsiteSeedTemplate => ({
    contentKey,
    contentType: "page",
    seo: { title: `${title}｜PetCare 宠伴`, description, canonicalPath, image: null },
    sections: [
      {
        sectionKey: "legal_content",
        sectionType: WEBSITE_SECTION_TYPE.RICH_TEXT,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title,
          effectiveDate: null,
          parts: [
            {
              partKey: "review_required",
              heading: "内容待审核",
              paragraphs: ["本页正式内容需经业务与法务审核后显式发布。"],
            },
          ],
        },
        settings: { width: "normal" },
      },
    ],
  })),
];

interface StoredContactVersion {
  id: string;
  websiteContentId: string;
  status: string;
  revision: number;
  businessVersion: number | null;
  seo: unknown;
  sourceVersionId: string | null;
  idempotencyKey: string | null;
  changeSummary: string;
  createdById: string;
  publishedById: string | null;
  publishedAt: Date | null;
  sections: Array<{
    sectionKey: string;
    sectionType: string;
    sortOrder: number;
    isEnabled: boolean;
    schemaVersion: number;
    content: unknown;
    settings: unknown;
  }>;
}

function sectionSnapshots(sections: StoredContactVersion["sections"]) {
  return sections.map(
    ({ sectionKey, sectionType, sortOrder, isEnabled, schemaVersion, content, settings }) => ({
      sectionKey,
      sectionType,
      sortOrder,
      isEnabled,
      schemaVersion,
      content,
      settings,
    }),
  );
}

function legacyContactSections(template: WebsiteSeedTemplate): WebsiteContentSection[] {
  return template.sections.map((section) =>
    section.sectionType === WEBSITE_SECTION_TYPE.CONTACT_PANEL
      ? {
          ...structuredClone(section),
          content: {
            ...structuredClone(section.content),
            channels: structuredClone(LEGACY_CONTACT_CHANNELS),
          },
        }
      : structuredClone(section),
  );
}

function isUntouchedLegacyContactSeed(
  content: {
    id: string;
    contentType: string;
    currentDraftVersionId: string | null;
    publishedVersionId: string | null;
  },
  versions: StoredContactVersion[],
  template: WebsiteSeedTemplate,
): boolean {
  if (
    content.contentType !== template.contentType ||
    !content.currentDraftVersionId ||
    !content.publishedVersionId ||
    versions.length !== 2
  ) {
    return false;
  }

  const published = versions.find((version) => version.id === content.publishedVersionId);
  const draft = versions.find((version) => version.id === content.currentDraftVersionId);
  const originalOperatorId = published?.createdById;

  if (!published || !draft || !originalOperatorId) {
    return false;
  }

  const legacySections = legacyContactSections(template);
  const actual = [published, draft].map((version) => ({
    id: version.id,
    websiteContentId: version.websiteContentId,
    status: version.status,
    revision: version.revision,
    businessVersion: version.businessVersion,
    seo: version.seo,
    sourceVersionId: version.sourceVersionId,
    idempotencyKey: version.idempotencyKey,
    changeSummary: version.changeSummary,
    createdById: version.createdById,
    publishedById: version.publishedById ?? null,
    hasPublishedAt: version.publishedAt !== null && version.publishedAt !== undefined,
    sections: sectionSnapshots(version.sections),
  }));
  const expected = [
    {
      id: published.id,
      websiteContentId: content.id,
      status: WEBSITE_CONTENT_STATUS.PUBLISHED,
      revision: 1,
      businessVersion: 1,
      seo: template.seo,
      sourceVersionId: null,
      idempotencyKey: `seed:${WEBSITE_CONTENT_KEY.CONTACT}:published:v1`,
      changeSummary: "初始化官网内容",
      createdById: originalOperatorId,
      publishedById: originalOperatorId,
      hasPublishedAt: true,
      sections: legacySections,
    },
    {
      id: draft.id,
      websiteContentId: content.id,
      status: WEBSITE_CONTENT_STATUS.DRAFT,
      revision: 2,
      businessVersion: null,
      seo: template.seo,
      sourceVersionId: published.id,
      idempotencyKey: null,
      changeSummary: "从初始发布版本创建可编辑草稿",
      createdById: originalOperatorId,
      publishedById: null,
      hasPublishedAt: false,
      sections: legacySections,
    },
  ];

  return isDeepStrictEqual(
    JSON.parse(JSON.stringify(actual)),
    JSON.parse(JSON.stringify(expected)),
  );
}

async function upsertSections(
  tx: Prisma.TransactionClient,
  versionId: string,
  sections: readonly WebsiteContentSection[],
): Promise<void> {
  await Promise.all(
    sections.map((section) =>
      tx.websiteContentSection.upsert({
        where: {
          versionId_sectionKey: { versionId, sectionKey: section.sectionKey },
        },
        update: {},
        create: {
          versionId,
          sectionKey: section.sectionKey,
          sectionType: section.sectionType,
          sortOrder: section.sortOrder,
          isEnabled: section.isEnabled,
          schemaVersion: section.schemaVersion,
          content: section.content as unknown as Prisma.InputJsonValue,
          settings: section.settings as unknown as Prisma.InputJsonValue,
        },
      }),
    ),
  );
}

async function upgradeUntouchedLegacyContactSeed(
  tx: Prisma.TransactionClient,
  content: {
    id: string;
    contentType: string;
    currentDraftVersionId: string | null;
    publishedVersionId: string | null;
  },
  template: WebsiteSeedTemplate,
  operatorId: string,
): Promise<void> {
  const storedVersions = (await tx.websiteContentVersion.findMany({
    where: { websiteContentId: content.id },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
    orderBy: { revision: "asc" },
  })) as unknown as StoredContactVersion[];

  if (!isUntouchedLegacyContactSeed(content, storedVersions, template)) {
    return;
  }

  const published = await tx.websiteContentVersion.upsert({
    where: {
      websiteContentId_revision: { websiteContentId: content.id, revision: 3 },
    },
    update: {},
    create: {
      websiteContentId: content.id,
      status: WEBSITE_CONTENT_STATUS.PUBLISHED,
      revision: 3,
      businessVersion: 2,
      seo: template.seo as unknown as Prisma.InputJsonValue,
      sourceVersionId: content.currentDraftVersionId,
      idempotencyKey: null,
      changeSummary: "停用待运营配置的联系渠道",
      createdById: operatorId,
      publishedById: operatorId,
      publishedAt: new Date(),
    },
  });

  if (
    published.websiteContentId !== content.id ||
    published.revision !== 3 ||
    published.status !== WEBSITE_CONTENT_STATUS.PUBLISHED ||
    published.businessVersion !== 2 ||
    published.sourceVersionId !== content.currentDraftVersionId
  ) {
    throw new Error("Contact seed published-version collision");
  }

  const draft = await tx.websiteContentVersion.upsert({
    where: {
      websiteContentId_revision: { websiteContentId: content.id, revision: 4 },
    },
    update: {},
    create: {
      websiteContentId: content.id,
      status: WEBSITE_CONTENT_STATUS.DRAFT,
      revision: 4,
      businessVersion: null,
      seo: template.seo as unknown as Prisma.InputJsonValue,
      sourceVersionId: published.id,
      idempotencyKey: null,
      changeSummary: "从安全联系渠道版本创建可编辑草稿",
      createdById: operatorId,
    },
  });

  if (
    draft.websiteContentId !== content.id ||
    draft.revision !== 4 ||
    draft.status !== WEBSITE_CONTENT_STATUS.DRAFT ||
    draft.businessVersion !== null ||
    draft.sourceVersionId !== published.id
  ) {
    throw new Error("Contact seed draft-version collision");
  }

  await Promise.all([
    upsertSections(tx, published.id, template.sections),
    upsertSections(tx, draft.id, template.sections),
  ]);
  await tx.websiteContentVersion.updateMany({
    where: {
      websiteContentId: content.id,
      id: { in: [content.publishedVersionId!, content.currentDraftVersionId!] },
    },
    data: { status: WEBSITE_CONTENT_STATUS.SUPERSEDED },
  });
  await tx.websiteContent.update({
    where: { id: content.id },
    data: { currentDraftVersionId: draft.id, publishedVersionId: published.id },
  });
}

async function seedTemplate(
  tx: Prisma.TransactionClient,
  template: WebsiteSeedTemplate,
  operatorId: string,
): Promise<void> {
  const content = await tx.websiteContent.upsert({
    where: { contentKey: template.contentKey },
    update: {},
    create: {
      contentKey: template.contentKey,
      contentType: template.contentType,
    },
  });

  if (content.currentDraftVersionId !== null || content.publishedVersionId !== null) {
    if (template.contentKey === WEBSITE_CONTENT_KEY.CONTACT) {
      await upgradeUntouchedLegacyContactSeed(tx, content, template, operatorId);
    }

    return;
  }

  const published = await tx.websiteContentVersion.upsert({
    where: { idempotencyKey: `seed:${template.contentKey}:published:v1` },
    update: {},
    create: {
      websiteContentId: content.id,
      status: WEBSITE_CONTENT_STATUS.PUBLISHED,
      revision: 1,
      businessVersion: 1,
      seo: template.seo as unknown as Prisma.InputJsonValue,
      sourceVersionId: null,
      idempotencyKey: `seed:${template.contentKey}:published:v1`,
      changeSummary: "初始化官网内容",
      createdById: operatorId,
      publishedById: operatorId,
      publishedAt: new Date(),
    },
  });

  const draft = await tx.websiteContentVersion.upsert({
    where: {
      websiteContentId_revision: {
        websiteContentId: content.id,
        revision: 2,
      },
    },
    update: {},
    create: {
      websiteContentId: content.id,
      status: WEBSITE_CONTENT_STATUS.DRAFT,
      revision: 2,
      businessVersion: null,
      seo: template.seo as unknown as Prisma.InputJsonValue,
      sourceVersionId: published.id,
      idempotencyKey: null,
      changeSummary: "从初始发布版本创建可编辑草稿",
      createdById: operatorId,
    },
  });

  await Promise.all([
    upsertSections(tx, published.id, template.sections),
    upsertSections(tx, draft.id, template.sections),
  ]);
  await tx.websiteContent.update({
    where: { id: content.id },
    data: {
      currentDraftVersionId: draft.id,
      publishedVersionId: published.id,
    },
  });
}

/** Seeds an initial published snapshot and editable draft without replacing later operator work. */
export async function seedWebsiteContent(prisma: PrismaClient, operatorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await WEBSITE_CONTENT_SEED_TEMPLATES.reduce(async (previous, template) => {
      await previous;
      await seedTemplate(tx, template, operatorId);
    }, Promise.resolve());
  });
}
