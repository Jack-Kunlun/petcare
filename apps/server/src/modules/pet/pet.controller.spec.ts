import { HttpStatus, RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
} from "@nestjs/common/constants";
import { SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { PET_GENDER, PET_SPECIES } from "@petcare/shared-types";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { WebsiteContentModule } from "../website-content/website-content.module";
import { PetMediaService } from "./pet-media.service";
import { PetController } from "./pet.controller";
import { PetModule } from "./pet.module";
import { PetService } from "./pet.service";

describe("PetController", () => {
  const service = {
    findMine: jest.fn(),
    findMineById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const media = { upload: jest.fn(), remove: jest.fn() };
  const controller = new PetController(service as unknown as PetService, media as never);
  const request = { user: { sub: "user-1" } };
  const petId = "11111111-1111-4111-8111-111111111111";
  const input = {
    name: "米米",
    species: PET_SPECIES.CAT,
    breed: "英短",
    gender: PET_GENDER.FEMALE,
    birthDate: "2023-05-12",
    weightKg: 4.6,
    sterilized: true,
    habits: null,
    allergies: null,
    tabooFoods: null,
  };

  beforeEach(() => jest.clearAllMocks());

  it("registers fixed authenticated owner-only CRUD routes", () => {
    expect(Reflect.getMetadata("path", PetController)).toBe("pets");
    expect(Reflect.getMetadata(GUARDS_METADATA, PetController)).toEqual([AccessTokenGuard]);
    expect(route("findMine")).toEqual(["/", RequestMethod.GET]);
    expect(route("create")).toEqual(["/", RequestMethod.POST]);
    expect(route("uploadPhoto")).toEqual([":id/media-assets", RequestMethod.POST]);
    expect(route("deletePhoto")).toEqual([":id/media-assets/:assetId", RequestMethod.DELETE]);
    expect(route("findMineById")).toEqual([":id", RequestMethod.GET]);
    expect(route("update")).toEqual([":id", RequestMethod.PUT]);
    expect(route("delete")).toEqual([":id", RequestMethod.DELETE]);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, PetController.prototype.delete)).toBe(
      HttpStatus.NO_CONTENT,
    );
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, PetController.prototype.deletePhoto)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it("reuses the managed website storage provider for pet media", () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, PetModule)).toContain(WebsiteContentModule);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PetModule)).toEqual(
      expect.arrayContaining([PetService, PetMediaService]),
    );
  });

  it("derives ownership exclusively from the authenticated subject", async () => {
    service.findMine.mockResolvedValue([]);
    service.findMineById.mockResolvedValue({ id: petId });
    service.create.mockResolvedValue({ id: petId });
    service.update.mockResolvedValue({ id: petId });
    service.delete.mockResolvedValue(undefined);

    await expect(controller.findMine(request as never)).resolves.toEqual([]);
    await expect(controller.findMineById(request as never, petId)).resolves.toEqual({ id: petId });
    await expect(controller.create(request as never, input)).resolves.toEqual({ id: petId });
    await expect(controller.update(request as never, petId, input)).resolves.toEqual({ id: petId });
    await expect(controller.delete(request as never, petId)).resolves.toBeUndefined();

    expect(service.findMine).toHaveBeenCalledWith("user-1");
    expect(service.findMineById).toHaveBeenCalledWith("user-1", petId);
    expect(service.create).toHaveBeenCalledWith("user-1", input);
    expect(service.update).toHaveBeenCalledWith("user-1", petId, input);
    expect(service.delete).toHaveBeenCalledWith("user-1", petId);
  });

  it("derives photo ownership from the token and rejects a missing multipart file", async () => {
    const assetId = "22222222-2222-4222-8222-222222222222";
    const file = {
      buffer: Buffer.from("image"),
      originalname: "pet.png",
      mimetype: "image/png",
    } as Express.Multer.File;

    media.upload.mockResolvedValue({ id: assetId });
    media.remove.mockResolvedValue(undefined);

    await expect(controller.uploadPhoto(request as never, petId, file)).resolves.toEqual({
      id: assetId,
    });
    expect(media.upload).toHaveBeenCalledWith("user-1", petId, {
      buffer: file.buffer,
      originalName: "pet.png",
      mimeType: "image/png",
    });
    await expect(controller.deletePhoto(request as never, petId, assetId)).resolves.toBeUndefined();
    expect(media.remove).toHaveBeenCalledWith("user-1", petId, assetId);

    expect(() => controller.uploadPhoto(request as never, petId, undefined)).toThrow(
      "请选择要上传的宠物图片",
    );
  });

  it("documents owner-only pet media routes and the multipart file contract", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PetController],
      providers: [
        { provide: PetService, useValue: {} },
        { provide: PetMediaService, useValue: {} },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const app = moduleRef.createNestApplication();

    await app.init();
    const document = SwaggerModule.createDocument(app, {
      openapi: "3.0.0",
      info: { title: "test", version: "1" },
    });
    const upload = document.paths["/pets/{id}/media-assets"]?.post;
    const remove = document.paths["/pets/{id}/media-assets/{assetId}"]?.delete;

    expect(upload?.requestBody).toMatchObject({
      content: { "multipart/form-data": { schema: { required: ["file"] } } },
    });
    expect(upload?.responses).toEqual(
      expect.objectContaining({
        "201": expect.any(Object),
        "400": expect.any(Object),
        "401": expect.any(Object),
        "403": expect.any(Object),
        "404": expect.any(Object),
        "409": expect.any(Object),
        "413": expect.any(Object),
        "503": expect.any(Object),
      }),
    );
    expect(remove?.responses).toEqual(
      expect.objectContaining({
        "204": expect.any(Object),
        "400": expect.any(Object),
        "401": expect.any(Object),
        "403": expect.any(Object),
        "404": expect.any(Object),
      }),
    );

    await app.close();
  });
});

function route(method: keyof PetController): [string, RequestMethod] {
  return [
    Reflect.getMetadata("path", PetController.prototype[method]),
    Reflect.getMetadata(METHOD_METADATA, PetController.prototype[method]),
  ];
}
