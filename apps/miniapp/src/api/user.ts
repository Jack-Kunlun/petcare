import type { MiniappUserProfile, UpdateMiniappProfileRequest } from "@petcare/shared-types";
import { authorizedRequest, authorizedUpload } from "../state/session";

/** Reads the authenticated Miniapp user's current profile. */
export function getProfile(): Promise<MiniappUserProfile> {
  return authorizedRequest("/users/me");
}

/** Replaces the authenticated Miniapp user's editable text profile. */
export function updateProfile(profile: UpdateMiniappProfileRequest): Promise<MiniappUserProfile> {
  return authorizedRequest("/users/me", { method: "PUT", data: profile });
}

/** Uploads and immediately persists a selected local avatar file. */
export function uploadAvatar(filePath: string): Promise<MiniappUserProfile> {
  return authorizedUpload("/users/me/avatar", filePath, "file");
}

/** Sends a first-time phone-binding verification code. */
export function sendPhoneCode(phone: string): Promise<void> {
  return authorizedRequest("/users/me/phone/code", { method: "POST", data: { phone } });
}

/** Verifies a code and binds the phone to the current Miniapp account. */
export function bindPhone(phone: string, code: string): Promise<MiniappUserProfile> {
  return authorizedRequest("/users/me/phone", { method: "PUT", data: { phone, code } });
}

/** Sends an account-cancellation code to the current account's bound phone. */
export function sendCancellationCode(): Promise<void> {
  return authorizedRequest("/users/me/cancellation/code", { method: "POST" });
}

/** Cancels the current account, omitting the optional SMS code when it is blank. */
export function cancelAccount(code?: string): Promise<void> {
  const cancellationCode = code?.trim();

  return authorizedRequest("/users/me/cancel", {
    method: "POST",
    data: cancellationCode ? { code: cancellationCode } : {},
  });
}
