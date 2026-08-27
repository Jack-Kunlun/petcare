import { PET_GENDER, PET_SPECIES } from "@petcare/shared-types";
import { describe, expect, it } from "vitest";
import {
  formatPetAge,
  formatPetBirthDate,
  formatPetSummary,
  petCoverImage,
} from "../../domain/pet-display";
import {
  createEmptyPetForm,
  createPetForm,
  serializePetForm,
  validatePetForm,
} from "./pet-profile";

const detail = {
  id: "pet-1",
  name: "咪咪",
  species: PET_SPECIES.CAT,
  breed: "英国短毛猫",
  gender: PET_GENDER.FEMALE,
  birthDate: "2023-05-12",
  weightKg: 4.6,
  sterilized: true,
  habits: "怕生",
  allergies: null,
  tabooFoods: "葡萄",
  coverImage: null,
  photoUrls: [],
  photoAssets: [],
  createdAt: "2026-08-27T00:00:00.000Z",
  updatedAt: "2026-08-27T00:00:00.000Z",
};

describe("pet profile form", () => {
  it("maps server detail to editable controls and a normalized request", () => {
    const form = createPetForm(detail);

    expect(form.weightKg).toBe("4.6");
    expect(validatePetForm({ ...form, name: "  咪咪  ", habits: "  怕生  " })).toEqual({
      ok: true,
      request: {
        name: "咪咪",
        species: PET_SPECIES.CAT,
        breed: "英国短毛猫",
        gender: PET_GENDER.FEMALE,
        birthDate: "2023-05-12",
        weightKg: 4.6,
        sterilized: true,
        habits: "怕生",
        allergies: null,
        tabooFoods: "葡萄",
      },
    });
  });

  it("rejects missing controlled values, invalid dates, and unsupported weights", () => {
    const empty = createEmptyPetForm();

    expect(validatePetForm(empty)).toMatchObject({ ok: false, message: expect.any(String) });
    expect(validatePetForm({ ...createPetForm(detail), species: "" })).toMatchObject({
      ok: false,
      message: "请选择宠物种类",
    });
    expect(validatePetForm({ ...createPetForm(detail), birthDate: "2026-02-31" })).toMatchObject({
      ok: false,
      message: "请选择有效的宠物生日",
    });
    expect(validatePetForm({ ...createPetForm(detail), weightKg: "4.567" })).toMatchObject({
      ok: false,
      message: expect.stringContaining("最多两位小数"),
    });
    expect(validatePetForm({ ...createPetForm(detail), weightKg: "201" })).toMatchObject({
      ok: false,
      message: expect.stringContaining("200"),
    });
  });

  it("keeps blank optional values null and snapshots dirty state deterministically", () => {
    const form = { ...createPetForm(detail), birthDate: "", weightKg: "", tabooFoods: "  " };
    const result = validatePetForm(form);

    expect(result).toMatchObject({
      ok: true,
      request: { birthDate: null, weightKg: null, tabooFoods: null },
    });
    expect(serializePetForm(form)).toBe(serializePetForm({ ...form }));
    expect(serializePetForm({ ...form, name: "旺财" })).not.toBe(serializePetForm(form));
  });
});

describe("pet owner display helpers", () => {
  const now = new Date(2026, 7, 27);

  it("derives year, month, newborn, and unknown labels from birth dates", () => {
    expect(formatPetAge("2023-05-12", now)).toBe("3岁");
    expect(formatPetAge("2026-02-28", now)).toBe("5个月");
    expect(formatPetAge("2026-08-20", now)).toBe("未满1个月");
    expect(formatPetAge(null, now)).toBe("年龄未知");
    expect(formatPetAge("2027-01-01", now)).toBe("年龄未知");
  });

  it("formats controlled labels and uses only real or species fallback covers", () => {
    expect(formatPetSummary(detail, now)).toBe("母 · 3岁");
    expect(formatPetBirthDate(detail.birthDate)).toBe("2023年5月12日");
    expect(petCoverImage(detail)).toBe("/static/main/profile-cat.png");
    expect(petCoverImage({ species: PET_SPECIES.DOG, coverImage: null })).toBe(
      "/static/main/profile-dog.png",
    );
    expect(petCoverImage({ ...detail, coverImage: "https://cdn.example/pet.png" })).toBe(
      "https://cdn.example/pet.png",
    );
  });
});
