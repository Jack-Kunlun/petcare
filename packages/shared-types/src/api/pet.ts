/** Controlled pet species supported by the first pet-profile release. */
export const PET_SPECIES = {
  /** Cat. */
  CAT: "cat",
  /** Dog. */
  DOG: "dog",
  /** Rabbit. */
  RABBIT: "rabbit",
  /** Hamster. */
  HAMSTER: "hamster",
  /** Bird. */
  BIRD: "bird",
  /** Any supported pet outside the named species. */
  OTHER: "other",
} as const;

/** Pet species accepted by profile APIs. */
export type PetSpecies = (typeof PET_SPECIES)[keyof typeof PET_SPECIES];

/** User-facing labels for controlled pet species. */
export const PET_SPECIES_LABELS: Record<PetSpecies, string> = {
  [PET_SPECIES.CAT]: "猫",
  [PET_SPECIES.DOG]: "狗",
  [PET_SPECIES.RABBIT]: "兔",
  [PET_SPECIES.HAMSTER]: "仓鼠",
  [PET_SPECIES.BIRD]: "鸟",
  [PET_SPECIES.OTHER]: "其他",
};

/** Controlled biological-sex values used by pet profiles. */
export const PET_GENDER = {
  /** Male pet. */
  MALE: "male",
  /** Female pet. */
  FEMALE: "female",
  /** Sex is unknown or has not been confirmed. */
  UNKNOWN: "unknown",
} as const;

/** Pet gender accepted by profile APIs. */
export type PetGender = (typeof PET_GENDER)[keyof typeof PET_GENDER];

/** User-facing labels for controlled pet gender values. */
export const PET_GENDER_LABELS: Record<PetGender, string> = {
  [PET_GENDER.MALE]: "公",
  [PET_GENDER.FEMALE]: "母",
  [PET_GENDER.UNKNOWN]: "未知",
};

/** Shared validation and ownership limits for pet profiles. */
export const PET_PROFILE_LIMITS = {
  /** Maximum pets owned by one account. */
  MAX_PETS_PER_OWNER: 5,
  /** Maximum managed photos bound to one pet. */
  MAX_PHOTOS_PER_PET: 5,
  /** Maximum pet-name length after trimming. */
  NAME_MAX_LENGTH: 10,
  /** Maximum free-text breed length after trimming. */
  BREED_MAX_LENGTH: 50,
  /** Minimum accepted pet weight in kilograms. */
  WEIGHT_MIN_KG: 0.1,
  /** Maximum accepted pet weight in kilograms. */
  WEIGHT_MAX_KG: 200,
  /** Maximum length of each private care text field after trimming. */
  CARE_TEXT_MAX_LENGTH: 200,
} as const;

/** Stable pet-profile errors used by clients for recovery behavior. */
export const PET_ERROR_CODE = {
  /** The pet does not exist or is not owned by the current user. */
  NOT_FOUND: "PET_NOT_FOUND",
  /** The current user already owns the maximum number of pets. */
  LIMIT_REACHED: "PET_LIMIT_REACHED",
  /** The pet cannot be deleted because an order still references it. */
  REFERENCED_BY_ORDER: "PET_REFERENCED_BY_ORDER",
} as const;

/** Anonymous-safe pet projection used by public order responses. */
export interface PublicPetSummary {
  /** Pet display name. */
  name: string;
  /** User-entered breed label. */
  breed: string;
  /** First public pet photo, or null when no photo is available. */
  coverImage: string | null;
}

/** Compact pet record returned only to its authenticated owner. */
export interface MyPetListItem {
  /** Pet identifier used by owner-only routes. */
  id: string;
  /** Pet display name. */
  name: string;
  /** Controlled species category. */
  species: PetSpecies;
  /** User-entered breed label. */
  breed: string;
  /** Controlled biological-sex value. */
  gender: PetGender;
  /** ISO 8601 calendar birth date, or null when unknown. */
  birthDate: string | null;
  /** First owner-visible photo, or null when no photo is available. */
  coverImage: string | null;
}

/** Full private pet profile returned only to its authenticated owner. */
export interface MyPetDetail extends MyPetListItem {
  /** Pet weight in kilograms, or null when unknown. */
  weightKg: number | null;
  /** Whether the pet has been sterilized. */
  sterilized: boolean;
  /** Private behavior and routine notes, or null when omitted. */
  habits: string | null;
  /** Private allergy notes, or null when omitted. */
  allergies: string | null;
  /** Private food restrictions, or null when omitted. */
  tabooFoods: string | null;
  /** Owner-visible managed photo URLs. */
  photoUrls: string[];
  /** ISO 8601 creation time. */
  createdAt: string;
  /** ISO 8601 last-update time. */
  updatedAt: string;
}

/** Complete editable fields for a new pet; ownership comes only from authentication. */
export interface CreatePetRequest {
  /** Trimmed pet name, up to the shared name limit. */
  name: string;
  /** Controlled species category. */
  species: PetSpecies;
  /** Trimmed user-entered breed label. */
  breed: string;
  /** Controlled biological-sex value. */
  gender: PetGender;
  /** ISO 8601 calendar birth date, or null when unknown. */
  birthDate: string | null;
  /** Pet weight in kilograms, or null when unknown. */
  weightKg: number | null;
  /** Whether the pet has been sterilized. */
  sterilized: boolean;
  /** Private behavior and routine notes, or null when omitted. */
  habits: string | null;
  /** Private allergy notes, or null when omitted. */
  allergies: string | null;
  /** Private food restrictions, or null when omitted. */
  tabooFoods: string | null;
}

/** Complete editable fields for replacing an owner-controlled pet profile. */
export type UpdatePetRequest = CreatePetRequest;

/** Non-paginated owner-only list, bounded by the shared per-owner limit. */
export type MyPetListResponse = MyPetListItem[];
