import { HttpStatus, Injectable } from "@nestjs/common";
import { AdminServiceType } from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AdminOrderListQueryDto } from "./dto/admin-order-list-query.dto";
import { CreateRewardOrderDto } from "./dto/create-order.dto";
import { OrderConfigSnapshotService } from "./order-config-snapshot.service";

const publicOwnerSelect = {
  id: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
  userType: true,
  status: true,
} as const;

const adminOrderRelations = {
  owner: { select: publicOwnerSelect },
  provider: { select: publicOwnerSelect },
  pet: {
    select: {
      id: true,
      name: true,
      breed: true,
    },
  },
} as const;

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private readonly snapshots: OrderConfigSnapshotService,
  ) {}

  /** 在同一事务内创建悬赏订单及其 SOP、费用不可变快照。 */
  async createRewardOrder(dto: CreateRewardOrderDto, ownerId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const snapshot = await this.snapshots.createForOrder(
          dto.serviceType as AdminServiceType,
          dto.rewardAmount,
          tx,
        );
        const order = await tx.order.create({
          data: {
            orderType: "reward",
            serviceType: dto.serviceType,
            ownerId,
            petId: dto.petId,
            serviceTime: new Date(dto.serviceTime),
            amount: dto.rewardAmount,
            address: dto.address,
            remark: dto.remark,
            sopConfigVersionId: snapshot.sopConfigVersionId,
            feeConfigVersionId: snapshot.feeConfigVersionId,
          },
        });

        await tx.orderSop.createMany({
          data: snapshot.sops.map((step) => ({ orderId: order.id, ...step })),
        });
        await tx.orderFeeSnapshot.create({
          data: {
            orderId: order.id,
            feeConfigVersionId: snapshot.fee.feeConfigVersionId,
            inputAmountCents: snapshot.fee.inputAmountCents,
            platformCommissionBps: snapshot.fee.platformCommissionBps,
            platformCommissionCents: snapshot.fee.commissionAmountCents,
            rewardServiceFeeCents: snapshot.fee.rewardServiceFeeCents,
            withdrawalFeeBps: snapshot.fee.withdrawalFeeBps,
            minimumWithdrawalFeeCents: snapshot.fee.minimumWithdrawalFeeCents,
            providerSettlementCents: snapshot.fee.providerSettlementCents,
          },
        });

        return { order };
      });
    } catch (error) {
      if (error instanceof ApiException) {
        throw error;
      }

      throw new ApiException(
        "ORDER_CREATION_FAILED",
        "订单创建失败",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(page = 1, pageSize = 20) {
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count(),
    ]);

    return {
      list,
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        owner: { select: publicOwnerSelect },
        pet: true,
      },
    });

    if (!order) {
      throw new ApiException("RESOURCE_NOT_FOUND", "订单不存在", HttpStatus.NOT_FOUND);
    }

    return order;
  }

  /** 根据后台筛选条件查询订单及关联用户、宠物摘要。 */
  async findAdminPage(query: AdminOrderListQueryDto) {
    const keyword = query.keyword?.trim();
    const filters: object[] = [];

    if (keyword) {
      filters.push({
        OR: [
          { id: { contains: keyword, mode: "insensitive" } },
          { owner: { phone: { contains: keyword } } },
          { owner: { nickname: { contains: keyword, mode: "insensitive" } } },
          { pet: { name: { contains: keyword, mode: "insensitive" } } },
        ],
      });
    }

    if (query.orderType) {
      filters.push({ orderType: query.orderType });
    }

    if (query.serviceType) {
      filters.push({ serviceType: query.serviceType });
    }

    if (query.status) {
      filters.push({ status: query.status });
    }

    const where = filters.length > 0 ? { AND: filters } : {};
    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: adminOrderRelations,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      list,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
