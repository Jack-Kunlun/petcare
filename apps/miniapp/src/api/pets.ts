import type {
  CreatePetRequest,
  MyPetDetail,
  MyPetListResponse,
  PetPhotoAsset,
  UpdatePetRequest,
} from "@petcare/shared-types";
import { authorizedRequest, authorizedUpload } from "../state/session";
import type { UploadProgressHandler } from "./request";

/** Reads the authenticated owner's bounded pet list. */
export function getMyPets(): Promise<MyPetListResponse> {
  return authorizedRequest("/pets");
}

/** Reads one pet only when it belongs to the authenticated owner. */
export function getMyPet(id: string): Promise<MyPetDetail> {
  return authorizedRequest(`/pets/${encodeURIComponent(id)}`);
}

/** Creates one pet owned by the authenticated account. */
export function createPet(request: CreatePetRequest): Promise<MyPetDetail> {
  return authorizedRequest("/pets", { method: "POST", data: request });
}

/** Fully replaces one owned pet's editable profile fields. */
export function updatePet(id: string, request: UpdatePetRequest): Promise<MyPetDetail> {
  return authorizedRequest(`/pets/${encodeURIComponent(id)}`, { method: "PUT", data: request });
}

/** Deletes one owned pet when no order still references it. */
export function deletePet(id: string): Promise<void> {
  return authorizedRequest(`/pets/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Uploads and binds one selected local image to an owned pet. */
export function uploadPetPhoto(
  id: string,
  filePath: string,
  onProgress?: UploadProgressHandler,
): Promise<PetPhotoAsset> {
  return authorizedUpload(
    `/pets/${encodeURIComponent(id)}/media-assets`,
    filePath,
    "file",
    {},
    onProgress,
  );
}

/** Deletes one managed image only from its currently owned pet. */
export function deletePetPhoto(id: string, assetId: string): Promise<void> {
  return authorizedRequest(
    `/pets/${encodeURIComponent(id)}/media-assets/${encodeURIComponent(assetId)}`,
    { method: "DELETE" },
  );
}
