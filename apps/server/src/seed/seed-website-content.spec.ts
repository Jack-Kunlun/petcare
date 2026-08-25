import { PrismaClient } from "../generated/prisma/client";
import { seedWebsiteContent } from "./seed-website-content";

interface StoredContent extends Record<string, unknown> {
  id: string;
  contentKey: string;
  contentType: string;
  currentDraftVersionId: string | null;
  publishedVersionId: string | null;
}

interface StoredVersion extends Record<string, unknown> {
  id: string;
  websiteContentId: string;
  status: string;
  revision: number;
  businessVersion: number | null;
  sourceVersionId: string | null;
  idempotencyKey: string | null;
}

interface StoredSection extends Record<string, unknown> {
  id: string;
  versionId: string;
  sectionKey: string;
  sortOrder: number;
}

function createFakePrisma() {
  const contents: StoredContent[] = [];
  const versions: StoredVersion[] = [];
  const sections: StoredSection[] = [];

  const prisma = {
    $transaction: jest.fn(async (callback) => callback(prisma)),
    websiteContent: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const existing = contents.find((content) => content.contentKey === where.contentKey);

        if (existing) {
          Object.assign(existing, update);

          return existing;
        }

        const content = {
          id: `content-${contents.length + 1}`,
          currentDraftVersionId: null,
          publishedVersionId: null,
          ...create,
        } as StoredContent;

        contents.push(content);

        return content;
      }),
      update: jest.fn(async ({ where, data }) => {
        const content = contents.find((item) => item.id === where.id);

        if (!content) {
          throw new Error(`Unknown website content: ${where.id}`);
        }

        Object.assign(content, data);

        return content;
      }),
    },
    websiteContentVersion: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const existing = where.idempotencyKey
          ? versions.find((version) => version.idempotencyKey === where.idempotencyKey)
          : versions.find(
              (version) =>
                version.websiteContentId === where.websiteContentId_revision.websiteContentId &&
                version.revision === where.websiteContentId_revision.revision,
            );

        if (existing) {
          Object.assign(existing, update);

          return existing;
        }

        const version = {
          id: `version-${versions.length + 1}`,
          ...structuredClone(create),
        } as StoredVersion;

        versions.push(version);

        return version;
      }),
      findMany: jest.fn(async ({ where }) =>
        versions
          .filter((version) => version.websiteContentId === where.websiteContentId)
          .sort((left, right) => left.revision - right.revision)
          .map((version) => ({
            ...version,
            sections: sections
              .filter((section) => section.versionId === version.id)
              .sort((left, right) => left.sortOrder - right.sortOrder),
          })),
      ),
      updateMany: jest.fn(async ({ where, data }) => {
        const matches = versions.filter(
          (version) =>
            version.websiteContentId === where.websiteContentId && where.id.in.includes(version.id),
        );

        matches.forEach((version) => Object.assign(version, data));

        return { count: matches.length };
      }),
    },
    websiteContentSection: {
      upsert: jest.fn(async ({ where, update, create }) => {
        const key = where.versionId_sectionKey;
        const existing = sections.find(
          (section) => section.versionId === key.versionId && section.sectionKey === key.sectionKey,
        );

        if (existing) {
          Object.assign(existing, update);

          return existing;
        }

        const section = {
          id: `section-${sections.length + 1}`,
          ...structuredClone(create),
        } as StoredSection;

        sections.push(section);

        return section;
      }),
    },
  };

  return {
    prisma: prisma as unknown as PrismaClient,
    contents,
    versions,
    sections,
  };
}

function getOrderedSections(state: ReturnType<typeof createFakePrisma>, versionId: string) {
  return state.sections
    .filter((section) => section.versionId === versionId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((section) => ({
      sectionKey: section.sectionKey,
      sectionType: section.sectionType,
      sortOrder: section.sortOrder,
      isEnabled: section.isEnabled,
      schemaVersion: section.schemaVersion,
      content: section.content,
      settings: section.settings,
    }));
}

function requireContactSeed(state: ReturnType<typeof createFakePrisma>) {
  const content = state.contents.find((candidate) => candidate.contentKey === "contact");

  if (!content?.publishedVersionId || !content.currentDraftVersionId) {
    throw new Error("Contact seed pointers are required for this test");
  }

  return {
    content,
    draftId: content.currentDraftVersionId,
    publishedId: content.publishedVersionId,
  };
}

function restoreLegacyContactSeed(state: ReturnType<typeof createFakePrisma>) {
  const contact = requireContactSeed(state);
  const legacyChannels = [
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
  ];

  for (const versionId of [contact.publishedId, contact.draftId]) {
    const panel = state.sections.find(
      (section) => section.versionId === versionId && section.sectionKey === "contact_channels",
    );

    if (!panel) {
      throw new Error("Legacy contact panel is required for this test");
    }

    const content = panel.content as { channels: typeof legacyChannels };

    content.channels = structuredClone(legacyChannels);
  }

  return contact;
}

function requirePrivacySeed(state: ReturnType<typeof createFakePrisma>) {
  const content = state.contents.find((candidate) => candidate.contentKey === "privacy");

  if (!content?.publishedVersionId || !content.currentDraftVersionId) {
    throw new Error("Privacy seed pointers are required for this test");
  }

  return {
    content,
    draftId: content.currentDraftVersionId,
    publishedId: content.publishedVersionId,
  };
}

function restoreLegacyPrivacySeed(state: ReturnType<typeof createFakePrisma>) {
  const privacy = requirePrivacySeed(state);
  const legacyContent = {
    title: "隐私政策",
    effectiveDate: null,
    parts: [
      {
        partKey: "review_required",
        heading: "内容待审核",
        paragraphs: ["本页正式内容需经业务与法务审核后显式发布。"],
      },
    ],
  };

  for (const versionId of [privacy.publishedId, privacy.draftId]) {
    const section = state.sections.find(
      (candidate) => candidate.versionId === versionId && candidate.sectionKey === "legal_content",
    );

    if (!section) {
      throw new Error("Legacy privacy section is required for this test");
    }

    section.content = structuredClone(legacyContent);
  }

  return privacy;
}

describe("seedWebsiteContent", () => {
  it("initializes each fixed content key with one published snapshot and one current draft clone", async () => {
    const state = createFakePrisma();

    await seedWebsiteContent(state.prisma, "admin-1");
    await seedWebsiteContent(state.prisma, "admin-1");

    expect(state.contents.map((content) => content.contentKey)).toEqual([
      "site_shell",
      "home",
      "services",
      "trust",
      "companions",
      "about",
      "contact",
      "help",
      "privacy",
      "terms",
    ]);
    expect(state.contents).toHaveLength(10);
    expect(state.versions).toHaveLength(20);

    for (const content of state.contents) {
      const publishedVersions = state.versions.filter(
        (version) =>
          version.websiteContentId === content.id &&
          version.status === "published" &&
          version.businessVersion === 1,
      );
      const drafts = state.versions.filter(
        (version) =>
          version.websiteContentId === content.id &&
          version.status === "draft" &&
          version.businessVersion === null,
      );

      expect(publishedVersions).toHaveLength(1);
      expect(drafts).toHaveLength(1);

      const [published] = publishedVersions;
      const [draft] = drafts;

      expect(published).toMatchObject({
        revision: 1,
        idempotencyKey: `seed:${content.contentKey}:published:v1`,
        createdById: "admin-1",
        publishedById: "admin-1",
      });
      expect(draft).toMatchObject({
        revision: 2,
        sourceVersionId: published.id,
        idempotencyKey: null,
        createdById: "admin-1",
      });
      expect(content).toMatchObject({
        currentDraftVersionId: draft.id,
        publishedVersionId: published.id,
      });
      expect(getOrderedSections(state, draft.id)).toEqual(getOrderedSections(state, published.id));
    }

    expect(getOrderedSections(state, "version-1")).toEqual([
      expect.objectContaining({
        sectionKey: "site_header",
        sectionType: "site_header",
        sortOrder: 1,
      }),
      expect.objectContaining({
        sectionKey: "site_footer",
        sectionType: "site_footer",
        sortOrder: 2,
      }),
    ]);
    expect(getOrderedSections(state, "version-3")).toEqual([
      expect.objectContaining({ sectionKey: "hero", sectionType: "hero", sortOrder: 1 }),
      expect.objectContaining({
        sectionKey: "trust_evidence",
        sectionType: "trust_grid",
        sortOrder: 2,
      }),
      expect.objectContaining({
        sectionKey: "service_modes",
        sectionType: "feature_split",
        sortOrder: 3,
      }),
      expect.objectContaining({
        sectionKey: "home_experience",
        sectionType: "home_experience",
        sortOrder: 4,
      }),
      expect.objectContaining({ sectionKey: "home_cta", sectionType: "cta", sortOrder: 5 }),
    ]);

    const help = state.contents.find((content) => content.contentKey === "help");
    const helpDraft = state.versions.find((version) => version.id === help?.currentDraftVersionId);

    expect(helpDraft).toBeDefined();
    expect(getOrderedSections(state, helpDraft!.id).map((section) => section.sectionKey)).toEqual([
      "account_and_identity",
      "bounty_and_orders",
      "care_records",
      "fees_and_benefits",
    ]);
    expect(state.sections).toHaveLength(60);
  });

  it("seeds safe configurable contact defaults without replacing operator-owned contact content", async () => {
    const state = createFakePrisma();

    await seedWebsiteContent(state.prisma, "admin-1");

    const contact = state.contents.find((content) => content.contentKey === "contact");
    const contactDraft = state.versions.find(
      (version) => version.id === contact?.currentDraftVersionId,
    );
    const contactPublished = state.versions.find(
      (version) => version.id === contact?.publishedVersionId,
    );

    if (!contact || !contactDraft || !contactPublished) {
      throw new Error("Contact seed content is required for this test");
    }

    const expectedChannels = [
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
    ];

    expect(
      getOrderedSections(state, contactDraft.id).find(
        (section) => section.sectionKey === "contact_channels",
      )?.content,
    ).toMatchObject({ channels: expectedChannels });

    const publishedPanel = state.sections.find(
      (section) =>
        section.versionId === contactPublished.id && section.sectionKey === "contact_channels",
    );

    if (!publishedPanel) {
      throw new Error("Published contact panel is required for this test");
    }

    publishedPanel.content = { operatorOwned: true };
    contact.currentDraftVersionId = "operator-draft";
    contact.publishedVersionId = "operator-published";

    await seedWebsiteContent(state.prisma, "admin-1");

    expect(contact).toMatchObject({
      currentDraftVersionId: "operator-draft",
      publishedVersionId: "operator-published",
    });
    expect(publishedPanel.content).toEqual({ operatorOwned: true });
    expect(state.contents).toHaveLength(10);
    expect(state.versions).toHaveLength(20);
    expect(state.sections).toHaveLength(60);
  });

  it("seeds usable help and privacy content instead of a review placeholder", async () => {
    const state = createFakePrisma();

    await seedWebsiteContent(state.prisma, "admin-1");

    const help = state.contents.find((content) => content.contentKey === "help");
    const privacy = requirePrivacySeed(state);
    const privacyContent = getOrderedSections(state, privacy.publishedId)[0]?.content as {
      effectiveDate: string | null;
      parts: Array<{ partKey: string }>;
    };

    expect(help?.publishedVersionId).not.toBeNull();
    expect(privacyContent.effectiveDate).toBe("2026-08-25");
    expect(privacyContent.parts.map((part) => part.partKey)).toEqual([
      "scope",
      "information_collected",
      "information_use",
      "service_providers",
      "retention_and_security",
      "your_rights",
      "minors",
      "updates_and_contact",
    ]);
  });

  it("upgrades only the untouched legacy privacy placeholder with immutable versions", async () => {
    const state = createFakePrisma();

    await seedWebsiteContent(state.prisma, "admin-1");
    const legacy = restoreLegacyPrivacySeed(state);

    await seedWebsiteContent(state.prisma, "admin-2");

    const published = state.versions.find(
      (version) => version.id === legacy.content.publishedVersionId,
    );
    const draft = state.versions.find(
      (version) => version.id === legacy.content.currentDraftVersionId,
    );
    const publishedContent = getOrderedSections(state, published!.id)[0]?.content as {
      parts: Array<{ partKey: string }>;
    };

    expect(legacy.content.publishedVersionId).not.toBe(legacy.publishedId);
    expect(legacy.content.currentDraftVersionId).not.toBe(legacy.draftId);
    expect(state.versions.find((version) => version.id === legacy.publishedId)?.status).toBe(
      "superseded",
    );
    expect(state.versions.find((version) => version.id === legacy.draftId)?.status).toBe(
      "superseded",
    );
    expect(published).toMatchObject({
      status: "published",
      revision: 3,
      businessVersion: 2,
      sourceVersionId: legacy.draftId,
      createdById: "admin-2",
      publishedById: "admin-2",
    });
    expect(draft).toMatchObject({
      status: "draft",
      revision: 4,
      businessVersion: null,
      sourceVersionId: published?.id,
      createdById: "admin-2",
    });
    expect(publishedContent.parts[0]?.partKey).toBe("scope");

    await seedWebsiteContent(state.prisma, "admin-2");

    expect(state.versions).toHaveLength(22);
    expect(state.sections).toHaveLength(62);
  });

  it("does not replace operator-edited legacy privacy content", async () => {
    const state = createFakePrisma();

    await seedWebsiteContent(state.prisma, "admin-1");
    const legacy = restoreLegacyPrivacySeed(state);
    const draft = state.sections.find(
      (section) => section.versionId === legacy.draftId && section.sectionKey === "legal_content",
    )!;

    (draft.content as { title: string }).title = "运营已编辑";
    await seedWebsiteContent(state.prisma, "admin-2");

    expect(legacy.content).toMatchObject({
      currentDraftVersionId: legacy.draftId,
      publishedVersionId: legacy.publishedId,
    });
    expect(state.versions).toHaveLength(20);
    expect(state.sections).toHaveLength(60);
  });

  it("upgrades only the untouched legacy contact seed with immutable safe versions", async () => {
    const state = createFakePrisma();

    await seedWebsiteContent(state.prisma, "admin-1");
    const legacy = restoreLegacyContactSeed(state);

    await seedWebsiteContent(state.prisma, "admin-2");

    const published = state.versions.find(
      (version) => version.id === legacy.content.publishedVersionId,
    );
    const draft = state.versions.find(
      (version) => version.id === legacy.content.currentDraftVersionId,
    );

    expect(legacy.content.publishedVersionId).not.toBe(legacy.publishedId);
    expect(legacy.content.currentDraftVersionId).not.toBe(legacy.draftId);
    expect(state.versions.find((version) => version.id === legacy.publishedId)?.status).toBe(
      "superseded",
    );
    expect(state.versions.find((version) => version.id === legacy.draftId)?.status).toBe(
      "superseded",
    );
    expect(published).toMatchObject({
      status: "published",
      revision: 3,
      businessVersion: 2,
      sourceVersionId: legacy.draftId,
      idempotencyKey: null,
      createdById: "admin-2",
      publishedById: "admin-2",
    });
    expect(draft).toMatchObject({
      status: "draft",
      revision: 4,
      businessVersion: null,
      sourceVersionId: published?.id,
      idempotencyKey: null,
      createdById: "admin-2",
    });
    expect(getOrderedSections(state, draft!.id)).toEqual(getOrderedSections(state, published!.id));
    expect(
      getOrderedSections(state, published!.id).find(
        (section) => section.sectionKey === "contact_channels",
      )?.content,
    ).toMatchObject({
      channels: [
        expect.objectContaining({ channelKey: "customer_service", isEnabled: false }),
        expect.objectContaining({ channelKey: "business", isEnabled: false }),
      ],
    });
    expect(state.versions).toHaveLength(22);
    expect(state.sections).toHaveLength(66);

    await seedWebsiteContent(state.prisma, "admin-2");

    expect(state.versions).toHaveLength(22);
    expect(state.sections).toHaveLength(66);
  });

  it("never reuses a legacy safe-version key owned by another content", async () => {
    const state = createFakePrisma();

    await seedWebsiteContent(state.prisma, "admin-1");
    const legacy = restoreLegacyContactSeed(state);
    const foreignContent = state.contents.find((content) => content.contentKey === "home")!;
    const foreignVersion = {
      id: "foreign-safe-version",
      websiteContentId: foreignContent.id,
      status: "published",
      revision: 99,
      businessVersion: 99,
      sourceVersionId: null,
      idempotencyKey: "seed:contact:published:safe-v2",
    } satisfies StoredVersion;
    const foreignSection = {
      id: "foreign-safe-section",
      versionId: foreignVersion.id,
      sectionKey: "operator-owned",
      sectionType: "rich_text",
      sortOrder: 0,
      isEnabled: true,
      schemaVersion: 1,
      content: { title: "运营内容" },
      settings: {},
    } satisfies StoredSection;
    const foreignPointers = {
      currentDraftVersionId: foreignContent.currentDraftVersionId,
      publishedVersionId: foreignContent.publishedVersionId,
    };

    state.versions.push(foreignVersion);
    state.sections.push(foreignSection);

    await seedWebsiteContent(state.prisma, "admin-2");

    expect(legacy.content.publishedVersionId).not.toBe(foreignVersion.id);
    expect(
      state.versions.find((version) => version.id === legacy.content.publishedVersionId),
    ).toMatchObject({
      websiteContentId: legacy.content.id,
      status: "published",
      revision: 3,
      businessVersion: 2,
      sourceVersionId: legacy.draftId,
    });
    expect(state.sections.filter((section) => section.versionId === foreignVersion.id)).toEqual([
      foreignSection,
    ]);
    expect(foreignContent).toMatchObject(foreignPointers);
  });

  it.each([
    "draft content",
    "published content",
    "version metadata",
    "content metadata",
    "content pointer",
  ])("does not migrate operator-modified legacy contact %s", async (modification) => {
    const state = createFakePrisma();

    await seedWebsiteContent(state.prisma, "admin-1");
    const legacy = restoreLegacyContactSeed(state);

    if (modification === "content pointer") {
      legacy.content.currentDraftVersionId = "operator-draft";
    } else if (modification === "content metadata") {
      legacy.content.contentType = "operator-owned";
    } else if (modification === "version metadata") {
      const draft = state.versions.find((version) => version.id === legacy.draftId)!;

      draft.changeSummary = "运营已编辑";
    } else {
      const versionId = modification === "draft content" ? legacy.draftId : legacy.publishedId;
      const hero = state.sections.find(
        (section) => section.versionId === versionId && section.sectionKey === "hero",
      )!;

      (hero.content as { title: string }).title = "运营已编辑";
    }

    await seedWebsiteContent(state.prisma, "admin-2");

    expect(legacy.content).toMatchObject({
      currentDraftVersionId: modification === "content pointer" ? "operator-draft" : legacy.draftId,
      publishedVersionId: legacy.publishedId,
    });
    expect(state.versions).toHaveLength(20);
    expect(state.sections).toHaveLength(60);
  });

  it("does not replace an existing operator-owned website pointer", async () => {
    const state = createFakePrisma();

    await seedWebsiteContent(state.prisma, "admin-1");
    Object.assign(state.contents[0], {
      currentDraftVersionId: null,
      publishedVersionId: "operator-published",
    });
    await seedWebsiteContent(state.prisma, "admin-1");

    expect(state.contents[0]).toMatchObject({
      currentDraftVersionId: null,
      publishedVersionId: "operator-published",
    });
  });
});
