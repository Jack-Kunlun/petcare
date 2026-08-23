import type { PaginatedResponse } from "./response";

/** Website Content units that may be drafted and published independently. */
export const WEBSITE_CONTENT_KEY = {
  /** Shared navigation and footer content. */
  SITE_SHELL: "site_shell",
  /** Public home page content. */
  HOME: "home",
  /** Public service-mode page content. */
  SERVICES: "services",
  /** Public trust and safety page content. */
  TRUST: "trust",
  /** Public companion recruitment page content. */
  COMPANIONS: "companions",
  /** Public brand and team page content. */
  ABOUT: "about",
  /** Public contact page content. */
  CONTACT: "contact",
  /** Public privacy policy page content. */
  PRIVACY: "privacy",
  /** Public terms page content. */
  TERMS: "terms",
} as const;

/** Stable key of an independently published Website Content unit. */
export type WebsiteContentKey = (typeof WEBSITE_CONTENT_KEY)[keyof typeof WEBSITE_CONTENT_KEY];

/** Supported Website Content section renderer types. */
export const WEBSITE_SECTION_TYPE = {
  /** Shared site navigation header. */
  SITE_HEADER: "site_header",
  /** Shared site footer. */
  SITE_FOOTER: "site_footer",
  /** Primary page introduction. */
  HERO: "hero",
  /** Grid of trust evidence. */
  TRUST_GRID: "trust_grid",
  /** Text and image feature presentation. */
  FEATURE_SPLIT: "feature_split",
  /** Page call to action. */
  CTA: "cta",
  /** Structured plain-text policy or narrative content. */
  RICH_TEXT: "rich_text",
  /** Structured contact channels. */
  CONTACT_PANEL: "contact_panel",
  /** Complete managed homepage experience below the introductory sections. */
  HOME_EXPERIENCE: "home_experience",
} as const;

/** Discriminator of a supported Website Content section. */
export type WebsiteSectionType = (typeof WEBSITE_SECTION_TYPE)[keyof typeof WEBSITE_SECTION_TYPE];

/** Lifecycle states of immutable Website Content versions. */
export const WEBSITE_CONTENT_STATUS = {
  /** Saved version that is not publicly visible. */
  DRAFT: "draft",
  /** Version selected for public reads. */
  PUBLISHED: "published",
  /** Historical version replaced by a later draft or publish. */
  SUPERSEDED: "superseded",
} as const;

/** Lifecycle state of an immutable Website Content version. */
export type WebsiteContentStatus =
  (typeof WEBSITE_CONTENT_STATUS)[keyof typeof WEBSITE_CONTENT_STATUS];

/** Lifecycle states of managed website media. */
export const WEBSITE_MEDIA_STATUS = {
  /** Media may be selected and published. */
  ACTIVE: "active",
  /** Media is retained but unavailable for new selections. */
  ARCHIVED: "archived",
} as const;

/** Lifecycle state of a managed website media asset. */
export type WebsiteMediaStatus = (typeof WEBSITE_MEDIA_STATUS)[keyof typeof WEBSITE_MEDIA_STATUS];

/** Stable machine-readable Website Content failures. */
export const WEBSITE_CONTENT_ERROR_CODE = {
  /** Submitted optimistic-lock revision is stale. */
  REVISION_CONFLICT: "WEBSITE_CONTENT_REVISION_CONFLICT",
  /** Content or section data violates a fixed schema or template. */
  INVALID_CONTENT: "WEBSITE_CONTENT_INVALID_CONTENT",
  /** Requested Website Content identity does not exist. */
  CONTENT_NOT_FOUND: "WEBSITE_CONTENT_NOT_FOUND",
  /** Requested immutable content version does not exist. */
  VERSION_NOT_FOUND: "WEBSITE_CONTENT_VERSION_NOT_FOUND",
  /** Media is invalid, unavailable, archived, or still referenced. */
  INVALID_MEDIA: "WEBSITE_CONTENT_INVALID_MEDIA",
  /** Preview capability token is malformed, revoked, or out of scope. */
  PREVIEW_TOKEN_INVALID: "WEBSITE_CONTENT_PREVIEW_TOKEN_INVALID",
  /** Preview capability token has passed its expiry time. */
  PREVIEW_TOKEN_EXPIRED: "WEBSITE_CONTENT_PREVIEW_TOKEN_EXPIRED",
  /** A content lifecycle transaction could not be persisted. */
  PERSISTENCE_FAILED: "WEBSITE_CONTENT_PERSISTENCE_FAILED",
  /** Tencent COS is unavailable for the requested media operation. */
  STORAGE_UNAVAILABLE: "WEBSITE_CONTENT_STORAGE_UNAVAILABLE",
  /** Operator lacks the permission required by the requested command. */
  PERMISSION_DENIED: "WEBSITE_CONTENT_PERMISSION_DENIED",
} as const;

/** Machine-readable Website Content error code. */
export type WebsiteContentErrorCode =
  (typeof WEBSITE_CONTENT_ERROR_CODE)[keyof typeof WEBSITE_CONTENT_ERROR_CODE];

/** Safe destination accepted by managed website actions. */
export type WebsiteLinkDestination =
  `/${string}` | `https://${string}` | `mailto:${string}` | `tel:${string}`;

/** Label and allow-listed destination for a managed website action. */
export interface WebsiteActionLink {
  /** Visible action label. */
  label: string;
  /** Internal or explicitly allow-listed external destination. */
  href: WebsiteLinkDestination;
}

/** Reference to managed media stored in section content. */
export interface WebsiteImageReference {
  /** Managed media identity, or null to use the approved bundled fallback. */
  assetId: string | null;
  /** Context-specific alternative text for the rendered image. */
  altText: string;
}

/** Publicly resolvable media metadata without storage credentials or object keys. */
export interface WebsitePublicMediaAsset {
  /** Managed media identity. */
  id: string;
  /** Public HTTPS media URL resolved by Server. */
  url: string;
  /** Decoded image width in pixels. */
  width: number;
  /** Decoded image height in pixels. */
  height: number;
  /** Validated image MIME type. */
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

/** SEO metadata saved with every complete Website Content snapshot. */
export interface WebsiteSeoContent {
  /** Unique browser and search-result title. */
  title: string;
  /** Search-result and social summary. */
  description: string;
  /** Canonical path owned by the fixed route registry. */
  canonicalPath: `/${string}`;
  /** Optional Open Graph image reference. */
  image: WebsiteImageReference | null;
}

/** Common immutable shape shared by every supported section type. */
export interface WebsiteContentSectionBase<TType extends WebsiteSectionType, TContent, TSettings> {
  /** Stable key within one page template. */
  sectionKey: string;
  /** Renderer and validator discriminator. */
  sectionType: TType;
  /** Future-compatible display order. */
  sortOrder: number;
  /** Whether this preset section is rendered. */
  isEnabled: boolean;
  /** Persisted section schema version. */
  schemaVersion: 1;
  /** Type-specific editable content. */
  content: TContent;
  /** Type-specific bounded presentation settings. */
  settings: TSettings;
}

/** Navigation item rendered in the shared site header. */
export interface WebsiteNavigationItem extends WebsiteActionLink {
  /** Stable key used by the fixed header template. */
  itemKey: string;
}

/** Editable site-header content. */
export interface WebsiteSiteHeaderContent {
  /** Accessible brand name beside the approved logo. */
  brandLabel: string;
  /** Fixed set of primary navigation items. */
  navigation: WebsiteNavigationItem[];
  /** Optional highlighted navigation action. */
  action: WebsiteActionLink | null;
}

/** Bounded site-header presentation settings. */
export interface WebsiteSiteHeaderSettings {
  /** Whether the header remains visible while scrolling. */
  sticky: boolean;
}

/** Shared site-header section. */
export type WebsiteSiteHeaderSection = WebsiteContentSectionBase<
  typeof WEBSITE_SECTION_TYPE.SITE_HEADER,
  WebsiteSiteHeaderContent,
  WebsiteSiteHeaderSettings
>;

/** Link rendered in a fixed footer group. */
export interface WebsiteFooterLink extends WebsiteActionLink {
  /** Stable key within its footer group. */
  itemKey: string;
}

/** Fixed footer link group with editable text and destinations. */
export interface WebsiteFooterGroup {
  /** Stable group key owned by the site-shell template. */
  groupKey: string;
  /** Visible group heading. */
  title: string;
  /** Ordered links in the group. */
  links: WebsiteFooterLink[];
}

/** Editable site-footer content. */
export interface WebsiteSiteFooterContent {
  /** Short brand statement. */
  description: string;
  /** Fixed set of footer link groups. */
  groups: WebsiteFooterGroup[];
  /** Copyright line displayed at the page end. */
  copyright: string;
}

/** Bounded site-footer presentation settings. */
export interface WebsiteSiteFooterSettings {
  /** Whether the approved logo is shown. */
  showLogo: boolean;
}

/** Shared site-footer section. */
export type WebsiteSiteFooterSection = WebsiteContentSectionBase<
  typeof WEBSITE_SECTION_TYPE.SITE_FOOTER,
  WebsiteSiteFooterContent,
  WebsiteSiteFooterSettings
>;

/** Editable hero content. */
export interface WebsiteHeroContent {
  /** Optional short label above the title. */
  eyebrow: string;
  /** Page's primary heading. */
  title: string;
  /** Supporting introduction. */
  description: string;
  /** Main call to action. */
  primaryAction: WebsiteActionLink | null;
  /** Optional secondary call to action. */
  secondaryAction: WebsiteActionLink | null;
  /** Hero image reference and contextual alternative text. */
  image: WebsiteImageReference;
}

/** Bounded hero presentation settings. */
export interface WebsiteHeroSettings {
  /** Text alignment variant. */
  alignment: "left" | "center";
  /** Image placement on wide screens. */
  imagePosition: "left" | "right" | "background";
}

/** Page hero section. */
export type WebsiteHeroSection = WebsiteContentSectionBase<
  typeof WEBSITE_SECTION_TYPE.HERO,
  WebsiteHeroContent,
  WebsiteHeroSettings
>;

/** One claim in a trust-evidence grid. */
export interface WebsiteTrustItem {
  /** Stable item key within the preset grid. */
  itemKey: string;
  /** Evidence heading. */
  title: string;
  /** Evidence explanation. */
  description: string;
  /** Optional approved icon name selected by the editor. */
  icon: "shield" | "certificate" | "clipboard" | "star" | "support";
}

/** Editable trust-grid content. */
export interface WebsiteTrustGridContent {
  /** Section heading. */
  title: string;
  /** Optional section introduction. */
  description: string;
  /** Fixed set of trust claims. */
  items: WebsiteTrustItem[];
}

/** Bounded trust-grid presentation settings. */
export interface WebsiteTrustGridSettings {
  /** Maximum columns on wide screens. */
  columns: 2 | 3 | 4;
}

/** Trust evidence grid section. */
export type WebsiteTrustGridSection = WebsiteContentSectionBase<
  typeof WEBSITE_SECTION_TYPE.TRUST_GRID,
  WebsiteTrustGridContent,
  WebsiteTrustGridSettings
>;

/** Editable split-feature content. */
export interface WebsiteFeatureSplitContent {
  /** Optional short label above the title. */
  eyebrow: string;
  /** Feature heading. */
  title: string;
  /** Feature explanation. */
  description: string;
  /** Optional feature action. */
  action: WebsiteActionLink | null;
  /** Feature image reference and contextual alternative text. */
  image: WebsiteImageReference;
}

/** Bounded split-feature presentation settings. */
export interface WebsiteFeatureSplitSettings {
  /** Image placement on wide screens. */
  imagePosition: "left" | "right";
  /** Approved background treatment. */
  tone: "plain" | "soft" | "accent";
}

/** Split text-and-image feature section. */
export type WebsiteFeatureSplitSection = WebsiteContentSectionBase<
  typeof WEBSITE_SECTION_TYPE.FEATURE_SPLIT,
  WebsiteFeatureSplitContent,
  WebsiteFeatureSplitSettings
>;

/** Editable call-to-action content. */
export interface WebsiteCtaContent {
  /** Call-to-action heading. */
  title: string;
  /** Supporting call-to-action text. */
  description: string;
  /** Main call-to-action link. */
  primaryAction: WebsiteActionLink;
  /** Optional secondary link. */
  secondaryAction: WebsiteActionLink | null;
}

/** Bounded call-to-action presentation settings. */
export interface WebsiteCtaSettings {
  /** Approved visual emphasis. */
  tone: "brand" | "soft";
  /** Text alignment variant. */
  alignment: "left" | "center";
}

/** Call-to-action section. */
export type WebsiteCtaSection = WebsiteContentSectionBase<
  typeof WEBSITE_SECTION_TYPE.CTA,
  WebsiteCtaContent,
  WebsiteCtaSettings
>;

/** Structured plain-text subsection without arbitrary HTML. */
export interface WebsiteRichTextPart {
  /** Stable subsection key. */
  partKey: string;
  /** Subsection heading. */
  heading: string;
  /** Plain-text paragraphs rendered with normal escaping. */
  paragraphs: string[];
}

/** Editable structured rich-text content. */
export interface WebsiteRichTextContent {
  /** Page or section heading. */
  title: string;
  /** Optional policy effective-date label. */
  effectiveDate: string | null;
  /** Fixed ordered plain-text subsections. */
  parts: WebsiteRichTextPart[];
}

/** Bounded rich-text presentation settings. */
export interface WebsiteRichTextSettings {
  /** Readable content width. */
  width: "normal" | "wide";
}

/** Structured plain-text section. */
export type WebsiteRichTextSection = WebsiteContentSectionBase<
  typeof WEBSITE_SECTION_TYPE.RICH_TEXT,
  WebsiteRichTextContent,
  WebsiteRichTextSettings
>;

/** One structured public contact channel. */
export interface WebsiteContactChannel {
  /** Stable channel key in the contact template. */
  channelKey: string;
  /** Visible channel label. */
  label: string;
  /** Visible contact value. */
  value: string;
  /** Safe destination for activating the channel. */
  href: WebsiteLinkDestination;
  /** Optional availability note. */
  availability: string;
}

/** Editable contact-panel content. */
export interface WebsiteContactPanelContent {
  /** Contact panel heading. */
  title: string;
  /** Contact panel introduction. */
  description: string;
  /** Fixed set of public contact channels. */
  channels: WebsiteContactChannel[];
}

/** Bounded contact-panel presentation settings. */
export interface WebsiteContactPanelSettings {
  /** Maximum columns on wide screens. */
  columns: 1 | 2 | 3;
}

/** Structured contact-panel section. */
export type WebsiteContactPanelSection = WebsiteContentSectionBase<
  typeof WEBSITE_SECTION_TYPE.CONTACT_PANEL,
  WebsiteContactPanelContent,
  WebsiteContactPanelSettings
>;

/** Stable text item used by homepage process, evidence, and trust groups. */
export interface WebsiteHomeExperienceTextItem {
  /** Stable item key owned by the homepage template. */
  itemKey: string;
  /** Visible item heading. */
  title: string;
  /** Visible item explanation. */
  description: string;
}

/** Image-backed homepage card used by service and community groups. */
export interface WebsiteHomeExperienceMediaItem extends WebsiteHomeExperienceTextItem {
  /** Short number or category label displayed above the card title. */
  label: string;
  /** Managed card image reference. */
  image: WebsiteImageReference;
}

/** Editable homepage group containing fixed image-backed cards. */
export interface WebsiteHomeExperienceMediaGroup {
  /** Short label above the group heading. */
  eyebrow: string;
  /** Group heading. */
  title: string;
  /** Group introduction. */
  description: string;
  /** Optional group action. */
  action: WebsiteActionLink | null;
  /** Fixed ordered image-backed cards. */
  items: WebsiteHomeExperienceMediaItem[];
}

/** Editable homepage group containing fixed text items. */
export interface WebsiteHomeExperienceTextGroup {
  /** Short label above the group heading. */
  eyebrow: string;
  /** Group heading. */
  title: string;
  /** Group introduction. */
  description: string;
  /** Optional group action. */
  action: WebsiteActionLink | null;
  /** Fixed ordered text items. */
  items: WebsiteHomeExperienceTextItem[];
}

/** One step in the homepage service-record demonstration. */
export interface WebsiteHomeExperienceRecordStep {
  /** Stable step key owned by the homepage template. */
  itemKey: string;
  /** Demonstration timestamp. */
  time: string;
  /** Visible step label. */
  label: string;
  /** Bounded demonstration state. */
  state: "complete" | "current" | "pending";
}

/** Editable homepage service-record demonstration and explanation. */
export interface WebsiteHomeExperienceRecord {
  /** Short label above the section heading. */
  eyebrow: string;
  /** Section heading. */
  title: string;
  /** Section explanation. */
  description: string;
  /** Optional section action. */
  action: WebsiteActionLink | null;
  /** Demonstration card title. */
  demoTitle: string;
  /** Demonstration card status label. */
  statusLabel: string;
  /** Fixed ordered demonstration steps. */
  steps: WebsiteHomeExperienceRecordStep[];
  /** Fixed ordered demonstration images. */
  images: WebsiteImageReference[];
  /** Additional media count shown after the configured images. */
  extraImageCount: number;
  /** Fixed evidence statements beside the demonstration. */
  evidence: WebsiteHomeExperienceTextItem[];
}

/** Editable closing brand-story content. */
export interface WebsiteHomeExperienceBrandStory {
  /** Short label above the brand statement. */
  eyebrow: string;
  /** Brand statement heading. */
  title: string;
  /** Supporting brand statement. */
  description: string;
  /** Managed background image reference. */
  image: WebsiteImageReference;
}

/** Editable content for the complete homepage experience. */
export interface WebsiteHomeExperienceContent {
  /** Daily-care service cards. */
  services: WebsiteHomeExperienceMediaGroup;
  /** Standard service journey. */
  journey: WebsiteHomeExperienceTextGroup;
  /** Service-record product demonstration. */
  record: WebsiteHomeExperienceRecord;
  /** Verifiable trust details. */
  trust: WebsiteHomeExperienceTextGroup;
  /** Pet-life community cards. */
  community: WebsiteHomeExperienceMediaGroup;
  /** Closing brand story. */
  brand: WebsiteHomeExperienceBrandStory;
}

/** Homepage experience has no operator-selectable presentation settings. */
export type WebsiteHomeExperienceSettings = Record<string, never>;

/** Complete managed homepage experience section. */
export type WebsiteHomeExperienceSection = WebsiteContentSectionBase<
  typeof WEBSITE_SECTION_TYPE.HOME_EXPERIENCE,
  WebsiteHomeExperienceContent,
  WebsiteHomeExperienceSettings
>;

/** Exhaustive union of editable preset section snapshots. */
export type WebsiteContentSection =
  | WebsiteSiteHeaderSection
  | WebsiteSiteFooterSection
  | WebsiteHeroSection
  | WebsiteTrustGridSection
  | WebsiteFeatureSplitSection
  | WebsiteCtaSection
  | WebsiteRichTextSection
  | WebsiteContactPanelSection
  | WebsiteHomeExperienceSection;

type ResolveWebsiteImages<T> = T extends WebsiteImageReference
  ? T & { asset: WebsitePublicMediaAsset | null }
  : T extends (infer TItem)[]
    ? ResolveWebsiteImages<TItem>[]
    : T extends object
      ? { [TKey in keyof T]: ResolveWebsiteImages<T[TKey]> }
      : T;

type ResolveWebsiteSection<TSection extends WebsiteContentSection> = TSection extends unknown
  ? Omit<TSection, "content"> & { content: ResolveWebsiteImages<TSection["content"]> }
  : never;

/** Public section snapshot with every image reference resolved to safe metadata. */
export type WebsitePublicContentSection = ResolveWebsiteSection<WebsiteContentSection>;

/** Summary of an operator shown in Admin version views. */
export interface WebsiteContentOperatorSummary {
  /** Operator identity. */
  id: string;
  /** Current operator display name. */
  displayName: string;
}

/** Complete immutable Website Content version shown in Admin. */
export interface WebsiteContentVersion {
  /** Immutable version identity. */
  id: string;
  /** Independently published content identity key. */
  contentKey: WebsiteContentKey;
  /** Monotonic optimistic-lock revision. */
  revision: number;
  /** Monotonic published business version, or null for never-published drafts. */
  businessVersion: number | null;
  /** Immutable version lifecycle state. */
  status: WebsiteContentStatus;
  /** Business explanation supplied when the snapshot was created. */
  changeSummary: string;
  /** SEO metadata frozen into the version. */
  seo: WebsiteSeoContent;
  /** Complete ordered section snapshot. */
  sections: WebsiteContentSection[];
  /** Version copied to create this snapshot, when applicable. */
  sourceVersionId: string | null;
  /** Operator that created the immutable snapshot. */
  createdBy: WebsiteContentOperatorSummary;
  /** ISO 8601 snapshot creation time. */
  createdAt: string;
  /** Operator that published this version, or null before publish. */
  publishedBy: WebsiteContentOperatorSummary | null;
  /** ISO 8601 publish time, or null before publish. */
  publishedAt: string | null;
}

/** Public immutable published snapshot without administrative metadata. */
export interface WebsitePublicContent {
  /** Published Website Content identity key. */
  contentKey: WebsiteContentKey;
  /** Monotonic public business version. */
  businessVersion: number;
  /** ISO 8601 publish time. */
  publishedAt: string;
  /** Public SEO metadata with a resolved optional image. */
  seo: ResolveWebsiteImages<WebsiteSeoContent>;
  /** Ordered enabled sections with resolved media. */
  sections: WebsitePublicContentSection[];
}

/** One independently managed unit in the Admin overview. */
export interface WebsiteContentOverviewItem {
  /** Website Content identity key. */
  contentKey: WebsiteContentKey;
  /** Current saved draft revision. */
  draftRevision: number;
  /** Current public business version, or null before first publish. */
  publishedBusinessVersion: number | null;
  /** Whether the current draft differs from the published snapshot. */
  hasUnpublishedChanges: boolean;
  /** Last editor of the current draft. */
  lastEditedBy: WebsiteContentOperatorSummary;
  /** ISO 8601 last draft save time. */
  lastEditedAt: string;
  /** ISO 8601 latest publish time, or null before first publish. */
  publishedAt: string | null;
}

/** Admin overview of every fixed Website Content unit. */
export type WebsiteContentOverviewResponse = WebsiteContentOverviewItem[];

/** Request body for saving a new immutable draft revision. */
export interface SaveWebsiteContentDraftRequest {
  /** Revision last read by the editor. */
  revision: number;
  /** Business explanation for this save. */
  changeSummary: string;
  /** Complete SEO snapshot. */
  seo: WebsiteSeoContent;
  /** Complete preset section snapshot. */
  sections: WebsiteContentSection[];
}

/** Response after saving or restoring an immutable draft. */
export type WebsiteContentDraftResponse = WebsiteContentVersion;

/** Request body for an explicit page-scoped publish. */
export interface PublishWebsiteContentRequest {
  /** Saved draft revision to publish. */
  revision: number;
  /** Unique key used to replay the same publish safely. */
  idempotencyKey: string;
  /** Business explanation for the public change. */
  changeSummary: string;
}

/** Result of an explicit Website Content publish. */
export interface PublishWebsiteContentResponse {
  /** Published immutable version. */
  published: WebsiteContentVersion;
  /** Fresh editable draft cloned from the published snapshot. */
  draft: WebsiteContentVersion;
}

/** Request body for creating a fixed-revision preview. */
export interface CreateWebsitePreviewRequest {
  /** Saved draft revision to pin into the preview capability. */
  revision: number;
}

/** Short-lived preview URL returned only to an authorized editor. */
export interface CreateWebsitePreviewResponse {
  /** Fragment-token URL that does not send the token in the initial HTTP request. */
  previewUrl: string;
  /** ISO 8601 preview capability expiry time. */
  expiresAt: string;
  /** Revision permanently selected by this preview. */
  revision: number;
}

/** Request body for restoring history into a new draft. */
export interface RestoreWebsiteContentRequest {
  /** Historical immutable version to copy. */
  versionId: string;
  /** Current draft revision used for optimistic locking. */
  revision: number;
  /** Business explanation for creating the restore draft. */
  changeSummary: string;
}

/** Query for paginated Website Content history. */
export interface WebsiteContentHistoryQuery {
  /** One-based page number. */
  page: number;
  /** Maximum versions returned in one page. */
  pageSize: number;
}

/** Paginated immutable Website Content history. */
export type WebsiteContentHistoryResponse = PaginatedResponse<WebsiteContentVersion>;

/** Supported field-level diff change kinds. */
export const WEBSITE_CONTENT_DIFF_CHANGE_TYPE = {
  /** Field or item was added. */
  ADDED: "added",
  /** Existing field changed. */
  MODIFIED: "modified",
  /** Field or item was removed. */
  REMOVED: "removed",
} as const;

/** Field-level diff change kind. */
export type WebsiteContentDiffChangeType =
  (typeof WEBSITE_CONTENT_DIFF_CHANGE_TYPE)[keyof typeof WEBSITE_CONTENT_DIFF_CHANGE_TYPE];

/** JSON-safe value displayed by the Admin diff UI. */
export type WebsiteContentDiffValue =
  | string
  | number
  | boolean
  | null
  | WebsiteContentDiffValue[]
  | { [key: string]: WebsiteContentDiffValue };

/** Stable field-level difference between draft and published snapshots. */
export interface WebsiteContentDiffItem {
  /** Stable dotted path to the changed field. */
  path: string;
  /** Value before the change, absent for additions. */
  before: WebsiteContentDiffValue | undefined;
  /** Value after the change, absent for removals. */
  after: WebsiteContentDiffValue | undefined;
  /** Kind of field-level change. */
  changeType: WebsiteContentDiffChangeType;
}

/** Field differences between the current draft and published version. */
export type WebsiteContentDiffResponse = WebsiteContentDiffItem[];

/** Managed website image metadata shown in Admin. */
export interface WebsiteMediaAsset {
  /** Managed media identity referenced by section snapshots. */
  id: string;
  /** Original client filename retained for operator recognition. */
  originalName: string;
  /** Validated decoded image MIME type. */
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  /** Exact object size in bytes. */
  sizeBytes: number;
  /** Decoded image width in pixels. */
  width: number;
  /** Decoded image height in pixels. */
  height: number;
  /** SHA-256 checksum of the uploaded bytes. */
  checksum: string;
  /** Current media lifecycle state. */
  status: WebsiteMediaStatus;
  /** Safe public media metadata. */
  publicAsset: WebsitePublicMediaAsset;
  /** Operator that registered the media. */
  createdBy: WebsiteContentOperatorSummary;
  /** ISO 8601 registration time. */
  createdAt: string;
  /** Content/version references that prevent archival. */
  references: WebsiteMediaReference[];
}

/** One draft or published snapshot that references a media asset. */
export interface WebsiteMediaReference {
  /** Referencing Website Content key. */
  contentKey: WebsiteContentKey;
  /** Referencing immutable version identity. */
  versionId: string;
  /** Referencing section key. */
  sectionKey: string;
  /** Referencing version lifecycle state. */
  status: WebsiteContentStatus;
}

/** Query for the Admin website media library. */
export interface WebsiteMediaListQuery {
  /** One-based page number. */
  page: number;
  /** Maximum assets returned in one page. */
  pageSize: number;
  /** Optional filename search. */
  keyword?: string;
  /** Optional lifecycle filter. */
  status?: WebsiteMediaStatus;
}

/** Paginated Admin website media library. */
export type WebsiteMediaListResponse = PaginatedResponse<WebsiteMediaAsset>;

/** Result of registering a validated website image. */
export type UploadWebsiteMediaResponse = WebsiteMediaAsset;

/** Result of archiving an unreferenced media asset. */
export type ArchiveWebsiteMediaResponse = WebsiteMediaAsset;
