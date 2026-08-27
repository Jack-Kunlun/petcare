import { ForbiddenException } from "@nestjs/common";
import { WebsiteContentPermissionGuard } from "./website-content-permission.guard";

function contextFor(request: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => "handler",
    getClass: () => "controller",
  } as never;
}

describe("WebsiteContentPermissionGuard", () => {
  it("preserves the central authorization result when permission is granted", async () => {
    const permission = { canActivate: jest.fn().mockResolvedValue(true) };
    const audit = { record: jest.fn() };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["website.read"]) };
    const guard = new WebsiteContentPermissionGuard(
      permission as never,
      audit as never,
      reflector as never,
    );

    await expect(
      guard.canActivate(
        contextFor({ user: { sub: "operator-1" }, params: { contentKey: "home" } }),
      ),
    ).resolves.toBe(true);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("rejects Website Content keys outside the current personal-version scope", async () => {
    const permission = { canActivate: jest.fn().mockResolvedValue(true) };
    const audit = { record: jest.fn() };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["website.read"]) };
    const guard = new WebsiteContentPermissionGuard(
      permission as never,
      audit as never,
      reflector as never,
    );

    await expect(
      guard.canActivate(contextFor({ params: { contentKey: "services" } })),
    ).rejects.toMatchObject({ code: "WEBSITE_CONTENT_NOT_FOUND", status: 404 });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("audits a forbidden Website Content action without changing the original 403", async () => {
    const forbidden = new ForbiddenException();
    const permission = { canActivate: jest.fn().mockRejectedValue(forbidden) };
    const audit = { record: jest.fn().mockRejectedValue(new Error("audit unavailable")) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(["website.edit_action"]) };
    const guard = new WebsiteContentPermissionGuard(
      permission as never,
      audit as never,
      reflector as never,
    );

    await expect(
      guard.canActivate(contextFor({ user: { sub: "operator-1" }, requestId: "request-1" })),
    ).rejects.toBe(forbidden);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: "operator-1",
        action: "permission_denied",
        requestId: "request-1",
        result: expect.objectContaining({ permissionCode: "website.edit_action" }),
      }),
    );
  });
});
