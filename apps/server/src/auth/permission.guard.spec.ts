import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { PermissionGuard } from "./permission.guard";

function contextFor(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as ExecutionContext;
}

describe("PermissionGuard", () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let authService: { getCurrentUserAuthorization: jest.Mock };
  let guard: PermissionGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    authService = { getCurrentUserAuthorization: jest.fn() };
    guard = new PermissionGuard(
      reflector as unknown as Reflector,
      authService as unknown as AuthService,
    );
  });

  it("允许拥有全部声明权限的管理员", async () => {
    reflector.getAllAndOverride.mockReturnValue(["system.view", "system.publish"]);
    authService.getCurrentUserAuthorization.mockResolvedValue({
      roles: ["config_admin"],
      permissions: ["system.view", "system.publish"],
    });

    await expect(guard.canActivate(contextFor({ sub: "admin-1" }))).resolves.toBe(true);
  });

  it("拒绝缺少任意声明权限的管理员", async () => {
    reflector.getAllAndOverride.mockReturnValue(["system.publish"]);
    authService.getCurrentUserAuthorization.mockResolvedValue({
      roles: ["config_admin"],
      permissions: ["system.view"],
    });

    await expect(guard.canActivate(contextFor({ sub: "admin-1" }))).rejects.toThrow(
      "缺少系统设置操作权限",
    );
  });

  it("拒绝缺少访问令牌主体的请求", async () => {
    const activation = guard.canActivate(contextFor(undefined));

    await expect(activation).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(activation).rejects.toThrow("登录状态已失效");
    expect(authService.getCurrentUserAuthorization).not.toHaveBeenCalled();
  });

  it("在未声明权限时不查询授权信息", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextFor({ sub: "admin-1" }))).resolves.toBe(true);
    expect(authService.getCurrentUserAuthorization).not.toHaveBeenCalled();
  });

  it("将无效或无权限的当前用户拒绝为禁止访问", async () => {
    reflector.getAllAndOverride.mockReturnValue(["system.view"]);
    authService.getCurrentUserAuthorization.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor({ sub: "admin-1" }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
