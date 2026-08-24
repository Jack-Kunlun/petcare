import type { MiniappUserProfile, UpdateMiniappProfileRequest } from "@petcare/shared-types";
import { authorizedRequest, authorizedUpload } from "../state/session";

export function getProfile(): Promise<MiniappUserProfile> {
  return authorizedRequest("/users/me");
}

export function updateProfile(profile: UpdateMiniappProfileRequest): Promise<MiniappUserProfile> {
  return authorizedRequest("/users/me", { method: "PATCH", data: profile });
}

export function uploadAvatar(filePath: string): Promise<MiniappUserProfile> {
  return authorizedUpload("/users/me/avatar", filePath, "file");
}

export function sendPhoneCode(phone: string): Promise<void> {
  return authorizedRequest("/users/me/phone/code", { method: "POST", data: { phone } });
}

export function bindPhone(phone: string, code: string): Promise<MiniappUserProfile> {
  return authorizedRequest("/users/me/phone", { method: "PUT", data: { phone, code } });
}
