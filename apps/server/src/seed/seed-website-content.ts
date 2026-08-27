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

const LEGACY_CONTACT_SEO = {
  title: "联系我们｜PetCare 宠伴",
  description: "联系 PetCare 客服或商务合作团队。",
  canonicalPath: "/contact",
  image: null,
} satisfies WebsiteSeoContent;

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

/** Deterministic initial Content Version templates used by the seed and fixed registry. */
export const WEBSITE_CONTENT_SEED_TEMPLATES: readonly WebsiteSeedTemplate[] = [
  {
    contentKey: WEBSITE_CONTENT_KEY.SITE_SHELL,
    contentType: "global",
    seo: {
      title: "PetCare 宠伴",
      description: "用于管理宠物档案、阅读养宠内容和分享真实日常的个人版原型。",
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
            { itemKey: "home", label: "首页", href: "/" },
            { itemKey: "articles", label: "萌宠课堂", href: "/articles" },
            { itemKey: "about", label: "关于我们", href: "/about" },
          ],
          action: action("了解当前范围", "/about"),
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
          description: "记录真实的养宠日常。",
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
      title: "PetCare 宠伴｜记录真实养宠日常",
      description: "管理本人宠物档案，阅读萌宠课堂，并参与受控社区。",
      canonicalPath: "/",
      image: image("猫和狗在自然光下安心相伴"),
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
          title: "记录每一次陪伴",
          description: "从宠物档案到养宠内容，把真实日常整理在一个可本地验收的个人版原型中。",
          primaryAction: action("阅读萌宠课堂", "/articles"),
          secondaryAction: action("了解当前范围", "/about"),
          image: image("猫和狗在自然光下安心相伴"),
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
          title: "当前能力，清楚可见",
          description: "只呈现已经具备真实数据、权限和状态处理的个人版能力。",
          items: [
            {
              itemKey: "pet_profiles",
              title: "宠物档案",
              description: "本人维护宠物资料、日常备注与受管理图片。",
              icon: "clipboard",
            },
            {
              itemKey: "classroom",
              title: "萌宠课堂",
              description: "按分类和关键词浏览已经发布的养宠文章。",
              icon: "star",
            },
            {
              itemKey: "community",
              title: "受控社区",
              description: "动态经过审核，并提供点赞、评论、举报与通知。",
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
          eyebrow: "个人开发版",
          title: "围绕宠物资料与内容体验保持小而真实",
          description: "当前范围聚焦账户、宠物档案、课堂和受控社区，不用未来设想代替可运行能力。",
          action: action("查看范围说明", "/about"),
          image: image("主人陪伴宠物的日常场景"),
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
            eyebrow: "当前个人版能力",
            title: "从宠物档案，到真实养宠内容",
            description:
              "PetCare 当前提供本人宠物档案、萌宠课堂与受控社区，并明确保持个人、本地原型边界。",
            action: action("阅读萌宠课堂", "/articles"),
            items: [
              {
                itemKey: "pet_profiles",
                label: "01",
                title: "宠物档案",
                description: "维护本人宠物的基础资料、日常备注与照片，让信息持续可查。",
                image: image("猫咪的日常档案照片"),
              },
              {
                itemKey: "classroom",
                label: "02",
                title: "萌宠课堂",
                description: "阅读已经发布的养宠文章，并通过分类与搜索找到需要的内容。",
                image: image("主人为猫咪梳理毛发"),
              },
              {
                itemKey: "community",
                label: "03",
                title: "受控社区",
                description: "发布真实养宠日常，浏览审核通过的动态并参与受控互动。",
                image: image("两只狗在户外轻松玩耍"),
              },
            ],
          },
          journey: {
            eyebrow: "当前使用路径",
            title: "每一步都有真实页面和状态",
            description:
              "从账户与宠物档案，到课堂、社区和互动通知，当前能力都由真实数据与明确状态支撑。",
            action: null,
            items: [
              { itemKey: "account", title: "登录账户", description: "建立本地会话并维护个人资料" },
              { itemKey: "pet", title: "记录宠物", description: "创建档案并管理本人宠物照片" },
              {
                itemKey: "classroom",
                title: "浏览课堂",
                description: "按分类或关键词阅读已发布文章",
              },
              {
                itemKey: "community",
                title: "分享日常",
                description: "提交文字或图片动态等待审核",
              },
              {
                itemKey: "interaction",
                title: "参与互动",
                description: "使用点赞、评论、举报与站内通知",
              },
            ],
          },
          record: {
            eyebrow: "宠物档案示例",
            title: "把重要资料整理在一个地方",
            description:
              "从基本信息、日常习惯到照片管理，PetCare 让本人宠物资料保持清楚，并在删除时保护仍有关联的记录。",
            action: action("了解当前范围", "/about"),
            demoTitle: "宠物档案示例",
            statusLabel: "资料维护中",
            steps: [
              { itemKey: "basics", time: "01", label: "基本资料", state: "complete" },
              { itemKey: "habits", time: "02", label: "日常习惯", state: "complete" },
              { itemKey: "health", time: "03", label: "健康备注", state: "complete" },
              { itemKey: "photos", time: "04", label: "照片管理", state: "current" },
              { itemKey: "save", time: "05", label: "确认保存", state: "pending" },
            ],
            images: [image("猫咪宠物档案照片"), image("猫咪日常状态照片")],
            extraImageCount: 3,
            evidence: [
              { itemKey: "owned", title: "本人维护", description: "跨账户访问会被拒绝" },
              {
                itemKey: "editable",
                title: "持续更新",
                description: "资料、备注与照片可以维护",
              },
              {
                itemKey: "protected",
                title: "关联保护",
                description: "受保护记录存在时拒绝误删",
              },
            ],
          },
          trust: {
            eyebrow: "范围与数据边界",
            title: "只陈述当前已经具备的能力",
            description:
              "当前只呈现账户、宠物档案、内容阅读和受控互动，并让权限与状态边界保持可验证。",
            action: action("查看个人版说明", "/about"),
            items: [
              {
                itemKey: "scope",
                title: "个人版边界",
                description: "只呈现账户、宠物档案、课堂与受控社区等当前能力。",
              },
              {
                itemKey: "ownership",
                title: "本人数据",
                description: "宠物档案和受管理图片由当前账户维护，并校验所有权。",
              },
              {
                itemKey: "governance",
                title: "内容治理",
                description: "社区动态经过审核，并提供举报、下架和互动边界。",
              },
              {
                itemKey: "local",
                title: "本地验收",
                description: "当前版本用于本地开发与演示，所有能力以可运行链路为准。",
              },
            ],
          },
          community: {
            eyebrow: "宠物生活",
            title: "记录真实日常，也分享可靠的养宠内容",
            description:
              "从日常相处到养宠经验，已发布的课堂文章与审核通过的社区动态共同组成当前内容空间。",
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
                title: "认真相处，让每一段日常都值得记录",
                description: "",
                image: image("两只狗在户外自在互动"),
              },
            ],
          },
          brand: {
            eyebrow: "记录每一次陪伴",
            title: "因为它是家人，所以每一段日常都值得被认真记录。",
            description: "PetCare 个人版把宠物档案、养宠内容和受控社区放在一个可本地验收的原型里。",
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
          title: "从真实能力开始了解 PetCare",
          description: "阅读萌宠课堂，或查看个人开发版的当前范围与限制。",
          primaryAction: action("阅读萌宠课堂", "/articles"),
          secondaryAction: action("了解当前范围", "/about"),
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
      description: "了解 PetCare 个人开发版的当前范围、原则与实现边界。",
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
          title: "一个聚焦宠物档案与内容体验的个人项目",
          description: "当前围绕账户、宠物档案、萌宠课堂和受控社区，维护真实可运行的本地原型。",
          primaryAction: action("阅读萌宠课堂", "/articles"),
          secondaryAction: null,
          image: image("主人与宠物相伴的日常"),
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
              heading: "小而真实，清楚可验收",
              paragraphs: [
                "只呈现已经具备页面、数据与权限边界的当前能力，并把未来设想留在路线图中。",
              ],
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
          eyebrow: "项目原则",
          title: "记录每一次陪伴",
          description: "从本人宠物档案和养宠内容开始，让每一项功能都保持可理解、可验证和可维护。",
          action: null,
          image: image("宠物与主人一起生活的温暖画面"),
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
          title: "继续了解当前内容",
          description: "阅读已经发布的萌宠课堂内容，或查看当前启用的联系渠道。",
          primaryAction: action("阅读萌宠课堂", "/articles"),
          secondaryAction: action("查看联系渠道", "/contact"),
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
      description: "查看 PetCare 当前已启用的项目联系渠道。",
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
          eyebrow: "项目联系",
          title: "联系信息以当前页面为准",
          description: "只有已经启用并公开显示的渠道，才是 PetCare 当前可用的联系方式。",
          primaryAction: null,
          secondaryAction: null,
          image: image("主人记录宠物日常"),
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
          description: "当前没有启用的公开联系渠道。",
          channels: [
            {
              channelKey: "customer_service",
              isEnabled: false,
              label: "项目邮箱",
              value: "未启用",
              href: "/contact",
              availability: "未启用",
            },
            {
              channelKey: "business",
              isEnabled: false,
              label: "问题反馈",
              value: "未启用",
              href: "/contact",
              availability: "未启用",
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
          title: "先了解当前项目",
          description: "查看个人开发版的当前范围，或阅读已经发布的养宠内容。",
          primaryAction: action("了解当前范围", "/about"),
          secondaryAction: action("阅读萌宠课堂", "/articles"),
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
      helpSection("account_and_profile", 1, "账户与资料", [
        {
          partKey: "complete_profile",
          heading: "如何完善个人信息？",
          paragraphs: ["登录后进入“我的”页面打开个人资料，按页面提示补充并保存当前支持的信息。"],
        },
        {
          partKey: "wechat_profile",
          heading: "如何修改头像和昵称？",
          paragraphs: ["在编辑个人信息页主动选择微信头像并填写微信昵称，保存后即可更新。"],
        },
      ]),
      helpSection("pet_profiles", 2, "宠物档案", [
        {
          partKey: "create_pet",
          heading: "如何创建或更新宠物档案？",
          paragraphs: [
            "进入宠物档案页面新增宠物，填写当前支持的资料与备注；之后可从档案详情继续更新。",
          ],
        },
        {
          partKey: "delete_pet",
          heading: "为什么暂时不能删除档案？",
          paragraphs: ["当档案仍有关联记录时，系统会拒绝误删并提示先处理对应记录。"],
        },
      ]),
      helpSection("classroom", 3, "萌宠课堂", [
        {
          partKey: "browse_articles",
          heading: "如何查找养宠文章？",
          paragraphs: ["进入萌宠课堂后，可按分类浏览或使用关键词搜索已经发布的文章。"],
        },
        {
          partKey: "article_unavailable",
          heading: "为什么文章暂时无法查看？",
          paragraphs: ["文章可能尚未发布或已经下架；返回列表后可继续阅读当前可见内容。"],
        },
      ]),
      helpSection("community", 4, "受控社区", [
        {
          partKey: "publish_post",
          heading: "如何分享养宠日常？",
          paragraphs: ["完善个人资料后可提交文字或图片动态；内容通过审核后才会出现在公开列表。"],
        },
        {
          partKey: "community_interactions",
          heading: "社区支持哪些互动？",
          paragraphs: ["当前支持点赞、评论、举报和站内通知；违规内容可被拒绝、下架或限制互动。"],
        },
      ]),
    ],
  },
  {
    contentKey: WEBSITE_CONTENT_KEY.PRIVACY,
    contentType: "page",
    seo: {
      title: "隐私政策｜PetCare 宠伴",
      description: "PetCare 隐私政策。",
      canonicalPath: "/privacy",
      image: null,
    },
    sections: [
      {
        sectionKey: "legal_content",
        sectionType: WEBSITE_SECTION_TYPE.RICH_TEXT,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "隐私政策",
          effectiveDate: "2026-08-27",
          parts: [
            {
              partKey: "scope",
              heading: "一、适用范围",
              paragraphs: [
                "本政策适用于 PetCare 个人版网站及跨端客户端当前提供的账户、宠物档案、萌宠课堂、受控社区与问题反馈功能。我们遵循合法、正当、必要和诚信原则处理个人信息，并尽量将处理范围限制在实现功能所必需的最小范围。",
              ],
            },
            {
              partKey: "information_collected",
              heading: "二、我们处理的信息",
              paragraphs: [
                "为完成微信登录，我们会处理微信登录临时凭证并保存用于识别账号的微信 OpenID；首次登录后会分配随机昵称和默认头像。",
                "当你主动完善资料时，我们会处理你选择提交的头像、昵称、所在地区和个人简介；启用短信验证时，还会处理经验证的手机号码。",
                "当你使用宠物档案和受控社区时，我们会处理你主动提交的宠物资料、图片、动态、评论、点赞、举报、通知状态及相应操作记录。",
              ],
            },
            {
              partKey: "information_use",
              heading: "三、信息使用目的",
              paragraphs: [
                "我们使用上述信息完成账号识别和安全校验、维护本人宠物档案、展示已发布内容、处理受控社区互动与问题反馈，并维护系统安全。",
              ],
            },
            {
              partKey: "service_providers",
              heading: "四、第三方服务",
              paragraphs: [
                "当前会使用微信登录；只有在相应配置启用时，才会使用短信验证和对象存储。我们仅在实现对应功能所需的范围内传递信息，相关提供方也可能依据其公开规则处理信息。",
              ],
            },
            {
              partKey: "retention_and_security",
              heading: "五、保存与安全",
              paragraphs: [
                "我们在实现处理目的所需的期限以及法律法规要求的期限内保存信息，并采取访问控制、传输保护、日志脱敏和备份等合理措施保护信息安全。期限届满后，将依法删除、匿名化处理或停止除存储和安全保护之外的处理。",
              ],
            },
            {
              partKey: "your_rights",
              heading: "六、你的权利",
              paragraphs: [
                "你可以在“我的”页面查看和修改个人资料、退出登录或申请注销账户，也可以通过联系页面已启用的渠道提出查阅、更正、删除个人信息或解释本政策的请求。法律法规另有规定的除外。",
              ],
            },
            {
              partKey: "minors",
              heading: "七、未成年人保护",
              paragraphs: [
                "未满十四周岁的用户应在父母或其他监护人同意和指导下使用本项目。若监护人发现相关个人信息未经同意被处理，可通过当前已启用的联系渠道提出请求。",
              ],
            },
            {
              partKey: "updates_and_contact",
              heading: "八、政策更新与联系",
              paragraphs: [
                "政策更新后会通过本页面发布。若处理目的、方式或信息种类发生重要变化，我们会依法重新履行告知或取得同意义务。联系渠道以联系页面当前启用的配置为准。",
              ],
            },
          ],
        },
        settings: { width: "normal" },
      },
    ],
  },
  {
    contentKey: WEBSITE_CONTENT_KEY.TERMS,
    contentType: "page",
    seo: {
      title: "服务条款｜PetCare 宠伴",
      description: "PetCare 服务条款。",
      canonicalPath: "/terms",
      image: null,
    },
    sections: [
      {
        sectionKey: "legal_content",
        sectionType: WEBSITE_SECTION_TYPE.RICH_TEXT,
        sortOrder: 1,
        isEnabled: true,
        schemaVersion: 1,
        content: {
          title: "服务条款",
          effectiveDate: "2026-08-27",
          parts: [
            {
              partKey: "scope_and_acceptance",
              heading: "一、适用范围",
              paragraphs: [
                "本条款适用于 PetCare 个人版网站及跨端客户端当前已经提供的功能。使用本项目即表示你已阅读并同意遵守本条款；不同意时请停止使用。",
              ],
            },
            {
              partKey: "account_and_data",
              heading: "二、账户与本人数据",
              paragraphs: [
                "你应妥善使用自己的账户，并保证主动提交的信息真实、合法。宠物档案和受管理图片仅供对应账户维护，不得尝试访问或修改他人数据。",
              ],
            },
            {
              partKey: "content_rules",
              heading: "三、内容与互动规则",
              paragraphs: [
                "发布动态、评论或其他内容时，不得侵犯他人权益、传播违法有害信息或干扰正常使用。内容可能经过审核，并可因违反规则被拒绝、下架或限制互动。",
              ],
            },
            {
              partKey: "availability",
              heading: "四、可用性与限制",
              paragraphs: [
                "PetCare 当前用于个人开发、本地演示和功能验证，不承诺持续可用或对外运营。实际能力以当前界面和已发布说明为准。",
              ],
            },
            {
              partKey: "account_closure",
              heading: "五、停止使用与联系",
              paragraphs: [
                "你可以退出登录，并在产品提供相应入口时申请注销账户。需要查询条款或个人信息处理情况时，请使用联系页面当前已启用的渠道。",
              ],
            },
          ],
        },
        settings: { width: "normal" },
      },
    ],
  },
];

interface StoredSeedVersion {
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

function sectionSnapshots(sections: StoredSeedVersion["sections"]) {
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

function legacyContactSections(): WebsiteContentSection[] {
  return [
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
        channels: structuredClone(LEGACY_CONTACT_CHANNELS),
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
  ];
}

function legacyPrivacySections(template: WebsiteSeedTemplate): WebsiteContentSection[] {
  return template.sections.map((section) =>
    section.sectionType === WEBSITE_SECTION_TYPE.RICH_TEXT && section.sectionKey === "legal_content"
      ? {
          ...structuredClone(section),
          content: {
            title: "隐私政策",
            effectiveDate: null,
            parts: [
              {
                partKey: "review_required",
                heading: "内容待审核",
                paragraphs: ["本页正式内容需经业务与法务审核后显式发布。"],
              },
            ],
          },
        }
      : structuredClone(section),
  );
}

function isUntouchedInitialSeed(
  content: {
    id: string;
    contentType: string;
    currentDraftVersionId: string | null;
    publishedVersionId: string | null;
  },
  versions: StoredSeedVersion[],
  template: WebsiteSeedTemplate,
  originalSections: WebsiteContentSection[],
  originalSeo: WebsiteSeoContent = template.seo,
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
      seo: originalSeo,
      sourceVersionId: null,
      idempotencyKey: `seed:${template.contentKey}:published:v1`,
      changeSummary: "初始化官网内容",
      createdById: originalOperatorId,
      publishedById: originalOperatorId,
      hasPublishedAt: true,
      sections: originalSections,
    },
    {
      id: draft.id,
      websiteContentId: content.id,
      status: WEBSITE_CONTENT_STATUS.DRAFT,
      revision: 2,
      businessVersion: null,
      seo: originalSeo,
      sourceVersionId: published.id,
      idempotencyKey: null,
      changeSummary: "从初始发布版本创建可编辑草稿",
      createdById: originalOperatorId,
      publishedById: null,
      hasPublishedAt: false,
      sections: originalSections,
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

async function upgradeUntouchedInitialSeed(
  tx: Prisma.TransactionClient,
  content: {
    id: string;
    contentType: string;
    currentDraftVersionId: string | null;
    publishedVersionId: string | null;
  },
  template: WebsiteSeedTemplate,
  operatorId: string,
  originalSections: WebsiteContentSection[],
  changeSummary: string,
  originalSeo: WebsiteSeoContent = template.seo,
): Promise<void> {
  const storedVersions = (await tx.websiteContentVersion.findMany({
    where: { websiteContentId: content.id },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
    orderBy: { revision: "asc" },
  })) as unknown as StoredSeedVersion[];

  if (!isUntouchedInitialSeed(content, storedVersions, template, originalSections, originalSeo)) {
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
      changeSummary,
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
    throw new Error(`${template.contentKey} seed published-version collision`);
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
      changeSummary: "从升级后的发布版本创建可编辑草稿",
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
    throw new Error(`${template.contentKey} seed draft-version collision`);
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
      await upgradeUntouchedInitialSeed(
        tx,
        content,
        template,
        operatorId,
        legacyContactSections(),
        "停用待运营配置的联系渠道",
        LEGACY_CONTACT_SEO,
      );
    } else if (template.contentKey === WEBSITE_CONTENT_KEY.PRIVACY) {
      await upgradeUntouchedInitialSeed(
        tx,
        content,
        template,
        operatorId,
        legacyPrivacySections(template),
        "发布基础隐私政策",
      );
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
