import { HttpStatus, Injectable } from "@nestjs/common";
import {
  BOUNTY_ERROR_CODE,
  BOUNTY_INTENT_STATUS,
  BOUNTY_LIMITS,
  BOUNTY_SERVICE_TYPE,
  BOUNTY_STATUS,
  MINIAPP_ACCOUNT_ERROR_CODE,
  type BountyIntentStatus,
  type BountyListQuery,
  type BountyProviderEligibility,
  type BountyServiceType,
  type BountyStatus,
  type CreateBountyRequest,
  type MyBounty,
  type MyBountyIntent,
  type MyBountyIntentListResponse,
  type MyBountyListResponse,
  type OwnerBountyIntent,
  type OwnerBountyIntentListResponse,
  type PublicBounty,
  type PublicBountyListResponse,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { lockUserRow } from "../../prisma/user-row-lock";

const providerSummarySelect = {
  id: true,
  nickname: true,
  avatar: true,
} satisfies Prisma.UserSelect;

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
  provider: { select: providerSummarySelect },
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

const ownerIntentSelect = {
  id: true,
  intentStatus: true,
  createdAt: true,
  provider: { select: providerSummarySelect },
} satisfies Prisma.OrderIntentSelect;

const intentBountySelect = {
  id: true,
  serviceType: true,
  serviceTime: true,
  amount: true,
  status: true,
  address: true,
  remark: true,
  providerId: true,
  reward: { select: { expireTime: true } },
  owner: { select: { nickname: true, avatar: true } },
  pet: { select: { name: true, breed: true, photos: true } },
} satisfies Prisma.OrderSelect;

const myIntentSelect = {
  id: true,
  intentStatus: true,
  createdAt: true,
  order: { select: intentBountySelect },
} satisfies Prisma.OrderIntentSelect;

const providerEligibilitySelect = {
  phone: true,
  status: true,
  userType: true,
  provider: {
    select: {
      idCardVerified: true,
      trainingPassed: true,
      certifiedSitter: true,
    },
  },
} satisfies Prisma.UserSelect;

type PrivateBountyRow = Prisma.OrderGetPayload<{ select: typeof privateBountySelect }>;
type PublicBountyRow = Prisma.OrderGetPayload<{ select: typeof publicBountySelect }>;
type OwnerIntentRow = Prisma.OrderIntentGetPayload<{ select: typeof ownerIntentSelect }>;
type MyIntentRow = Prisma.OrderIntentGetPayload<{ select: typeof myIntentSelect }>;
type ProviderEligibilityRow = Prisma.UserGetPayload<{ select: typeof providerEligibilitySelect }>;

interface LockedBountyRow {
  id: string;
  ownerId: string;
  providerId: string | null;
  status: string;
  expiresAt: Date;
}

/** Owns default-closed bounty creation, qualification, intent, and confirmation state. */
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

  /** Reports whether the current account passes every persisted provider gate. */
  async getProviderEligibility(userId: string): Promise<BountyProviderEligibility> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: providerEligibilitySelect,
    });

    return { eligible: this.isEligibleProvider(user) };
  }

  /** Creates or returns the provider's single intent for one open bounty. */
  async submitIntent(providerId: string, bountyId: string): Promise<MyBountyIntent> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const bounty = await this.lockBounty(transaction, bountyId);

        if (!bounty) {
          throw this.notFound();
        }

        if (bounty.ownerId === providerId) {
          throw new ApiException(
            BOUNTY_ERROR_CODE.OWN_BOUNTY_FORBIDDEN,
            "不能接取自己发布的悬赏",
            HttpStatus.FORBIDDEN,
          );
        }

        if (
          bounty.status !== BOUNTY_STATUS.OPEN ||
          bounty.providerId !== null ||
          bounty.expiresAt.getTime() <= Date.now()
        ) {
          throw this.notOpen();
        }

        if (!(await this.lockEligibleProvider(transaction, providerId))) {
          throw this.providerNotEligible();
        }

        const intent = await transaction.orderIntent.upsert({
          where: { orderId_providerId: { orderId: bountyId, providerId } },
          update: {},
          create: {
            orderId: bountyId,
            providerId,
            intentStatus: BOUNTY_INTENT_STATUS.PENDING,
          },
          select: myIntentSelect,
        });

        return this.toMyIntent(intent, providerId);
      });
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      if (this.isPrismaError(error, "P2003")) {
        throw this.notFound();
      }

      throw new ApiException(
        BOUNTY_ERROR_CODE.INTENT_FAILED,
        "接单意向提交失败，请稍后重试",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Lists all intents submitted by the authenticated provider without leaking private fields. */
  async findMyIntents(
    providerId: string,
    query: BountyListQuery,
  ): Promise<MyBountyIntentListResponse> {
    const where = {
      providerId,
      order: { is: { orderType: "reward", reward: { isNot: null } } },
    } as const;
    const [list, total] = await Promise.all([
      this.prisma.orderIntent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: myIntentSelect,
      }),
      this.prisma.orderIntent.count({ where }),
    ]);

    return {
      list: list.map((intent) => this.toMyIntent(intent, providerId)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Lists provider candidates only when the authenticated account owns the bounty. */
  async findOwnerIntents(
    ownerId: string,
    bountyId: string,
    query: BountyListQuery,
  ): Promise<OwnerBountyIntentListResponse> {
    const bounty = await this.prisma.order.findFirst({
      where: { id: bountyId, ownerId, orderType: "reward", reward: { isNot: null } },
      select: { id: true },
    });

    if (!bounty) {
      throw this.notFound();
    }

    const where = { orderId: bountyId } as const;
    const [list, total] = await Promise.all([
      this.prisma.orderIntent.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: ownerIntentSelect,
      }),
      this.prisma.orderIntent.count({ where }),
    ]);

    return {
      list: list.map((intent) => this.toOwnerIntent(intent)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Confirms exactly one currently eligible provider and rejects every competing pending intent. */
  async confirmIntent(ownerId: string, bountyId: string, intentId: string): Promise<MyBounty> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const bounty = await this.lockBounty(transaction, bountyId);

        if (!bounty || bounty.ownerId !== ownerId) {
          throw this.notFound();
        }

        const intent = await transaction.orderIntent.findFirst({
          where: { id: intentId, orderId: bountyId },
          select: { id: true, providerId: true, intentStatus: true },
        });

        if (!intent) {
          throw this.notFound();
        }

        if (bounty.providerId !== null) {
          if (
            bounty.providerId === intent.providerId &&
            intent.intentStatus === BOUNTY_INTENT_STATUS.CONFIRMED
          ) {
            return this.findLockedPrivateBounty(transaction, bountyId, ownerId);
          }

          throw this.confirmationConflict();
        }

        if (
          bounty.status !== BOUNTY_STATUS.OPEN ||
          bounty.expiresAt.getTime() <= Date.now() ||
          intent.intentStatus !== BOUNTY_INTENT_STATUS.PENDING
        ) {
          throw this.notOpen();
        }

        if (!(await this.lockEligibleProvider(transaction, intent.providerId))) {
          throw this.providerNotEligible("该服务者当前不满足接单资格", HttpStatus.CONFLICT);
        }

        const claimed = await transaction.order.updateMany({
          where: {
            id: bountyId,
            ownerId,
            orderType: "reward",
            status: BOUNTY_STATUS.OPEN,
            providerId: null,
          },
          data: { providerId: intent.providerId, status: BOUNTY_STATUS.CONFIRMED },
        });

        if (claimed.count !== 1) {
          throw this.confirmationConflict();
        }

        await transaction.orderIntent.update({
          where: { id: intent.id },
          data: { intentStatus: BOUNTY_INTENT_STATUS.CONFIRMED },
        });
        await transaction.orderIntent.updateMany({
          where: {
            orderId: bountyId,
            id: { not: intent.id },
            intentStatus: BOUNTY_INTENT_STATUS.PENDING,
          },
          data: { intentStatus: BOUNTY_INTENT_STATUS.REJECTED },
        });

        return this.findLockedPrivateBounty(transaction, bountyId, ownerId);
      });
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      throw new ApiException(
        BOUNTY_ERROR_CODE.CONFIRMATION_FAILED,
        "服务者确认失败，请稍后重试",
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

  private async lockBounty(
    transaction: Pick<Prisma.TransactionClient, "$queryRaw">,
    bountyId: string,
  ): Promise<LockedBountyRow | null> {
    const rows = await transaction.$queryRaw<LockedBountyRow[]>`
      SELECT
        o."id",
        o."owner_id" AS "ownerId",
        o."provider_id" AS "providerId",
        o."status",
        r."expire_time" AS "expiresAt"
      FROM "orders" o
      INNER JOIN "order_rewards" r ON r."order_id" = o."id"
      WHERE o."id" = ${bountyId} AND o."order_type" = 'reward'
      FOR UPDATE OF o, r
    `;

    return rows[0] ?? null;
  }

  private async lockEligibleProvider(
    transaction: Pick<Prisma.TransactionClient, "$queryRaw">,
    providerId: string,
  ): Promise<boolean> {
    const rows = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT u."id"
      FROM "users" u
      INNER JOIN "providers" p ON p."user_id" = u."id"
      WHERE
        u."id" = ${providerId}
        AND u."status" = 'active'
        AND u."phone" IS NOT NULL
        AND BTRIM(u."phone") <> ''
        AND u."user_type" = 'provider'
        AND p."id_card_verified" = TRUE
        AND p."training_passed" = TRUE
        AND p."certified_sitter" = TRUE
      FOR SHARE OF u, p
    `;

    return rows.length === 1;
  }

  private isEligibleProvider(user: ProviderEligibilityRow | null): boolean {
    return Boolean(
      user &&
      user.status === "active" &&
      user.phone &&
      user.userType === "provider" &&
      user.provider?.idCardVerified &&
      user.provider.trainingPassed &&
      user.provider.certifiedSitter,
    );
  }

  private async findLockedPrivateBounty(
    transaction: Pick<Prisma.TransactionClient, "order">,
    bountyId: string,
    ownerId: string,
  ): Promise<MyBounty> {
    const order = await transaction.order.findFirst({
      where: { id: bountyId, ownerId, orderType: "reward", reward: { isNot: null } },
      select: privateBountySelect,
    });

    if (!order) {
      throw this.notFound();
    }

    return this.toMyBounty(order);
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
      status: order.status as BountyStatus,
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
      provider: order.provider
        ? {
            id: order.provider.id,
            nickname: order.provider.nickname,
            avatar: order.provider.avatar,
          }
        : null,
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

  private toOwnerIntent(intent: OwnerIntentRow): OwnerBountyIntent {
    return {
      id: intent.id,
      status: intent.intentStatus as BountyIntentStatus,
      createdAt: intent.createdAt.toISOString(),
      provider: {
        id: intent.provider.id,
        nickname: intent.provider.nickname,
        avatar: intent.provider.avatar,
      },
    };
  }

  private toMyIntent(intent: MyIntentRow, providerId: string): MyBountyIntent {
    if (!intent.order.reward) {
      throw this.notFound();
    }

    const privateFieldsVisible =
      intent.intentStatus === BOUNTY_INTENT_STATUS.CONFIRMED &&
      intent.order.providerId === providerId;

    return {
      id: intent.id,
      status: intent.intentStatus as BountyIntentStatus,
      createdAt: intent.createdAt.toISOString(),
      bounty: {
        id: intent.order.id,
        serviceType: intent.order.serviceType as BountyServiceType,
        serviceTime: intent.order.serviceTime.toISOString(),
        amountCents: intent.order.amount,
        status: intent.order.status as BountyStatus,
        expiresAt: intent.order.reward.expireTime.toISOString(),
        owner: {
          nickname: intent.order.owner.nickname,
          avatar: intent.order.owner.avatar,
        },
        pet: {
          name: intent.order.pet.name,
          breed: intent.order.pet.breed,
          coverImage: intent.order.pet.photos[0] ?? null,
        },
        address: privateFieldsVisible ? intent.order.address : null,
        remark: privateFieldsVisible ? intent.order.remark : null,
      },
    };
  }

  private notFound(): ApiException {
    return new ApiException(BOUNTY_ERROR_CODE.NOT_FOUND, "悬赏不存在", HttpStatus.NOT_FOUND);
  }

  private notOpen(): ApiException {
    return new ApiException(BOUNTY_ERROR_CODE.NOT_OPEN, "悬赏已停止接单", HttpStatus.CONFLICT);
  }

  private providerNotEligible(
    message = "当前账号尚未满足接单资格",
    status = HttpStatus.FORBIDDEN,
  ): ApiException {
    return new ApiException(BOUNTY_ERROR_CODE.PROVIDER_NOT_ELIGIBLE, message, status);
  }

  private confirmationConflict(): ApiException {
    return new ApiException(
      BOUNTY_ERROR_CODE.CONFIRMATION_CONFLICT,
      "该悬赏已确认其他服务者",
      HttpStatus.CONFLICT,
    );
  }

  private validationFailed(message: string): ApiException {
    return new ApiException(BOUNTY_ERROR_CODE.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST);
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
  }
}
