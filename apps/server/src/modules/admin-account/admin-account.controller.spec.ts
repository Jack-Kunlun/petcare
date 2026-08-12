import { GUARDS_METADATA } from "@nestjs/common/constants";
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
});
