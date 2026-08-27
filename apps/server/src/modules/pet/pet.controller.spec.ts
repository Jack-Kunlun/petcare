import { HttpStatus, RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { PET_GENDER, PET_SPECIES } from "@petcare/shared-types";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { PetController } from "./pet.controller";
import { PetService } from "./pet.service";

describe("PetController", () => {
  const service = {
    findMine: jest.fn(),
    findMineById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const controller = new PetController(service as unknown as PetService);
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
    expect(route("findMineById")).toEqual([":id", RequestMethod.GET]);
    expect(route("update")).toEqual([":id", RequestMethod.PUT]);
    expect(route("delete")).toEqual([":id", RequestMethod.DELETE]);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, PetController.prototype.delete)).toBe(
      HttpStatus.NO_CONTENT,
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
});

function route(method: keyof PetController): [string, RequestMethod] {
  return [
    Reflect.getMetadata("path", PetController.prototype[method]),
    Reflect.getMetadata(METHOD_METADATA, PetController.prototype[method]),
  ];
}
