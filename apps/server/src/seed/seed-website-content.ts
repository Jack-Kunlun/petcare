import {
  WEBSITE_CONTENT_KEY,
  WEBSITE_CONTENT_STATUS,
  WEBSITE_SECTION_TYPE,
  type WebsiteContentKey,
  type WebsiteContentSection,
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
        sectionKey: "home_cta",
        sectionType: WEBSITE_SECTION_TYPE.CTA,
        sortOrder: 4,
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

  if (content.currentDraftVersionId !== null && content.publishedVersionId !== null) {
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
