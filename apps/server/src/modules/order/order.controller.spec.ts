import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import type { CreateRewardOrderDto } from "./dto/create-order.dto";
import {
  AdminOrderUserSummaryDto,
  PublicOrderOwnerResponseDto,
  PublicOrderPetResponseDto,
  PublicOrderResponseDto,
} from "./dto/order-response.dto";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

describe("OrderController", () => {
  const orderService = {
    createRewardOrder: jest.fn(),
  };
  const controller = new OrderController(orderService as unknown as OrderService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("creates a reward order for the authenticated owner", async () => {
    const dto: CreateRewardOrderDto = {
      serviceType: "feeding",
      petId: "pet-1",
      serviceTime: "2026-08-24T10:00:00.000Z",
      rewardAmount: 12500,
      address: "测试地址",
    };
    const request = { user: { sub: "user-1" } } as Parameters<
      OrderController["createRewardOrder"]
    >[0];

    await controller.createRewardOrder(request, dto);

    expect(orderService.createRewardOrder).toHaveBeenCalledWith(dto, "user-1");
  });

  it("checks authentication before profile completion on reward creation", () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      OrderController.prototype.createRewardOrder,
    ) as unknown[];

    expect(guards).toEqual([AccessTokenGuard, ProfileCompleteGuard]);
  });

  it("does not gate public order reads", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OrderController.prototype.findAll)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, OrderController.prototype.findOne)).toBeUndefined();
  });

  it("documents only the anonymous order display projection", () => {
    const orderProperties = Reflect.getMetadata(
      "swagger/apiModelPropertiesArray",
      PublicOrderResponseDto.prototype,
    ) as string[];
    const ownerProperties = Reflect.getMetadata(
      "swagger/apiModelPropertiesArray",
      PublicOrderOwnerResponseDto.prototype,
    ) as string[];
    const petProperties = Reflect.getMetadata(
      "swagger/apiModelPropertiesArray",
      PublicOrderPetResponseDto.prototype,
    ) as string[];
    const adminProperties = Reflect.getMetadata(
      "swagger/apiModelPropertiesArray",
      AdminOrderUserSummaryDto.prototype,
    ) as string[];

    expect(orderProperties).toEqual([
      ":id",
      ":orderType",
      ":serviceType",
      ":serviceTime",
      ":amount",
      ":status",
      ":owner",
      ":pet",
    ]);
    expect(ownerProperties).toEqual([":nickname", ":avatar"]);
    expect(petProperties).toEqual([":name", ":breed", ":coverImage"]);
    expect(adminProperties).toEqual(expect.arrayContaining([":phone", ":username"]));
  });
});
