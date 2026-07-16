// apps/api/src/modules/user/user.controller.ts

import { Controller, Post, Body, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { RegisterDto } from "./dto/register.dto";
import { UserService } from "./user.service";

@ApiTags("users")
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post("register")
  @ApiOperation({ summary: "用户注册" })
  async register(@Body() dto: RegisterDto) {
    return this.userService.register(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "获取用户详情" })
  async findOne(@Param("id") id: string) {
    return this.userService.findOne(id);
  }
}
