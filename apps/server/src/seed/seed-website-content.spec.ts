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
          ...create,
        } as StoredVersion;

        versions.push(version);

        return version;
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
          ...create,
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
      "privacy",
      "terms",
    ]);
    expect(state.contents).toHaveLength(9);
    expect(state.versions).toHaveLength(18);

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
      expect.objectContaining({ sectionKey: "home_cta", sectionType: "cta", sortOrder: 4 }),
    ]);
    expect(state.sections).toHaveLength(50);
  });
});
