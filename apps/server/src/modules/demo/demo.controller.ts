import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { DemoScenario } from "@petcare/shared-types";
import type { Request } from "express";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { AdminGuard } from "../../auth/admin.guard";
import type { AccessTokenPayload } from "../../auth/auth.types";
import { DemoService } from "./demo.service";

type AuthRequest = Request & { user: AccessTokenPayload };

/** Shared, expiring process demonstration; no business or financial records are written. */
@Controller("demo")
@UseGuards(AccessTokenGuard)
export class MiniappDemoController {
  constructor(private readonly demos: DemoService) {}

  @Post()
  create(@Req() request: AuthRequest): Promise<DemoScenario> {
    return this.demos.create(request.user.sub);
  }

  @Get(":code")
  get(@Param("code") code: string): Promise<DemoScenario> {
    return this.demos.get(code);
  }

  @Post(":code/:action")
  advance(
    @Req() request: AuthRequest,
    @Param("code") code: string,
    @Param("action") action: string,
  ): Promise<DemoScenario> {
    return this.demos.advance(request.user.sub, code, action, "miniapp");
  }
}

/** Super-admin side of the same demonstration. */
@Controller("admin/demo")
@UseGuards(AccessTokenGuard, AdminGuard)
export class AdminDemoController {
  constructor(private readonly demos: DemoService) {}

  @Get(":code")
  get(@Param("code") code: string): Promise<DemoScenario> {
    return this.demos.get(code);
  }

  @Post(":code/:action")
  advance(
    @Req() request: AuthRequest,
    @Param("code") code: string,
    @Param("action") action: string,
  ): Promise<DemoScenario> {
    return this.demos.advance(request.user.sub, code, action, "admin");
  }
}
