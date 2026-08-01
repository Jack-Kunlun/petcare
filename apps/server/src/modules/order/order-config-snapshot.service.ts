import { Injectable } from "@nestjs/common";
import { AdminServiceType, FeeConfig, SopConfig } from "@petcare/shared-types";
import { PrismaTransaction } from "../system-settings/publishing/config-domain.adapter";
import { SystemSettingsOverviewService } from "../system-settings/system-settings-overview.service";
import { systemConfigNotFound } from "../system-settings/system-settings.errors";

/** 订单创建时冻结的单个 SOP 步骤。 */
export interface OrderSopSnapshotInput {
  /** 服务类型内从一开始的步骤序号。 */
  stepNumber: number;
  /** 下单时冻结的步骤名称。 */
  stepName: string;
  /** 下单时冻结的完整执行说明。 */
  instruction: string;
  /** 下单时冻结的预计执行时长，单位为分钟。 */
  expectedDurationMinutes: number;
  /** 下单时冻结的最少照片数量。 */
  minimumPhotoCount: number;
  /** 下单时冻结的视频必传要求。 */
  videoRequired: boolean;
  /** 下单时冻结并序列化保存的结构化违规指引。 */
  violationGuidance: string;
  /** 新订单尚未上传的步骤照片。 */
  photos: string[];
  /** 新订单尚未上传的步骤视频。 */
  videos: string[];
}

/** 订单创建时冻结的整数费用计算结果。 */
export interface OrderFeeSnapshotInput {
  /** 费用配置版本唯一标识。 */
  feeConfigVersionId: string;
  /** 本次费用计算的订单输入金额，单位为分。 */
  inputAmountCents: number;
  /** 平台佣金比例，使用整数万分比。 */
  platformCommissionBps: number;
  /** 按输入金额四舍五入计算的平台佣金，单位为分。 */
  commissionAmountCents: number;
  /** 悬赏订单固定服务费，单位为分。 */
  rewardServiceFeeCents: number;
  /** 提现手续费比例，使用整数万分比。 */
  withdrawalFeeBps: number;
  /** 最低提现手续费，单位为分。 */
  minimumWithdrawalFeeCents: number;
  /** 扣除订单平台费用后的服务者结算金额，单位为分。 */
  providerSettlementCents: number;
}

/** 与订单一同创建的不可变配置快照输入。 */
export interface OrderConfigSnapshotInput {
  /** 当前发布 SOP 配置版本唯一标识。 */
  sopConfigVersionId: string;
  /** 当前发布费用配置版本唯一标识。 */
  feeConfigVersionId: string;
  /** 当前发布 SOP 的完整步骤副本。 */
  sops: OrderSopSnapshotInput[];
  /** 当前发布费率对订单金额的计算副本。 */
  fee: OrderFeeSnapshotInput;
}

/** 使用发布指针和领域适配器准备订单不可变配置快照。 */
@Injectable()
export class OrderConfigSnapshotService {
  /** 创建订单快照服务。 */
  constructor(private readonly settings: SystemSettingsOverviewService) {}

  /**
   * 在调用方事务内读取当前发布配置并准备嵌套创建数据。
   *
   * @param serviceType 订单服务类型。
   * @param amountCents 订单金额，单位为分。
   * @param tx 创建订单时使用的同一个 Prisma 事务客户端。
   */
  async createForOrder(
    serviceType: AdminServiceType,
    amountCents: number,
    tx: PrismaTransaction,
  ): Promise<OrderConfigSnapshotInput> {
    const [sopVersion, feeVersion] = await Promise.all([
      this.settings.getCurrent<SopConfig>(`sop:${serviceType}`, tx),
      this.settings.getCurrent<FeeConfig>("fee", tx),
    ]);

    if (!sopVersion || !feeVersion) {
      throw systemConfigNotFound();
    }

    const commissionAmountCents = Math.round(
      (amountCents * feeVersion.config.platformCommissionBps) / 10000,
    );
    const violationGuidance = JSON.stringify(sopVersion.config.violationRules);

    return {
      sopConfigVersionId: sopVersion.id,
      feeConfigVersionId: feeVersion.id,
      sops: sopVersion.config.steps.map((step) => ({
        ...step,
        violationGuidance,
        photos: [],
        videos: [],
      })),
      fee: {
        feeConfigVersionId: feeVersion.id,
        inputAmountCents: amountCents,
        platformCommissionBps: feeVersion.config.platformCommissionBps,
        commissionAmountCents,
        rewardServiceFeeCents: feeVersion.config.rewardServiceFeeCents,
        withdrawalFeeBps: feeVersion.config.withdrawalFeeBps,
        minimumWithdrawalFeeCents: feeVersion.config.minimumWithdrawalFeeCents,
        providerSettlementCents:
          amountCents - commissionAmountCents - feeVersion.config.rewardServiceFeeCents,
      },
    };
  }
}
