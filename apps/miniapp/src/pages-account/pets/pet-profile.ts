import {
  PET_GENDER,
  PET_GENDER_LABELS,
  PET_PROFILE_LIMITS,
  PET_SPECIES,
  PET_SPECIES_LABELS,
} from "@petcare/shared-types";
import type {
  CreatePetRequest,
  MyPetDetail,
  MyPetListItem,
  PetGender,
  PetSpecies,
} from "@petcare/shared-types";

/** Editable string-backed fields used by native Miniapp controls. */
export interface PetProfileForm {
  name: string;
  species: PetSpecies | "";
  breed: string;
  gender: PetGender | "";
  birthDate: string;
  weightKg: string;
  sterilized: boolean;
  habits: string;
  allergies: string;
  tabooFoods: string;
}

export type PetFormValidation =
  { ok: true; request: CreatePetRequest } | { ok: false; message: string };

export const PET_SPECIES_OPTIONS = Object.values(PET_SPECIES).map((value) => ({
  value,
  label: PET_SPECIES_LABELS[value],
}));

export const PET_GENDER_OPTIONS = Object.values(PET_GENDER).map((value) => ({
  value,
  label: PET_GENDER_LABELS[value],
}));

/** Creates a blank form without inventing a species or gender selection. */
export function createEmptyPetForm(): PetProfileForm {
  return {
    name: "",
    species: "",
    breed: "",
    gender: "",
    birthDate: "",
    weightKg: "",
    sterilized: false,
    habits: "",
    allergies: "",
    tabooFoods: "",
  };
}

/** Creates a writable form from the server-authoritative owner detail. */
export function createPetForm(detail: MyPetDetail): PetProfileForm {
  return {
    name: detail.name,
    species: detail.species,
    breed: detail.breed,
    gender: detail.gender,
    birthDate: detail.birthDate ?? "",
    weightKg: detail.weightKg?.toString() ?? "",
    sterilized: detail.sterilized,
    habits: detail.habits ?? "",
    allergies: detail.allergies ?? "",
    tabooFoods: detail.tabooFoods ?? "",
  };
}

/** Builds an API request only when every shared contract boundary is satisfied. */
export function validatePetForm(form: PetProfileForm): PetFormValidation {
  const name = form.name.trim();
  const breed = form.breed.trim();

  if (!validText(name, PET_PROFILE_LIMITS.NAME_MAX_LENGTH)) {
    return { ok: false, message: `宠物名字应为 1 至 ${PET_PROFILE_LIMITS.NAME_MAX_LENGTH} 个字符` };
  }

  if (!form.species || !Object.values(PET_SPECIES).includes(form.species)) {
    return { ok: false, message: "请选择宠物种类" };
  }

  if (!validText(breed, PET_PROFILE_LIMITS.BREED_MAX_LENGTH)) {
    return {
      ok: false,
      message: `宠物品种应为 1 至 ${PET_PROFILE_LIMITS.BREED_MAX_LENGTH} 个字符`,
    };
  }

  if (!form.gender || !Object.values(PET_GENDER).includes(form.gender)) {
    return { ok: false, message: "请选择宠物性别" };
  }

  if (form.birthDate && !isCalendarDate(form.birthDate)) {
    return { ok: false, message: "请选择有效的宠物生日" };
  }

  const weight = parseWeight(form.weightKg);

  if (weight === undefined) {
    return {
      ok: false,
      message: `体重应为 ${PET_PROFILE_LIMITS.WEIGHT_MIN_KG} 至 ${PET_PROFILE_LIMITS.WEIGHT_MAX_KG} kg，最多两位小数`,
    };
  }

  for (const [value, label] of [
    [form.habits, "生活习惯"],
    [form.allergies, "过敏信息"],
    [form.tabooFoods, "忌口信息"],
  ] as const) {
    const normalized = value.trim();

    if (!validOptionalText(normalized, PET_PROFILE_LIMITS.CARE_TEXT_MAX_LENGTH)) {
      return {
        ok: false,
        message: `${label}不能超过 ${PET_PROFILE_LIMITS.CARE_TEXT_MAX_LENGTH} 个字符`,
      };
    }
  }

  return {
    ok: true,
    request: {
      name,
      species: form.species,
      breed,
      gender: form.gender,
      birthDate: form.birthDate || null,
      weightKg: weight,
      sterilized: form.sterilized,
      habits: nullableTrim(form.habits),
      allergies: nullableTrim(form.allergies),
      tabooFoods: nullableTrim(form.tabooFoods),
    },
  };
}

/** Uses a stable serialized snapshot for save-button dirty state. */
export function serializePetForm(form: PetProfileForm): string {
  return JSON.stringify(form);
}

/** Returns a species-appropriate local image when the pet has no managed cover. */
export function petCoverImage(pet: Pick<MyPetListItem, "coverImage" | "species">): string {
  if (pet.coverImage) {
    return pet.coverImage;
  }

  if (pet.species === PET_SPECIES.CAT) {
    return "/static/main/profile-cat.png";
  }

  if (pet.species === PET_SPECIES.DOG) {
    return "/static/main/profile-dog.png";
  }

  return "/static/main/petcare-placeholder-light.svg";
}

/** Formats an owner-visible age from a calendar birthday without persisting a derived value. */
export function formatPetAge(birthDate: string | null, now = new Date()): string {
  if (!birthDate || !isCalendarDate(birthDate)) {
    return "年龄未知";
  }

  const [year, month, day] = birthDate.split("-").map(Number);
  let months = now.getFullYear() * 12 + now.getMonth() - (year * 12 + (month - 1));

  if (now.getDate() < day) {
    months -= 1;
  }

  if (months < 0) {
    return "年龄未知";
  }

  if (months < 1) {
    return "未满1个月";
  }

  if (months < 12) {
    return `${months}个月`;
  }

  return `${Math.floor(months / 12)}岁`;
}

/** Combines controlled gender and derived age labels for compact cards. */
export function formatPetSummary(
  pet: Pick<MyPetListItem, "gender" | "birthDate">,
  now = new Date(),
): string {
  return `${PET_GENDER_LABELS[pet.gender]} · ${formatPetAge(pet.birthDate, now)}`;
}

/** Formats a valid ISO calendar date for the Chinese detail view. */
export function formatPetBirthDate(value: string | null): string {
  if (!value || !isCalendarDate(value)) {
    return "未填写";
  }

  const [year, month, day] = value.split("-").map(Number);

  return `${year}年${month}月${day}日`;
}

function validText(value: string, maxLength: number): boolean {
  return value.length > 0 && value.length <= maxLength && !/\p{Cc}/u.test(value);
}

function validOptionalText(value: string, maxLength: number): boolean {
  return value.length <= maxLength && !/\p{Cc}/u.test(value);
}

function nullableTrim(value: string): string | null {
  return value.trim() || null;
}

function parseWeight(value: string): number | null | undefined {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (!/^(?:\d+|\d*\.\d{1,2})$/u.test(normalized)) {
    return undefined;
  }

  const weight = Number(normalized);

  return Number.isFinite(weight) &&
    weight >= PET_PROFILE_LIMITS.WEIGHT_MIN_KG &&
    weight <= PET_PROFILE_LIMITS.WEIGHT_MAX_KG
    ? weight
    : undefined;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
