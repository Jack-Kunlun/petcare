import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminUserListQueryDto } from "./dto/admin-user-list-query.dto";
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

const adminUserListSelect = {
  ...publicUserSelect,
  provider: {
    select: {
      idCardVerified: true,
      trainingPassed: true,
      certifiedSitter: true,
    },
  },
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

  async findAdminPage(query: AdminUserListQueryDto) {
    const keyword = query.keyword?.trim();
    const filters: object[] = [];

    if (keyword) {
      filters.push({
        OR: [
          { phone: { contains: keyword } },
          { username: { contains: keyword, mode: "insensitive" } },
          { nickname: { contains: keyword, mode: "insensitive" } },
        ],
      });
    }

    if (query.userType) {
      filters.push({ userType: query.userType });
    }

    if (query.status) {
      filters.push({ status: query.status });
    }

    const where = filters.length > 0 ? { AND: filters } : {};
    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: adminUserListSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      list,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
