// apps/api/src/modules/order/order.service.ts

import { Injectable } from "@nestjs/common";
import { ConfigService } from "../../config/config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateRewardOrderDto } from "./dto/create-order.dto";

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

    // 可以使用ConfigService获取API配置等（用于后续功能扩展）
    // const apiBaseUrl = this.configService.apiBaseUrl;

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
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        owner: true,
        pet: true,
      },
    });
  }
}
