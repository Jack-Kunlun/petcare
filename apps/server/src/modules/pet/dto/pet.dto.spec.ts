import { PET_GENDER, PET_SPECIES } from "@petcare/shared-types";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreatePetDto, UpdatePetDto } from "./pet.dto";

const validPet = {
  name: "  米米  ",
  species: PET_SPECIES.CAT,
  breed: "  英短  ",
  gender: PET_GENDER.FEMALE,
  birthDate: "2023-05-12",
  weightKg: 4.6,
  sterilized: true,
  habits: "  怕生  ",
  allergies: null,
  tabooFoods: "  葡萄  ",
};

describe("pet DTOs", () => {
  it.each([CreatePetDto, UpdatePetDto])(
    "accepts and normalizes the complete owner-controlled payload for %p",
    async (Dto) => {
      const value = plainToInstance(Dto, validPet);

      await expect(validate(value)).resolves.toHaveLength(0);
      expect(value).toMatchObject({
        name: "米米",
        breed: "英短",
        habits: "怕生",
        tabooFoods: "葡萄",
      });
    },
  );

  it("requires explicit nullable fields so full replacement cannot erase data accidentally", async () => {
    const value = plainToInstance(CreatePetDto, {
      name: "米米",
      species: PET_SPECIES.CAT,
      breed: "英短",
      gender: PET_GENDER.FEMALE,
      sterilized: true,
    });

    await expect(validate(value)).resolves.toHaveLength(5);
  });

  it.each([
    { ...validPet, name: "" },
    { ...validPet, name: "猫".repeat(11) },
    { ...validPet, breed: "" },
    { ...validPet, species: "fish" },
    { ...validPet, gender: "secret" },
    { ...validPet, birthDate: "2023/05/12" },
    { ...validPet, weightKg: 0 },
    { ...validPet, weightKg: 200.001 },
    { ...validPet, sterilized: "yes" },
    { ...validPet, habits: "字".repeat(201) },
  ])("rejects an invalid complete payload %#", async (input) => {
    await expect(validate(plainToInstance(CreatePetDto, input))).resolves.not.toHaveLength(0);
  });

  it("rejects client-supplied ownership fields under the global whitelist policy", async () => {
    const value = plainToInstance(CreatePetDto, { ...validPet, ownerId: "user-2" });

    await expect(
      validate(value, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.not.toHaveLength(0);
  });
});
