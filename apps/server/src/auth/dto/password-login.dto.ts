import { ApiProperty } from "@nestjs/swagger";
import type { PasswordLoginRequest } from "@petcare/shared-types";
import { IsString, Length } from "class-validator";

/** 校验管理员密码登录请求。 */
export class PasswordLoginDto implements PasswordLoginRequest {
  @ApiProperty({ description: "手机号或账号名", example: "admin" })
  @IsString()
  @Length(3, 50)
  identifier: string;

  @ApiProperty({ format: "password", minLength: 12 })
  @IsString()
  @Length(12, 128)
  password: string;
}
