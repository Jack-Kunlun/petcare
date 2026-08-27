import { HttpStatus } from "@nestjs/common";
import { PET_ERROR_CODE, PET_PROFILE_LIMITS } from "@petcare/shared-types";
import { PET_MEDIA_STATUS } from "./pet-media.constants";
import { PetMediaService } from "./pet-media.service";

const PNG_32X32 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

PNG_32X32.writeUInt32BE(32, 16);
PNG_32X32.writeUInt32BE(32, 20);

describe("PetMediaService", () => {
  const petId = "11111111-1111-4111-8111-111111111111";
  const assetId = "22222222-2222-4222-8222-222222222222";
  const publicUrl = "https://cdn.example/public/pet-media/2026/08/photo.png";
  const storageKey = "public/pet-media/2026/08/photo.png";
  const prisma = {
    pet: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const transaction = {
    $queryRaw: jest.fn(),
    pet: { findFirst: jest.fn(), update: jest.fn() },
    petMediaAsset: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const storage = {
    put: jest.fn(),
    delete: jest.fn(),
  };
  const service = new PetMediaService(prisma as never, storage as never);
  const file = {
    buffer: PNG_32X32,
    originalName: "pet.png",
    mimeType: "image/jpeg",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.pet.findFirst.mockResolvedValue({ id: petId, photos: [] });
    prisma.$transaction.mockImplementation((operation) => operation(transaction));
    transaction.$queryRaw.mockResolvedValue([{ status: "active", phone: null }]);
    transaction.pet.findFirst.mockResolvedValue({ id: petId, photos: [] });
    transaction.pet.update.mockResolvedValue({ id: petId });
    transaction.petMediaAsset.create.mockResolvedValue({
      id: assetId,
      publicUrl,
      mimeType: "image/png",
      width: 32,
      height: 32,
      sizeBytes: PNG_32X32.length,
    });
    transaction.petMediaAsset.updateMany.mockResolvedValue({ count: 1 });
    storage.put.mockResolvedValue({ storageKey, publicUrl });
    storage.delete.mockResolvedValue(undefined);
  });

  it("validates bytes, stores under the pet area, and atomically binds owner metadata", async () => {
    await expect(service.upload("user-1", petId, file)).resolves.toEqual({
      id: assetId,
      url: publicUrl,
      mimeType: "image/png",
      width: 32,
      height: 32,
      sizeBytes: PNG_32X32.length,
    });
    expect(storage.put).toHaveBeenCalledWith({
      body: PNG_32X32,
      mimeType: "image/png",
      extension: "png",
      area: "pet-media",
    });
    expect(transaction.petMediaAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        petId,
        storageKey,
        publicUrl,
        mimeType: "image/png",
        sizeBytes: PNG_32X32.length,
        status: PET_MEDIA_STATUS.ACTIVE,
      }),
      select: expect.any(Object),
    });
    expect(transaction.pet.update).toHaveBeenCalledWith({
      where: { id: petId },
      data: { photos: [publicUrl] },
    });
  });

  it("hides cross-owner pets before validating or storing bytes", async () => {
    prisma.pet.findFirst.mockResolvedValue(null);

    await expect(
      service.upload("user-2", petId, { ...file, buffer: Buffer.from("invalid") }),
    ).rejects.toMatchObject({ code: PET_ERROR_CODE.NOT_FOUND, status: HttpStatus.NOT_FOUND });
    expect(storage.put).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects corrupt and oversized bytes before object storage", async () => {
    await expect(
      service.upload("user-1", petId, { ...file, buffer: Buffer.from("invalid") }),
    ).rejects.toMatchObject({ code: PET_ERROR_CODE.PHOTO_INVALID });
    await expect(
      service.upload("user-1", petId, {
        ...file,
        buffer: Buffer.alloc(PET_PROFILE_LIMITS.PHOTO_MAX_BYTES + 1),
      }),
    ).rejects.toMatchObject({ code: PET_ERROR_CODE.PHOTO_INVALID });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("enforces the photo limit before upload and again under the owner lock", async () => {
    prisma.pet.findFirst.mockResolvedValue({
      id: petId,
      photos: Array.from({ length: PET_PROFILE_LIMITS.MAX_PHOTOS_PER_PET }, (_, index) =>
        String(index),
      ),
    });

    await expect(service.upload("user-1", petId, file)).rejects.toMatchObject({
      code: PET_ERROR_CODE.PHOTO_LIMIT_REACHED,
      status: HttpStatus.CONFLICT,
    });
    expect(storage.put).not.toHaveBeenCalled();

    prisma.pet.findFirst.mockResolvedValue({ id: petId, photos: [] });
    transaction.pet.findFirst.mockResolvedValue({
      id: petId,
      photos: Array.from({ length: PET_PROFILE_LIMITS.MAX_PHOTOS_PER_PET }, (_, index) =>
        String(index),
      ),
    });

    await expect(service.upload("user-1", petId, file)).rejects.toMatchObject({
      code: PET_ERROR_CODE.PHOTO_LIMIT_REACHED,
    });
    expect(storage.delete).toHaveBeenCalledWith(storageKey);
    expect(transaction.petMediaAsset.create).not.toHaveBeenCalled();
  });

  it("rechecks ownership after storage and compensates if the pet changed concurrently", async () => {
    transaction.pet.findFirst.mockResolvedValue(null);

    await expect(service.upload("user-1", petId, file)).rejects.toMatchObject({
      code: PET_ERROR_CODE.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
    expect(storage.delete).toHaveBeenCalledWith(storageKey);
    expect(transaction.petMediaAsset.create).not.toHaveBeenCalled();
  });

  it("maps object-store failure and compensates a failed database registration", async () => {
    storage.put.mockRejectedValueOnce(new Error("offline"));

    await expect(service.upload("user-1", petId, file)).rejects.toMatchObject({
      code: PET_ERROR_CODE.PHOTO_STORAGE_UNAVAILABLE,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();

    storage.put.mockResolvedValueOnce({ storageKey, publicUrl });
    transaction.petMediaAsset.create.mockRejectedValueOnce(new Error("db"));

    await expect(service.upload("user-1", petId, file)).rejects.toThrow("db");
    expect(storage.delete).toHaveBeenCalledWith(storageKey);
  });

  it("removes only an owned photo from its pet projection and records cleanup state", async () => {
    transaction.pet.findFirst.mockResolvedValue({
      id: petId,
      photos: [publicUrl, "https://cdn.example/legacy.png"],
    });
    transaction.petMediaAsset.findFirst.mockResolvedValue({
      id: assetId,
      publicUrl,
      storageKey,
    });

    await expect(service.remove("user-1", petId, assetId)).resolves.toBeUndefined();
    expect(transaction.petMediaAsset.updateMany).toHaveBeenCalledWith({
      where: {
        id: assetId,
        ownerId: "user-1",
        petId,
        status: PET_MEDIA_STATUS.ACTIVE,
      },
      data: {
        status: PET_MEDIA_STATUS.DISCARDED,
        petId: null,
        discardedAt: expect.any(Date),
      },
    });
    expect(transaction.pet.update).toHaveBeenCalledWith({
      where: { id: petId },
      data: { photos: ["https://cdn.example/legacy.png"] },
    });
    expect(storage.delete).toHaveBeenCalledWith(storageKey);
  });

  it("hides a media identity that is missing, cross-owner, or bound to another pet", async () => {
    transaction.petMediaAsset.findFirst.mockResolvedValue(null);

    await expect(service.remove("user-1", petId, assetId)).rejects.toMatchObject({
      code: PET_ERROR_CODE.PHOTO_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
    expect(transaction.petMediaAsset.updateMany).not.toHaveBeenCalled();
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("keeps a discarded cleanup record when object deletion must be retried", async () => {
    transaction.pet.findFirst.mockResolvedValue({ id: petId, photos: [publicUrl] });
    transaction.petMediaAsset.findFirst.mockResolvedValue({
      id: assetId,
      publicUrl,
      storageKey,
    });
    storage.delete.mockRejectedValue(new Error("offline"));

    await expect(service.remove("user-1", petId, assetId)).resolves.toBeUndefined();
    expect(transaction.petMediaAsset.updateMany).toHaveBeenCalled();
  });
});
