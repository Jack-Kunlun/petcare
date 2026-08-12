import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { REFRESH_COOKIE, refreshCookieOptions } from "../../auth/refresh-cookie";
import { ConfigService } from "../../config/config.service";
import { ActiveAdministratorGuard } from "./active-administrator.guard";
import { AdminAccountController } from "./admin-account.controller";
import { AdminAccountService } from "./admin-account.service";

describe("AdminAccountController", () => {
  const service = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    replaceAvatar: jest.fn(),
    deleteAvatar: jest.fn(),
  };
  const config = { nodeEnv: "development" } as ConfigService;
  const controller = new AdminAccountController(service as unknown as AdminAccountService, config);
  const request = {
    requestId: "request-1",
    user: { sub: "user-1", sid: "session-1" },
  };

  beforeEach(() => jest.clearAllMocks());

  it("protects all self-service routes with access-token and active-administrator checks", () => {
    expect(Reflect.getMetadata("path", AdminAccountController)).toBe("admin/account");
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminAccountController)).toEqual([
      AccessTokenGuard,
      ActiveAdministratorGuard,
    ]);
  });

  it("loads and updates only the access-token subject profile", async () => {
    service.getProfile.mockResolvedValue({ id: "user-1" });
    service.updateProfile.mockResolvedValue(undefined);

    await expect(controller.getProfile(request as never)).resolves.toEqual({ id: "user-1" });
    await expect(
      controller.updateProfile({ nickname: "值班管理员" }, request as never),
    ).resolves.toBeUndefined();

    expect(service.getProfile).toHaveBeenCalledWith("user-1");

    expect(service.updateProfile).toHaveBeenCalledWith("user-1", "值班管理员");
  });

  it("builds an explicit mutation context, does not read a refresh cookie, and clears it after password rotation", async () => {
    const response = { clearCookie: jest.fn() };

    service.changePassword.mockResolvedValue(undefined);

    await expect(
      controller.changePassword(
        { currentPassword: "Current-password-1", newPassword: "Replacement-password-2" },
        request as never,
        response as never,
      ),
    ).resolves.toBeUndefined();

    expect(service.changePassword).toHaveBeenCalledWith(
      { userId: "user-1", sessionId: "session-1", requestId: "request-1" },
      { currentPassword: "Current-password-1", newPassword: "Replacement-password-2" },
    );
    expect(response.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE, refreshCookieOptions(config));
  });

  it("replaces and deletes only the access-token subject avatar", async () => {
    const file = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      mimetype: "image/png",
    } as Express.Multer.File;

    service.replaceAvatar.mockResolvedValue({ avatar: "https://cdn.example.com/avatar.png" });
    service.deleteAvatar.mockResolvedValue(undefined);

    await expect(controller.replaceAvatar(file, request as never)).resolves.toEqual({
      avatar: "https://cdn.example.com/avatar.png",
    });
    await expect(controller.deleteAvatar(request as never)).resolves.toBeUndefined();

    expect(service.replaceAvatar).toHaveBeenCalledWith("user-1", {
      body: file.buffer,
      contentType: "image/png",
      extension: "png",
    });
    expect(service.deleteAvatar).toHaveBeenCalledWith("user-1");
  });

  it("documents avatar upload as multipart and binds a file field", () => {
    expect(Reflect.getMetadata("path", AdminAccountController.prototype.replaceAvatar)).toBe("avatar");
    expect(Reflect.getMetadata(METHOD_METADATA, AdminAccountController.prototype.replaceAvatar)).toBe(2);
    expect(
      Reflect.getMetadata(ROUTE_ARGS_METADATA, AdminAccountController, "replaceAvatar"),
    ).toEqual(expect.objectContaining({ "8:0": expect.objectContaining({ index: 0 }) }));
    expect(
      Reflect.getMetadata(INTERCEPTORS_METADATA, AdminAccountController.prototype.replaceAvatar),
    ).toHaveLength(1);
    expect(Reflect.getMetadata("path", AdminAccountController.prototype.deleteAvatar)).toBe("avatar");
    expect(Reflect.getMetadata(METHOD_METADATA, AdminAccountController.prototype.deleteAvatar)).toBe(3);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, AdminAccountController.prototype.deleteAvatar)).toBe(204);
  });
});
