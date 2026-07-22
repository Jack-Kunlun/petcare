import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ApiStandardErrors,
  ApiSuccessResponse,
} from "../../common/swagger/api-response.decorators";
import { RegisterDto } from "./dto/register.dto";
import { UserRegisterResponseDto, UserResponseDto } from "./dto/user-response.dto";
import { UserService } from "./user.service";

@ApiTags("users")
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post("register")
  @ApiOperation({ summary: "用户注册" })
  @ApiSuccessResponse(UserRegisterResponseDto, { status: 201 })
  @ApiStandardErrors(400, 500)
  register(@Body() dto: RegisterDto) {
    return this.userService.register(dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "获取用户详情" })
  @ApiSuccessResponse(UserResponseDto)
  @ApiStandardErrors(404, 500)
  findOne(@Param("id") id: string) {
    return this.userService.findOne(id);
  }
}
