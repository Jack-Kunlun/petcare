import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = (name: string) => readFileSync(resolve(import.meta.dirname, name), "utf8");
const index = page("index.vue");
const form = page("form.vue");

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
