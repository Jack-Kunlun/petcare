import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const list = readFileSync(resolve(import.meta.dirname, "index.vue"), "utf8");
const detail = readFileSync(resolve(import.meta.dirname, "detail.vue"), "utf8");
const form = readFileSync(resolve(import.meta.dirname, "form.vue"), "utf8");
const profile = readFileSync(resolve(import.meta.dirname, "../../pages/profile/index.vue"), "utf8");

describe("real Miniapp pet pages", () => {
  it("renders a retryable owner list with empty and unavailable states", () => {
    expect(list).toContain("getMyPets");
    expect(list).toContain("v-if=\"status === 'loading'\"");
    expect(list).toContain("v-else-if=\"status === 'unavailable'\"");
    expect(list).toContain("v-else-if=\"status === 'error'\"");
    expect(list).toContain("pets.length === 0");
    expect(list).toContain('@primary="loadPets"');
    expect(list).toContain('status="empty"');
    expect(list).not.toContain("deletePet");
    expect(list).not.toContain("removePet");
    expect(list).not.toContain("petFixtures");
  });

  it("loads only the routed owner detail and keeps deletion behavior disabled while pending", () => {
    expect(detail).toContain("getMyPet(petId.value)");
    expect(detail).toContain("deletePet(value.id)");
    expect(detail).toContain("PET_SPECIES_LABELS[value.species]");
    expect(detail).toContain("pet.photoUrls");
    expect(detail).toContain('@primary="loadPet"');
    expect(detail).toContain(':disabled="deleting"');
    expect(detail).toContain(':loading="deleting"');
    expect(detail).toContain('variant="danger"');
    expect(detail).not.toContain("疫苗已完成");
    expect(detail).not.toContain("getPetById");
  });

  it("persists profile fields before retryable managed-photo uploads", () => {
    expect(form).toContain("createPet(validation.request)");
    expect(form).toContain("updatePet(petId.value, validation.request)");
    expect(form).toContain("uploadPetPhoto(targetPetId");
    expect(form).toContain("deletePetPhoto(detail.id, asset.id)");
    expect(form).toContain("draftPhotos.length > 0 || photoError");
    expect(form).toContain('formMode.value = "edit"');
    expect(form).toMatch(/档案已保存，\$\{failedUploads\} 张图片上传失败/u);
    expect(form).toContain(':disabled="saveDisabled"');
    expect(form).toContain(":loading=\"busy === 'save'\"");
    expect(form).toContain("PcStatePanel");
    expect(form).not.toContain("静态预览不支持上传");
    expect(form).not.toContain("getPetById");
  });

  it("keeps the pet form concise and marks required fields visibly", () => {
    expect(form.match(/class="text-danger" aria-hidden="true">\*/gu)).toHaveLength(4);
    expect(form).not.toContain("clearBirthDate");
    expect(form).not.toContain(">\n                  清除\n");
    expect(form).toContain("备注");
    expect(form).not.toContain("过敏信息");
    expect(form).not.toContain("忌口信息");
  });

  it("replaces profile fixtures with owner API cards", () => {
    expect(profile).toContain("getMyPets");
    expect(profile).toContain('from "@/domain/pet-display"');
    expect(profile).not.toContain('from "@/pages-account/');
    expect(profile).toContain('v-for="pet in featuredPets"');
    expect(profile).toContain("petCoverImage(pet)");
    expect(profile).not.toContain("petStatValue");
    expect(profile).not.toContain('{ value: "2只", label: "我的宠物"');
    expect(profile).not.toContain("detail?id=mimi");
    expect(profile).not.toContain("detail?id=wangcai");
  });

  it("drops owner data responses that finish after the active account changes", () => {
    for (const source of [list, detail, form, profile]) {
      expect(source).toContain("captureSessionUserRevision");
      expect(source).toContain("isSessionUserRevisionCurrent");
    }
  });
});
