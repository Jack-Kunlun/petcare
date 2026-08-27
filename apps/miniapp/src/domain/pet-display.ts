import { PET_GENDER_LABELS, PET_SPECIES } from "@petcare/shared-types";
import type { MyPetListItem } from "@petcare/shared-types";

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

/** Reports whether a value is an existing ISO calendar date. */
export function isValidPetBirthDate(value: string): boolean {
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

/** Formats an owner-visible age from a calendar birthday without persisting a derived value. */
export function formatPetAge(birthDate: string | null, now = new Date()): string {
  if (!birthDate || !isValidPetBirthDate(birthDate)) {
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
  if (!value || !isValidPetBirthDate(value)) {
    return "未填写";
  }

  const [year, month, day] = value.split("-").map(Number);

  return `${year}年${month}月${day}日`;
}
