import { describe, expect, expectTypeOf, it } from "vitest";
import {
  PET_ERROR_CODE,
  PET_GENDER,
  PET_GENDER_LABELS,
  PET_PROFILE_LIMITS,
  PET_SPECIES,
  PET_SPECIES_LABELS,
  type CreatePetRequest,
  type MyPetDetail,
  type MyPetListResponse,
  type PublicPetSummary,
  type UpdatePetRequest,
} from "./pet";

describe("pet contracts", () => {
  it("keeps controlled values and first-release limits explicit", () => {
    expect(PET_SPECIES_LABELS).toEqual({
      cat: "猫",
      dog: "狗",
      rabbit: "兔",
      hamster: "仓鼠",
      bird: "鸟",
      other: "其他",
    });
    expect(PET_GENDER_LABELS).toEqual({ male: "公", female: "母", unknown: "未知" });
    expect(Object.values(PET_SPECIES)).toEqual([
      "cat",
      "dog",
      "rabbit",
      "hamster",
      "bird",
      "other",
    ]);
    expect(Object.values(PET_GENDER)).toEqual(["male", "female", "unknown"]);
    expect(PET_PROFILE_LIMITS).toMatchObject({
      MAX_PETS_PER_OWNER: 5,
      MAX_PHOTOS_PER_PET: 5,
      NAME_MAX_LENGTH: 10,
    });
    expect(PET_ERROR_CODE).toEqual({
      NOT_FOUND: "PET_NOT_FOUND",
      LIMIT_REACHED: "PET_LIMIT_REACHED",
      REFERENCED_BY_ORDER: "PET_REFERENCED_BY_ORDER",
    });
  });

  it("separates anonymous-safe summaries from owner-only care data", () => {
    const publicSummary: PublicPetSummary = {
      name: "旺财",
      breed: "金毛",
      coverImage: null,
    };
    const detail: MyPetDetail = {
      id: "pet-1",
      name: publicSummary.name,
      species: PET_SPECIES.DOG,
      breed: publicSummary.breed,
      gender: PET_GENDER.MALE,
      birthDate: "2023-05-12",
      weightKg: 32.5,
      sterilized: true,
      habits: "怕生",
      allergies: "鸡肉",
      tabooFoods: "葡萄",
      photoUrls: [],
      coverImage: publicSummary.coverImage,
      createdAt: "2026-08-26T00:00:00.000Z",
      updatedAt: "2026-08-26T00:00:00.000Z",
    };
    const list: MyPetListResponse = [detail];

    expect(Object.keys(publicSummary).sort()).toEqual(["breed", "coverImage", "name"]);
    expect(list).toHaveLength(1);
    expect(detail).toMatchObject({ allergies: "鸡肉", tabooFoods: "葡萄" });
    expectTypeOf<UpdatePetRequest>().toEqualTypeOf<CreatePetRequest>();
  });
});
