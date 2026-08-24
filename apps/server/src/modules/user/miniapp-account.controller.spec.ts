import { HttpStatus, RequestMethod } from "@nestjs/common";
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
} from "@nestjs/common/constants";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { MiniappAccountController } from "./miniapp-account.controller";
import { MiniappAccountService } from "./miniapp-account.service";

describe("MiniappAccountController", () => {
  const service = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    replaceAvatar: jest.fn(),
    sendPhoneCode: jest.fn(),
    bindPhone: jest.fn(),
  };
  const controller = new MiniappAccountController(service as unknown as MiniappAccountService);
  const request = { user: { sub: "user-1" } };

  beforeEach(() => jest.clearAllMocks());

  it("registers fixed authenticated current-user routes", () => {
    expect(Reflect.getMetadata("path", MiniappAccountController)).toBe("users/me");
    expect(Reflect.getMetadata(GUARDS_METADATA, MiniappAccountController)).toEqual([
      AccessTokenGuard,
    ]);

    expect(route("getProfile")).toEqual(["/", RequestMethod.GET]);
    expect(route("updateProfile")).toEqual(["/", RequestMethod.PUT]);
    expect(route("replaceAvatar")).toEqual(["avatar", RequestMethod.POST]);
    expect(route("sendPhoneCode")).toEqual(["phone/code", RequestMethod.POST]);
    expect(route("bindPhone")).toEqual(["phone", RequestMethod.PUT]);
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, MiniappAccountController.prototype.sendPhoneCode),
    ).toBe(HttpStatus.NO_CONTENT);
  });

  it("uses only the authenticated subject for profile and phone operations", async () => {
    service.getProfile.mockResolvedValue({ id: "user-1" });
    service.updateProfile.mockResolvedValue({ id: "user-1" });
    service.sendPhoneCode.mockResolvedValue(undefined);
    service.bindPhone.mockResolvedValue({ id: "user-1", profileComplete: true });
    const profile = { nickname: "家长甲", region: null, bio: null };

    await expect(controller.getProfile(request as never)).resolves.toEqual({ id: "user-1" });
    await expect(controller.updateProfile(profile, request as never)).resolves.toEqual({
      id: "user-1",
    });
    await expect(
      controller.sendPhoneCode({ phone: "13800138000" }, request as never),
    ).resolves.toBeUndefined();
    await expect(
      controller.bindPhone({ phone: "13800138000", code: "123456" }, request as never),
    ).resolves.toMatchObject({ profileComplete: true });

    expect(service.getProfile).toHaveBeenCalledWith("user-1");
    expect(service.updateProfile).toHaveBeenCalledWith("user-1", profile);
    expect(service.sendPhoneCode).toHaveBeenCalledWith("user-1", "13800138000");
    expect(service.bindPhone).toHaveBeenCalledWith("user-1", "13800138000", "123456");
  });

  it("fails closed when the guard does not provide an authenticated subject", () => {
    expect(() => controller.getProfile({} as never)).toThrow(
      expect.objectContaining({ code: "AUTH_SESSION_EXPIRED", status: HttpStatus.UNAUTHORIZED }),
    );
    expect(service.getProfile).not.toHaveBeenCalled();
  });

  it("reuses byte-based avatar detection behind a single-file memory upload", async () => {
    const file = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      mimetype: "image/png",
    } as Express.Multer.File;

    service.replaceAvatar.mockResolvedValue({ id: "user-1", avatar: "https://cdn/avatar.png" });

    await expect(controller.replaceAvatar(file, request as never)).resolves.toMatchObject({
      avatar: "https://cdn/avatar.png",
    });
    expect(service.replaceAvatar).toHaveBeenCalledWith("user-1", {
      body: file.buffer,
      contentType: "image/png",
      extension: "png",
    });
    expect(
      Reflect.getMetadata(INTERCEPTORS_METADATA, MiniappAccountController.prototype.replaceAvatar),
    ).toHaveLength(1);
  });
});

function route(method: keyof MiniappAccountController): [string, RequestMethod] {
  return [
    Reflect.getMetadata("path", MiniappAccountController.prototype[method]),
    Reflect.getMetadata(METHOD_METADATA, MiniappAccountController.prototype[method]),
  ];
}
