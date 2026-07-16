// apps/api/src/modules/user/user.service.ts

import { Injectable } from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // TODO: 验证短信验证码

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        nickname: dto.nickname,
        avatar: dto.avatar,
      },
    });

    // 使用ConfigService获取JWT配置（用于后续实现JWT token生成）
    // const jwtSecret = this.configService.jwtSecret;
    // const jwtExpiresIn = this.configService.jwtExpiresIn;

    // TODO: 使用jwtSecret和jwtExpiresIn生成JWT token

    return {
      user,
      token: "mock-token",
      refreshToken: "mock-refresh-token",
    };
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}
