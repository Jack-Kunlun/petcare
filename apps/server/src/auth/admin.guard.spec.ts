import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AdminGuard } from "./admin.guard";
import { AuthService } from "./auth.service";

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe("AdminGuard", () => {
  it("accepts a current active super administrator", async () => {
    const authService = {
      getCurrentUser: jest.fn().mockResolvedValue({ id: "user-1", roles: ["super_admin"] }),
    } as unknown as AuthService;
    const guard = new AdminGuard(authService);

    await expect(guard.canActivate(contextFor({ sub: "user-1" }))).resolves.toBe(true);
    expect(authService.getCurrentUser).toHaveBeenCalledWith("user-1");
  });

  it("rejects a missing access-token principal", async () => {
    const authService = {
      getCurrentUser: jest.fn(),
    } as unknown as AuthService;
    const guard = new AdminGuard(authService);

    await expect(guard.canActivate(contextFor(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
