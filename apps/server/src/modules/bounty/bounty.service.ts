import { HttpStatus, Injectable } from "@nestjs/common";
import {
  BOUNTY_ERROR_CODE,
  BOUNTY_LIMITS,
  BOUNTY_SERVICE_TYPE,
  BOUNTY_STATUS,
  MINIAPP_ACCOUNT_ERROR_CODE,
  type BountyListQuery,
  type BountyServiceType,
  type CreateBountyRequest,
  type MyBounty,
  type MyBountyListResponse,
  type PublicBounty,
  type PublicBountyListResponse,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { lockUserRow } from "../../prisma/user-row-lock";

const privateBountySelect = {
  id: true,
  serviceType: true,
  serviceTime: true,
  amount: true,
  status: true,
  address: true,
  remark: true,
  createdAt: true,
  reward: { select: { expireTime: true } },
  pet: { select: { id: true, name: true, breed: true, photos: true } },
} satisfies Prisma.OrderSelect;

const publicBountySelect = {
  id: true,
  serviceType: true,
  serviceTime: true,
  amount: true,
  status: true,
  reward: { select: { expireTime: true } },
  owner: { select: { nickname: true, avatar: true } },
  pet: { select: { name: true, breed: true, photos: true } },
} satisfies Prisma.OrderSelect;

type PrivateBountyRow = Prisma.OrderGetPayload<{ select: typeof privateBountySelect }>;
type PublicBountyRow = Prisma.OrderGetPayload<{ select: typeof publicBountySelect }>;

/** Owns Cycle 5 bounty creation and privacy-scoped reads. */
@Injectable()
export class BountyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Creates one exact-price bounty for a pet owned by the active authenticated account. */
  async create(ownerId: string, input: CreateBountyRequest): Promise<MyBounty> {
    const normalized = this.normalizeInput(input);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const owner = await lockUserRow(transaction, ownerId);

        if (!owner || owner.status !== "active") {
          throw new ApiException(
            BOUNTY_ERROR_CODE.ACCOUNT_DISABLED,
            "账户已被停用",
            HttpStatus.FORBIDDEN,
          );
        }

        if (!owner.phone) {
          throw new ApiException(
            MINIAPP_ACCOUNT_ERROR_CODE.PROFILE_INCOMPLETE,
            "请先完善手机号",
            HttpStatus.FORBIDDEN,
          );
        }

        const pet = await transaction.pet.findFirst({
          where: { id: normalized.petId, ownerId },
          select: { id: true },
        });

        if (!pet) {
          throw this.notFound();
        }

        const expiresAt = new Date(
          Math.min(Date.now() + this.config.orderTimeoutDelayMs, normalized.serviceTime.getTime()),
        );
        const order = await transaction.order.create({
          data: {
            orderType: "reward",
            serviceType: normalized.serviceType,
            ownerId,
            petId: normalized.petId,
            serviceTime: normalized.serviceTime,
            amount: normalized.amountCents,
            address: normalized.address,
            remark: normalized.remark,
            status: BOUNTY_STATUS.OPEN,
            reward: {
              create: {
                rewardAmount: normalized.amountCents,
                priceRangeMin: normalized.amountCents,
                priceRangeMax: normalized.amountCents,
                expireTime: expiresAt,
              },
            },
          },
          select: privateBountySelect,
        });

        return this.toMyBounty(order);
      });
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      if (this.isPrismaError(error, "P2003")) {
        throw this.notFound();
      }

      throw new ApiException(
        BOUNTY_ERROR_CODE.CREATION_FAILED,
        "悬赏发布失败，请稍后重试",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Lists only bounties created by the authenticated owner, including private fields. */
  async findMine(ownerId: string, query: BountyListQuery): Promise<MyBountyListResponse> {
    const where = { orderType: "reward", ownerId, reward: { isNot: null } } as const;
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: privateBountySelect,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      list: list.map((order) => this.toMyBounty(order)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Lists only open, unexpired bounties through an anonymous-safe projection. */
  async findPublic(query: BountyListQuery): Promise<PublicBountyListResponse> {
    const where = this.publicWhere();
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: publicBountySelect,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      list: list.map((order) => this.toPublicBounty(order)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Returns one discoverable bounty without revealing private fields or hidden records. */
  async findPublicById(id: string): Promise<PublicBounty> {
    const order = await this.prisma.order.findFirst({
      where: { id, ...this.publicWhere() },
      select: publicBountySelect,
    });

    if (!order) {
      throw this.notFound();
    }

    return this.toPublicBounty(order);
  }

  private publicWhere(): Prisma.OrderWhereInput {
    return {
      orderType: "reward",
      status: BOUNTY_STATUS.OPEN,
      owner: { is: { status: "active" } },
      reward: { is: { expireTime: { gt: new Date() } } },
    };
  }

  private normalizeInput(input: CreateBountyRequest): {
    petId: string;
    serviceType: BountyServiceType;
    serviceTime: Date;
    amountCents: number;
    address: string;
    remark: string | null;
  } {
    const serviceTypes: readonly string[] = Object.values(BOUNTY_SERVICE_TYPE);
    const serviceTime = new Date(input.serviceTime);
    const address = typeof input.address === "string" ? input.address.trim() : "";
    const remark = typeof input.remark === "string" ? input.remark.trim() || null : null;

    if (!serviceTypes.includes(input.serviceType)) {
      throw this.validationFailed("服务类型无效");
    }

    if (!Number.isFinite(serviceTime.getTime()) || serviceTime.getTime() <= Date.now()) {
      throw this.validationFailed("服务时间必须晚于当前时间");
    }

    if (
      !Number.isInteger(input.amountCents) ||
      input.amountCents < BOUNTY_LIMITS.AMOUNT_MIN_CENTS ||
      input.amountCents > BOUNTY_LIMITS.AMOUNT_MAX_CENTS
    ) {
      throw this.validationFailed("悬赏金额超出允许范围");
    }

    if (!address || address.length > BOUNTY_LIMITS.ADDRESS_MAX_LENGTH || /\p{Cc}/u.test(address)) {
      throw this.validationFailed("服务地址无效");
    }

    if (remark && (remark.length > BOUNTY_LIMITS.REMARK_MAX_LENGTH || /\p{Cc}/u.test(remark))) {
      throw this.validationFailed("备注无效");
    }

    return {
      petId: input.petId,
      serviceType: input.serviceType,
      serviceTime,
      amountCents: input.amountCents,
      address,
      remark,
    };
  }

  private toMyBounty(order: PrivateBountyRow): MyBounty {
    if (!order.reward) {
      throw this.notFound();
    }

    return {
      id: order.id,
      serviceType: order.serviceType as BountyServiceType,
      serviceTime: order.serviceTime.toISOString(),
      amountCents: order.amount,
      status: order.status,
      address: order.address,
      remark: order.remark,
      expiresAt: order.reward.expireTime.toISOString(),
      createdAt: order.createdAt.toISOString(),
      pet: {
        id: order.pet.id,
        name: order.pet.name,
        breed: order.pet.breed,
        coverImage: order.pet.photos[0] ?? null,
      },
    };
  }

  private toPublicBounty(order: PublicBountyRow): PublicBounty {
    if (!order.reward) {
      throw this.notFound();
    }

    return {
      id: order.id,
      serviceType: order.serviceType as BountyServiceType,
      serviceTime: order.serviceTime.toISOString(),
      amountCents: order.amount,
      status: BOUNTY_STATUS.OPEN,
      expiresAt: order.reward.expireTime.toISOString(),
      owner: { nickname: order.owner.nickname, avatar: order.owner.avatar },
      pet: {
        name: order.pet.name,
        breed: order.pet.breed,
        coverImage: order.pet.photos[0] ?? null,
      },
    };
  }

  private notFound(): ApiException {
    return new ApiException(BOUNTY_ERROR_CODE.NOT_FOUND, "悬赏不存在", HttpStatus.NOT_FOUND);
  }

  private validationFailed(message: string): ApiException {
    return new ApiException(BOUNTY_ERROR_CODE.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST);
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
  }
}
