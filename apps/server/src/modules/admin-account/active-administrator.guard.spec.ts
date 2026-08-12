import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../../auth/auth.service";
import { ActiveAdministratorGuard } from "./active-administrator.guard";

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe("ActiveAdministratorGuard", () => {
  let authService: { getCurrentUserAuthorization: jest.Mock };
  let guard: ActiveAdministratorGuard;

  beforeEach(() => {
    authService = { getCurrentUserAuthorization: jest.fn() };
    guard = new ActiveAdministratorGuard(authService as unknown as AuthService);
  });

  it("rejects a request without an access-token subject", async () => {
    await expect(guard.canActivate(contextFor(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.getCurrentUserAuthorization).not.toHaveBeenCalled();
  });

  it("rejects an active user with no active backend roles", async () => {
    authService.getCurrentUserAuthorization.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor({ sub: "user-1" }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(authService.getCurrentUserAuthorization).toHaveBeenCalledWith("user-1");
  });

  it("allows an administrator with any active backend role", async () => {
    authService.getCurrentUserAuthorization.mockResolvedValue({
      roles: ["operator"],
      permissions: [],
    });

    await expect(guard.canActivate(contextFor({ sub: "user-1", roles: [] }))).resolves.toBe(true);
    expect(authService.getCurrentUserAuthorization).toHaveBeenCalledWith("user-1");
  });
});
