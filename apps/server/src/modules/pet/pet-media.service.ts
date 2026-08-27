import { Inject, Injectable } from "@nestjs/common";
import { PET_PROFILE_LIMITS, type PetPhotoAsset } from "@petcare/shared-types";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { lockUserRow } from "../../prisma/user-row-lock";
import { validateWebsiteMediaFile } from "../website-content/media/website-media-file";
import type { WebsiteMediaStorage } from "../website-content/media/website-media-storage.types";
import { WEBSITE_MEDIA_STORAGE } from "../website-content/website-media.service";
import { PET_MEDIA_STATUS } from "./pet-media.constants";
import {
  petAccountDisabled,
  petNotFound,
  petPhotoInvalid,
  petPhotoLimitReached,
  petPhotoNotFound,
  petPhotoStorageUnavailable,
} from "./pet.errors";

/** Raw multipart fields passed through byte-level pet-photo validation. */
export interface PetMediaUploadFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

const photoAssetSelect = {
  id: true,
  publicUrl: true,
  mimeType: true,
  width: true,
  height: true,
  sizeBytes: true,
} as const;

type PetMediaRow = Prisma.PetMediaAssetGetPayload<{ select: typeof photoAssetSelect }>;

/** Coordinates owner-only pet-photo validation, storage, binding, and cleanup. */
@Injectable()
export class PetMediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WEBSITE_MEDIA_STORAGE) private readonly storage: WebsiteMediaStorage,
  ) {}

  /** Uploads and atomically binds one validated image to an owned pet. */
  async upload(ownerId: string, petId: string, file: PetMediaUploadFile): Promise<PetPhotoAsset> {
    const preflight = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId },
      select: { id: true, photos: true },
    });

    if (!preflight) {
      throw petNotFound();
    }

    this.assertPhotoSlotAvailable(preflight.photos);

    const valid = await validateWebsiteMediaFile(file.buffer, file.originalName, file.mimeType, {
      subject: "宠物图片",
      minDimension: PET_PROFILE_LIMITS.PHOTO_MIN_DIMENSION_PX,
      maxDimension: PET_PROFILE_LIMITS.PHOTO_MAX_DIMENSION_PX,
      errorFactory: petPhotoInvalid,
    });
    let stored: Awaited<ReturnType<WebsiteMediaStorage["put"]>>;

    try {
      stored = await this.storage.put({
        body: file.buffer,
        mimeType: valid.mimeType,
        extension: valid.extension,
        area: "pet-media",
      });
    } catch {
      throw petPhotoStorageUnavailable();
    }

    try {
      const record = await this.prisma.$transaction(async (transaction) => {
        await this.assertActiveOwner(transaction, ownerId);
        const pet = await transaction.pet.findFirst({
          where: { id: petId, ownerId },
          select: { id: true, photos: true },
        });

        if (!pet) {
          throw petNotFound();
        }

        this.assertPhotoSlotAvailable(pet.photos);

        const asset = await transaction.petMediaAsset.create({
          data: {
            ownerId,
            petId,
            storageKey: stored.storageKey,
            publicUrl: stored.publicUrl,
            originalName: this.normalizeOriginalName(file.originalName, valid.extension),
            mimeType: valid.mimeType,
            sizeBytes: valid.sizeBytes,
            width: valid.width,
            height: valid.height,
            checksum: valid.checksum,
            status: PET_MEDIA_STATUS.ACTIVE,
          },
          select: photoAssetSelect,
        });

        await transaction.pet.update({
          where: { id: petId },
          data: { photos: [...pet.photos, stored.publicUrl] },
        });

        return asset;
      });

      return this.toPhotoAsset(record);
    } catch (error) {
      await this.storage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  /** Unbinds one owned managed photo and leaves retryable cleanup evidence. */
  async remove(ownerId: string, petId: string, assetId: string): Promise<void> {
    const storageKey = await this.prisma.$transaction(async (transaction) => {
      await this.assertActiveOwner(transaction, ownerId);
      const pet = await transaction.pet.findFirst({
        where: { id: petId, ownerId },
        select: { id: true, photos: true },
      });

      if (!pet) {
        throw petNotFound();
      }

      const asset = await transaction.petMediaAsset.findFirst({
        where: {
          id: assetId,
          ownerId,
          petId,
          status: PET_MEDIA_STATUS.ACTIVE,
        },
        select: { id: true, publicUrl: true, storageKey: true },
      });

      if (!asset) {
        throw petPhotoNotFound();
      }

      const discarded = await transaction.petMediaAsset.updateMany({
        where: {
          id: assetId,
          ownerId,
          petId,
          status: PET_MEDIA_STATUS.ACTIVE,
        },
        data: {
          status: PET_MEDIA_STATUS.DISCARDED,
          petId: null,
          discardedAt: new Date(),
        },
      });

      if (discarded.count !== 1) {
        throw petPhotoNotFound();
      }

      await transaction.pet.update({
        where: { id: petId },
        data: { photos: pet.photos.filter((url) => url !== asset.publicUrl) },
      });

      return asset.storageKey;
    });

    await this.storage.delete(storageKey).catch(() => undefined);
  }

  private async assertActiveOwner(
    transaction: Prisma.TransactionClient,
    ownerId: string,
  ): Promise<void> {
    if ((await lockUserRow(transaction, ownerId))?.status !== "active") {
      throw petAccountDisabled();
    }
  }

  private assertPhotoSlotAvailable(photos: readonly string[]): void {
    if (photos.length >= PET_PROFILE_LIMITS.MAX_PHOTOS_PER_PET) {
      throw petPhotoLimitReached();
    }
  }

  private normalizeOriginalName(originalName: string, extension: string): string {
    return originalName.trim().slice(0, 255) || `pet-photo.${extension}`;
  }

  private toPhotoAsset(row: PetMediaRow): PetPhotoAsset {
    return {
      id: row.id,
      url: row.publicUrl,
      mimeType: row.mimeType as PetPhotoAsset["mimeType"],
      width: row.width,
      height: row.height,
      sizeBytes: row.sizeBytes,
    };
  }
}
