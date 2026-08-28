import { HttpStatus, Injectable } from "@nestjs/common";
import type { PublicUser } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminUserListQueryDto } from "./dto/admin-user-list-query.dto";

const publicUserSelect = {
  id: true,
  nickname: true,
  avatar: true,
  userType: true,
  profile: { select: { bio: true } },
} as const;

const adminUserListSelect = {
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

const adminUserDetailSelect = {
  ...adminUserListSelect,
  profile: { select: { bio: true } },
  _count: {
    select: {
      pets: true,
      posts: true,
      comments: true,
      favorites: true,
    },
  },
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the privacy-safe public profile for one active user. */
  async findOne(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, status: "active" },
      select: publicUserSelect,
    });

    if (!user) {
      throw new ApiException("RESOURCE_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
    }

    return {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      userType: user.userType,
      status: "active",
      profile: user.profile ? { region: null, bio: user.profile.bio } : null,
    };
  }

  /** 根据后台筛选条件查询账户资料。 */
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

  /** 返回单个后台用户的非敏感账户详情与使用概况。 */
  async findAdminOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: adminUserDetailSelect,
    });

    if (!user) {
      throw new ApiException("RESOURCE_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
    }

    const { _count, ...account } = user;

    return {
      ...account,
      activity: {
        petCount: _count.pets,
        postCount: _count.posts,
        commentCount: _count.comments,
        favoriteCount: _count.favorites,
      },
    };
  }
}
