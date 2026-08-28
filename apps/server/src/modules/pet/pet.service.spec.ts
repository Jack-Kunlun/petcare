import { HttpStatus } from "@nestjs/common";
import { PET_ERROR_CODE, PET_GENDER, PET_SPECIES } from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { PetService } from "./pet.service";

describe("PetService", () => {
  const prisma = {
    pet: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const transaction = {
    $queryRaw: jest.fn(),
    pet: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    petMediaAsset: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const storage = { delete: jest.fn() };
  const service = new PetService(prisma as unknown as PrismaService, storage as never);
  const petId = "11111111-1111-4111-8111-111111111111";
  const createdAt = new Date("2026-08-27T01:00:00.000Z");
  const updatedAt = new Date("2026-08-27T02:00:00.000Z");
  const row = {
    id: petId,
    name: "米米",
    species: PET_SPECIES.CAT,
    breed: "英短",
    gender: PET_GENDER.FEMALE,
    birthDate: new Date("2023-05-12T00:00:00.000Z"),
    weight: 4.6,
    sterilized: true,
    notes: "怕生，不能吃葡萄",
    photos: ["https://cdn.example/pet.jpg"],
    mediaAssets: [
      {
        id: "photo-1",
        publicUrl: "https://cdn.example/pet.jpg",
        mimeType: "image/jpeg",
        width: 640,
        height: 640,
        sizeBytes: 1024,
      },
    ],
    createdAt,
    updatedAt,
  };
  const input = {
    name: "  米米  ",
    species: PET_SPECIES.CAT,
    breed: "  英短  ",
    gender: PET_GENDER.FEMALE,
    birthDate: "2023-05-12",
    weightKg: 4.6,
    sterilized: true,
    notes: "  怕生，不能吃葡萄  ",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((operation) => operation(transaction));
    transaction.$queryRaw.mockResolvedValue([{ status: "active", phone: null }]);
    transaction.petMediaAsset.findMany.mockResolvedValue([]);
    transaction.petMediaAsset.updateMany.mockResolvedValue({ count: 0 });
    storage.delete.mockResolvedValue(undefined);
  });

  it("lists only owner-scoped pets and maps private storage fields", async () => {
    prisma.pet.findMany.mockResolvedValue([row]);

    await expect(service.findMine("user-1")).resolves.toEqual([
      {
        id: petId,
        name: "米米",
        species: PET_SPECIES.CAT,
        breed: "英短",
        gender: PET_GENDER.FEMALE,
        birthDate: "2023-05-12",
        coverImage: "https://cdn.example/pet.jpg",
      },
    ]);
    expect(prisma.pet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: "user-1" } }),
    );
  });

  it("returns full owner-only care data without leaking legacy age", async () => {
    prisma.pet.findFirst.mockResolvedValue(row);

    await expect(service.findMineById("user-1", petId)).resolves.toEqual({
      id: petId,
      name: "米米",
      species: PET_SPECIES.CAT,
      breed: "英短",
      gender: PET_GENDER.FEMALE,
      birthDate: "2023-05-12",
      coverImage: "https://cdn.example/pet.jpg",
      weightKg: 4.6,
      sterilized: true,
      notes: "怕生，不能吃葡萄",
      photoUrls: ["https://cdn.example/pet.jpg"],
      photoAssets: [
        {
          id: "photo-1",
          url: "https://cdn.example/pet.jpg",
          mimeType: "image/jpeg",
          width: 640,
          height: 640,
          sizeBytes: 1024,
        },
      ],
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    expect(prisma.pet.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: petId, ownerId: "user-1" } }),
    );
  });

  it("hides missing and cross-owner profiles behind the same not-found error", async () => {
    prisma.pet.findFirst.mockResolvedValue(null);

    await expect(service.findMineById("user-2", petId)).rejects.toMatchObject({
      code: PET_ERROR_CODE.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
  });

  it("serializes creation on the owner row and persists normalized current fields", async () => {
    transaction.pet.count.mockResolvedValue(4);
    transaction.pet.create.mockResolvedValue(row);

    await expect(service.create("user-1", input)).resolves.toMatchObject({ id: petId });
    expect(transaction.pet.count).toHaveBeenCalledWith({ where: { ownerId: "user-1" } });
    expect(transaction.pet.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        name: "米米",
        species: PET_SPECIES.CAT,
        breed: "英短",
        gender: PET_GENDER.FEMALE,
        birthDate: new Date("2023-05-12T00:00:00.000Z"),
        weight: 4.6,
        sterilized: true,
        notes: "怕生，不能吃葡萄",
        legacyAge: null,
        photos: [],
      },
      select: expect.any(Object),
    });
    expect(transaction.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.pet.count.mock.invocationCallOrder[0],
    );
  });

  it("enforces the five-pet limit inside the owner-locked transaction", async () => {
    transaction.pet.count.mockResolvedValue(5);

    await expect(service.create("user-1", input)).rejects.toMatchObject({
      code: PET_ERROR_CODE.LIMIT_REACHED,
      status: HttpStatus.CONFLICT,
    });
    expect(transaction.pet.create).not.toHaveBeenCalled();
  });

  it("rejects an impossible calendar date before starting a transaction", async () => {
    await expect(
      service.create("user-1", { ...input, birthDate: "2023-02-30" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED", status: HttpStatus.BAD_REQUEST });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates only an owner-matched profile and preserves photos outside this node", async () => {
    transaction.pet.findFirst.mockResolvedValue({ id: petId });
    transaction.pet.update.mockResolvedValue({ ...row, name: "团子" });

    await expect(
      service.update("user-1", petId, { ...input, name: " 团子 " }),
    ).resolves.toMatchObject({ id: petId, name: "团子" });
    expect(transaction.pet.update).toHaveBeenCalledWith({
      where: { id: petId },
      data: expect.not.objectContaining({ ownerId: expect.anything(), photos: expect.anything() }),
      select: expect.any(Object),
    });
  });

  it("rejects a cross-owner update without issuing a write", async () => {
    transaction.pet.findFirst.mockResolvedValue(null);

    await expect(service.update("user-2", petId, input)).rejects.toMatchObject({
      code: PET_ERROR_CODE.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    });
    expect(transaction.pet.update).not.toHaveBeenCalled();
  });

  it("blocks deletion while any order references the owned pet", async () => {
    transaction.pet.findFirst.mockResolvedValue({ id: petId });
    transaction.order.count.mockResolvedValue(1);

    await expect(service.delete("user-1", petId)).rejects.toMatchObject({
      code: PET_ERROR_CODE.REFERENCED_BY_ORDER,
      status: HttpStatus.CONFLICT,
    });
    expect(transaction.pet.delete).not.toHaveBeenCalled();
  });

  it("maps a foreign-key race to the stable referenced-by-order conflict", async () => {
    transaction.pet.findFirst.mockResolvedValue({ id: petId });
    transaction.order.count.mockResolvedValue(0);
    transaction.pet.delete.mockRejectedValue({ code: "P2003" });

    await expect(service.delete("user-1", petId)).rejects.toMatchObject({
      code: PET_ERROR_CODE.REFERENCED_BY_ORDER,
      status: HttpStatus.CONFLICT,
    });
  });

  it("deletes an unreferenced owner-matched profile", async () => {
    transaction.pet.findFirst.mockResolvedValue({ id: petId });
    transaction.order.count.mockResolvedValue(0);
    transaction.petMediaAsset.findMany.mockResolvedValue([
      { storageKey: "public/pet-media/2026/08/photo.jpg" },
    ]);
    transaction.petMediaAsset.updateMany.mockResolvedValue({ count: 1 });
    transaction.pet.delete.mockResolvedValue({ id: petId });

    await expect(service.delete("user-1", petId)).resolves.toBeUndefined();
    expect(transaction.petMediaAsset.updateMany).toHaveBeenCalledWith({
      where: { ownerId: "user-1", petId, status: "active" },
      data: { status: "discarded", petId: null, discardedAt: expect.any(Date) },
    });
    expect(transaction.pet.delete).toHaveBeenCalledWith({ where: { id: petId } });
    expect(storage.delete).toHaveBeenCalledWith("public/pet-media/2026/08/photo.jpg");
  });

  it("keeps pet deletion successful when managed object cleanup must be retried", async () => {
    transaction.pet.findFirst.mockResolvedValue({ id: petId });
    transaction.order.count.mockResolvedValue(0);
    transaction.petMediaAsset.findMany.mockResolvedValue([
      { storageKey: "public/pet-media/2026/08/photo.jpg" },
    ]);
    transaction.petMediaAsset.updateMany.mockResolvedValue({ count: 1 });
    transaction.pet.delete.mockResolvedValue({ id: petId });
    storage.delete.mockRejectedValue(new Error("offline"));

    await expect(service.delete("user-1", petId)).resolves.toBeUndefined();
  });
});
