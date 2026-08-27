import { Injectable } from "@nestjs/common";
import {
  PET_GENDER,
  PET_PROFILE_LIMITS,
  PET_SPECIES,
  type CreatePetRequest,
  type MyPetDetail,
  type MyPetListItem,
  type UpdatePetRequest,
} from "@petcare/shared-types";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { lockUserRow } from "../../prisma/user-row-lock";
import {
  petAccountDisabled,
  petLimitReached,
  petNotFound,
  petReferencedByOrder,
  petValidationFailed,
} from "./pet.errors";

const petListSelect = {
  id: true,
  name: true,
  species: true,
  breed: true,
  gender: true,
  birthDate: true,
  photos: true,
} as const;

const petDetailSelect = {
  ...petListSelect,
  weight: true,
  sterilized: true,
  habits: true,
  allergies: true,
  tabooFoods: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PetListRow = Prisma.PetGetPayload<{ select: typeof petListSelect }>;
type PetDetailRow = Prisma.PetGetPayload<{ select: typeof petDetailSelect }>;

/** Owns authenticated pet-profile reads and mutations. */
@Injectable()
export class PetService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists only pets owned by the authenticated account. */
  async findMine(ownerId: string): Promise<MyPetListItem[]> {
    const pets = await this.prisma.pet.findMany({
      where: { ownerId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: petListSelect,
    });

    return pets.map((pet) => this.toListItem(pet));
  }

  /** Returns one owner-only pet profile without revealing cross-owner existence. */
  async findMineById(ownerId: string, id: string): Promise<MyPetDetail> {
    const pet = await this.prisma.pet.findFirst({
      where: { id, ownerId },
      select: petDetailSelect,
    });

    if (!pet) {
      throw petNotFound();
    }

    return this.toDetail(pet);
  }

  /** Creates one pet while serializing the per-owner profile limit. */
  async create(ownerId: string, input: CreatePetRequest): Promise<MyPetDetail> {
    const data = this.normalizeInput(input);

    return this.prisma.$transaction(async (transaction) => {
      await this.assertActiveOwner(transaction, ownerId);
      const count = await transaction.pet.count({ where: { ownerId } });

      if (count >= PET_PROFILE_LIMITS.MAX_PETS_PER_OWNER) {
        throw petLimitReached();
      }

      const pet = await transaction.pet.create({
        data: {
          ownerId,
          ...data,
          legacyAge: null,
          photos: [],
        },
        select: petDetailSelect,
      });

      return this.toDetail(pet);
    });
  }

  /** Fully replaces editable fields on a pet owned by the authenticated account. */
  async update(ownerId: string, id: string, input: UpdatePetRequest): Promise<MyPetDetail> {
    const data = this.normalizeInput(input);

    return this.prisma.$transaction(async (transaction) => {
      await this.assertActiveOwner(transaction, ownerId);
      const existing = await transaction.pet.findFirst({
        where: { id, ownerId },
        select: { id: true },
      });

      if (!existing) {
        throw petNotFound();
      }

      const pet = await transaction.pet.update({
        where: { id },
        data,
        select: petDetailSelect,
      });

      return this.toDetail(pet);
    });
  }

  /** Deletes an owned pet unless an order still holds the restrictive reference. */
  async delete(ownerId: string, id: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await this.assertActiveOwner(transaction, ownerId);
        const existing = await transaction.pet.findFirst({
          where: { id, ownerId },
          select: { id: true },
        });

        if (!existing) {
          throw petNotFound();
        }

        const orderReferences = await transaction.order.count({ where: { petId: id } });

        if (orderReferences > 0) {
          throw petReferencedByOrder();
        }

        await transaction.pet.delete({ where: { id } });
      });
    } catch (error) {
      if (this.isPrismaError(error, "P2003")) {
        throw petReferencedByOrder();
      }

      if (this.isPrismaError(error, "P2025")) {
        throw petNotFound();
      }

      throw error;
    }
  }

  private async assertActiveOwner(
    transaction: Prisma.TransactionClient,
    ownerId: string,
  ): Promise<void> {
    if ((await lockUserRow(transaction, ownerId))?.status !== "active") {
      throw petAccountDisabled();
    }
  }

  private normalizeInput(input: CreatePetRequest): {
    name: string;
    species: string;
    breed: string;
    gender: string;
    birthDate: Date | null;
    weight: number | null;
    sterilized: boolean;
    habits: string | null;
    allergies: string | null;
    tabooFoods: string | null;
  } {
    const species = Object.values(PET_SPECIES);
    const genders = Object.values(PET_GENDER);

    if (!species.includes(input.species) || !genders.includes(input.gender)) {
      throw petValidationFailed();
    }

    if (typeof input.sterilized !== "boolean") {
      throw petValidationFailed();
    }

    const weight = input.weightKg;

    if (
      weight !== null &&
      (!Number.isFinite(weight) ||
        weight < PET_PROFILE_LIMITS.WEIGHT_MIN_KG ||
        weight > PET_PROFILE_LIMITS.WEIGHT_MAX_KG)
    ) {
      throw petValidationFailed("宠物体重超出允许范围");
    }

    return {
      name: this.normalizeRequiredText(input.name, PET_PROFILE_LIMITS.NAME_MAX_LENGTH, "宠物名字"),
      species: input.species,
      breed: this.normalizeRequiredText(
        input.breed,
        PET_PROFILE_LIMITS.BREED_MAX_LENGTH,
        "宠物品种",
      ),
      gender: input.gender,
      birthDate: this.parseBirthDate(input.birthDate),
      weight,
      sterilized: input.sterilized,
      habits: this.normalizeOptionalText(input.habits, "生活习惯"),
      allergies: this.normalizeOptionalText(input.allergies, "过敏信息"),
      tabooFoods: this.normalizeOptionalText(input.tabooFoods, "忌口信息"),
    };
  }

  private parseBirthDate(value: string | null): Date | null {
    if (value === null) {
      return null;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);

    if (!match) {
      throw petValidationFailed("宠物生日格式无效");
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw petValidationFailed("宠物生日格式无效");
    }

    return date;
  }

  private normalizeRequiredText(value: string, maxLength: number, field: string): string {
    const normalized = typeof value === "string" ? value.trim() : "";

    if (!normalized || normalized.length > maxLength || /\p{Cc}/u.test(normalized)) {
      throw petValidationFailed(`${field}格式无效`);
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | null, field: string): string | null {
    if (value === null) {
      return null;
    }

    const normalized = typeof value === "string" ? value.trim() : "";

    if (normalized.length > PET_PROFILE_LIMITS.CARE_TEXT_MAX_LENGTH || /\p{Cc}/u.test(normalized)) {
      throw petValidationFailed(`${field}格式无效`);
    }

    return normalized || null;
  }

  private toListItem(row: PetListRow): MyPetListItem {
    return {
      id: row.id,
      name: row.name,
      species: row.species as MyPetListItem["species"],
      breed: row.breed,
      gender: row.gender as MyPetListItem["gender"],
      birthDate: row.birthDate?.toISOString().slice(0, 10) ?? null,
      coverImage: row.photos[0] ?? null,
    };
  }

  private toDetail(row: PetDetailRow): MyPetDetail {
    return {
      ...this.toListItem(row),
      weightKg: row.weight,
      sterilized: row.sterilized,
      habits: row.habits,
      allergies: row.allergies,
      tabooFoods: row.tabooFoods,
      photoUrls: [...row.photos],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
  }
}
