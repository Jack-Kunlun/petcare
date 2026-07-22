import { HttpStatus, Injectable } from "@nestjs/common";
import { ApiException } from "../../common/http/api-exception";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateRewardOrderDto } from "./dto/create-order.dto";

const publicOwnerSelect = {
  id: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
  userType: true,
  status: true,
} as const;

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async createRewardOrder(dto: CreateRewardOrderDto, ownerId: string) {
    const order = await this.prisma.order.create({
      data: {
        orderType: "reward",
        serviceType: dto.serviceType,
        ownerId,
        petId: dto.petId,
        serviceTime: new Date(dto.serviceTime),
        amount: dto.rewardAmount,
        address: dto.address,
        remark: dto.remark,
      },
    });

    return { order };
  }

  async findAll(page = 1, pageSize = 20) {
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.order.count(),
    ]);

    return {
      orders,
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
}
