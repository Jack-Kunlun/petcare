import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedRequest, authorizedUpload } from "../state/session";
import {
  createPet,
  deletePet,
  deletePetPhoto,
  getMyPet,
  getMyPets,
  updatePet,
  uploadPetPhoto,
} from "./pets";

vi.mock("../state/session", () => ({
  authorizedRequest: vi.fn(),
  authorizedUpload: vi.fn(),
}));

const authorizedRequestMock = vi.mocked(authorizedRequest);
const authorizedUploadMock = vi.mocked(authorizedUpload);
const request = {
  name: "咪咪",
  species: "cat" as const,
  breed: "英国短毛猫",
  gender: "female" as const,
  birthDate: "2023-05-12",
  weightKg: 4.6,
  sterilized: true,
  notes: "喜欢安静环境",
};

describe("miniapp pet API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses authenticated owner-only CRUD routes", async () => {
    authorizedRequestMock.mockResolvedValue({ id: "pet-1" });

    await getMyPets();
    await getMyPet("pet/1");
    await createPet(request);
    await updatePet("pet/1", request);
    await deletePet("pet/1");

    expect(authorizedRequestMock.mock.calls).toEqual([
      ["/pets"],
      ["/pets/pet%2F1"],
      ["/pets", { method: "POST", data: request }],
      ["/pets/pet%2F1", { method: "PUT", data: request }],
      ["/pets/pet%2F1", { method: "DELETE" }],
    ]);
  });

  it("uses managed media routes with native upload progress", async () => {
    const onProgress = vi.fn();

    authorizedUploadMock.mockResolvedValue({ id: "asset-1" });
    authorizedRequestMock.mockResolvedValue(undefined);

    await uploadPetPhoto("pet/1", "wxfile://pet.png", onProgress);
    await deletePetPhoto("pet/1", "asset/1");

    expect(authorizedUploadMock).toHaveBeenCalledWith(
      "/pets/pet%2F1/media-assets",
      "wxfile://pet.png",
      "file",
      {},
      onProgress,
    );
    expect(authorizedRequestMock).toHaveBeenCalledWith("/pets/pet%2F1/media-assets/asset%2F1", {
      method: "DELETE",
    });
  });
});
