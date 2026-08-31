import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = (name: string) => readFileSync(resolve(import.meta.dirname, name), "utf8");
const index = page("index.vue");
const form = page("form.vue");
const sopPanel = page("BountySopPanel.vue");

describe("bounty pages", () => {
  it("keeps deep links and navigation unavailable when the client boundary is closed", () => {
    expect(index).toContain("!featureAvailable");
    expect(index).toContain("commercialServicesEnabled && !serverUnavailable.value");
    expect(form).toContain('commercialServicesEnabled ? "loading" : "unavailable"');
    expect(index).toContain(':disabled="openingForm"');
    expect(index).toContain(':loading="openingForm"');
  });

  it("renders mutually exclusive loading, empty, error, and authentication states", () => {
    expect(index).toContain("activeStatus === 'loading'");
    expect(index).toContain("activeStatus === 'error'");
    expect(index).toContain("activeStatus === 'unauthenticated'");
    expect(index).toContain("publicBounties.length === 0");
    expect(index).toContain("myBounties.length === 0");
    expect(index).toContain(':primary-disabled="loading"');
  });

  it("keeps public cards on safe fields while owner cards render private fields", () => {
    expect(index).toContain("bounty.owner.nickname");
    expect(index).toContain("bounty.pet.coverImage");
    expect(index).toContain("bounty.address");
    expect(index).toContain("bounty.remark");
    expect(index).not.toContain("bounty.ownerId");
    expect(index).not.toContain("bounty.petId");
  });

  it("keeps qualification, intent, and unique confirmation states explicit and non-clickable", () => {
    expect(index).toContain('type BountyView = "public" | "mine" | "intents"');
    expect(index).toContain("getBountyProviderEligibility()");
    expect(index).toContain("!eligibility.value?.eligible");
    expect(index).toContain("暂无接单资格");
    expect(index).toContain(':disabled="intentButtonDisabled(bounty.id)"');
    expect(index).toContain(':loading="applyingBountyId === bounty.id"');
    expect(index).toContain("getBountyIntents(bountyId, { page: 1, pageSize: 50 })");
    expect(index).toContain("await uni.showModal");
    expect(index).toContain("confirmBountyIntent(bounty.id, intent.id)");
    expect(index).toContain(':disabled="Boolean(confirmingIntentId)"');
    expect(index).toContain(':loading="confirmingIntentId === intent.id"');
    expect(index).toContain(":aria-label");
    expect(index).toContain("intent.provider.nickname");
  });

  it("shows private fulfillment details only from a confirmed provider intent projection", () => {
    expect(index).toContain("intent.status === BOUNTY_INTENT_STATUS.CONFIRMED");
    expect(index).toContain("intent.bounty.address");
    expect(index).toContain("intent.bounty.remark");
    expect(index).toContain("BOUNTY_INTENT_STATUS_LABELS[intent.status]");
    expect(index).toContain("BOUNTY_STATUS_LABELS[bounty.status]");
  });

  it("keeps owner SOP read-only and provider execution ordered, qualified, and evidence-gated", () => {
    expect(index).toContain("getBountySop(bountyId)");
    expect(index).toContain("uploadBountySopEvidence(");
    expect(index).toContain("completeBountySopStep(bountyId, stepNumber)");
    expect(index).toContain("uni.chooseImage");
    expect(index).toContain("uni.chooseVideo");
    expect(index).toContain(':read-only="true"');
    expect(index).toContain(':read-only="false"');
    expect(sopPanel).toContain("props.sop?.currentStepNumber === step.stepNumber");
    expect(sopPanel).toContain("step.photos.length >= step.minimumPhotoCount");
    expect(sopPanel).toContain("!step.videoRequired || step.videos.length > 0");
    expect(sopPanel).toContain("!sop.canExecute");
    expect(sopPanel).toContain("BOUNTY_SOP_LIMITS.MAX_PHOTOS_PER_STEP");
    expect(sopPanel).toContain('role="status"');
    expect(sopPanel).toContain(":aria-label");
  });

  it("uses visible labels, native pickers, inline errors, and a duplicate-safe submit", () => {
    expect(form).toContain("照护宠物");
    expect(form).toContain("服务类型");
    expect(form).toContain('mode="date"');
    expect(form).toContain('mode="time"');
    expect(form).toContain('role="alert"');
    expect(form).toContain(':disabled="controlsDisabled"');
    expect(form).toContain(":loading=\"busy === 'save'\"");
    expect(form).toContain("当前输入仍已保留");
    expect(form).toContain("getPublicBounties({ page: 1, pageSize: 1 })");
    expect(form).toContain("BOUNTY_ERROR_CODE.FEATURE_DISABLED");
    expect(form).toContain("featureUnavailable ? undefined : '完善个人资料'");
    expect(form).toContain("onShow(() => void loadPets())");
    expect(index).toContain('role="tab"');
    expect(index).toContain(":aria-selected");
  });
});
