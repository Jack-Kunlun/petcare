import { Injectable } from "@nestjs/common";
import { ADMIN_CONTENT_POST_STATUS } from "@petcare/shared-types";
import type {
  CreateCommunityPostRequest,
  MyCommunityPostListItem,
  MyCommunityPostListQuery,
  MyCommunityPostListResponse,
} from "@petcare/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeCommunityPostStatus } from "./community-post-status";

type PostRow = {
  id: string;
  content: string;
  status: string;
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toMyPost(row: PostRow): MyCommunityPostListItem {
  const status = normalizeCommunityPostStatus(row.status);

  return {
    id: row.id,
    content: row.content,
    status,
    moderationReason: status === ADMIN_CONTENT_POST_STATUS.REJECTED ? row.moderationReason : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Handles authenticated community post submission and author-only reads. */
@Injectable()
export class CommunityPostService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates one text-only post that always enters the pending moderation state. */
  async create(
    authorId: string,
    request: CreateCommunityPostRequest,
  ): Promise<MyCommunityPostListItem> {
    const post = await this.prisma.post.create({
      data: {
        authorId,
        content: request.content.trim(),
        mediaUrls: [],
        tags: [],
        status: ADMIN_CONTENT_POST_STATUS.PENDING,
      },
      select: {
        id: true,
        content: true,
        status: true,
        moderationReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return toMyPost(post);
  }

  /** Returns only the authenticated author's posts, including non-public moderation states. */
  async findMine(
    authorId: string,
    query: MyCommunityPostListQuery,
  ): Promise<MyCommunityPostListResponse> {
    const where = { authorId };
    const [list, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          content: true,
          status: true,
          moderationReason: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      list: list.map(toMyPost),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
