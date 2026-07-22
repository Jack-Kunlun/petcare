import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";

const publicUserSelect = {
  id: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
  userType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        nickname: dto.nickname,
        avatar: dto.avatar,
      },
      select: publicUserSelect,
    });

    return {
      user,
      token: "mock-token",
      refreshToken: "mock-refresh-token",
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!user) {
      throw new ApiException("RESOURCE_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
    }

    return user;
  }
}
