import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class PasswordLoginDto {
  @ApiProperty({ description: "手机号或账号名", example: "admin" })
  @IsString()
  @Length(3, 50)
  identifier: string;

  @ApiProperty({ format: "password", minLength: 12 })
  @IsString()
  @Length(12, 128)
  password: string;
}
