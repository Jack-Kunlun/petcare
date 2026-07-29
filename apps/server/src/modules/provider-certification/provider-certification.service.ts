import { HttpStatus, Injectable } from "@nestjs/common";
import {
  PROVIDER_CERTIFICATION_STATUS,
  type AdminProviderCertificationDetail,
  type AdminProviderCertificationListItem,
  type AdminProviderCertificationListQuery,
  type AdminProviderCertificationListResponse,
} from "@petcare/shared-types";
import { ApiException } from "../../common/http/api-exception";
import { PrismaService } from "../../prisma/prisma.service";

const applicantSelect = {
  id: true,
  phone: true,
  username: true,
  nickname: true,
  avatar: true,
} as const;

const reviewerSelect = {
  id: true,
  nickname: true,
} as const;

const certificationDetailSelect = {
  id: true,
  realNameMasked: true,
  idCardMasked: true,
  idCardFrontUrl: true,
  idCardBackUrl: true,
  wechatScore: true,
  trainingPassed: true,
  status: true,
  rejectReason: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  applicant: { select: applicantSelect },
  reviewedBy: { select: reviewerSelect },
} as const;

type CertificationRecord = {
  id: string;
  realNameMasked: string;
  idCardMasked?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
  wechatScore: number | null;
  trainingPassed: boolean;
  status: string;
  rejectReason?: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt?: Date;
  applicant: {
    id: string;
    phone: string;
    username: string | null;
    nickname: string;
    avatar: string | null;
  };
  reviewedBy?: { id: string; nickname: string } | null;
};

@Injectable()
export class ProviderCertificationService {
  constructor(private readonly prisma: PrismaService) {}

  /** 按后台筛选条件分页查询认证申请。 */
  async findAdminPage(
    query: AdminProviderCertificationListQuery,
  ): Promise<AdminProviderCertificationListResponse> {
    const keyword = query.keyword?.trim();
    const filters: object[] = [];

    if (keyword) {
      filters.push({
        applicant: {
          OR: [
            { phone: { contains: keyword } },
            { username: { contains: keyword, mode: "insensitive" } },
            { nickname: { contains: keyword, mode: "insensitive" } },
          ],
        },
      });
    }

    if (query.status) {
      filters.push({ status: query.status });
    }

    const where = filters.length > 0 ? { AND: filters } : {};
    const [records, total] = await Promise.all([
      this.prisma.providerCertificationApplication.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ reviewedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
        select: {
          id: true,
          realNameMasked: true,
          idCardMasked: true,
          wechatScore: true,
          trainingPassed: true,
          status: true,
          reviewedAt: true,
          createdAt: true,
          applicant: { select: applicantSelect },
        },
      }),
      this.prisma.providerCertificationApplication.count({ where }),
    ]);

    return {
      list: records.map((record) => this.toListItem(record)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** 查询单个认证申请的安全审核详情。 */
  async findAdminDetail(id: string): Promise<AdminProviderCertificationDetail> {
    const record = await this.prisma.providerCertificationApplication.findUnique({
      where: { id },
      select: certificationDetailSelect,
    });

    if (!record) {
      throw new ApiException("RESOURCE_NOT_FOUND", "认证申请不存在", HttpStatus.NOT_FOUND);
    }

    return this.toDetail(record);
  }

  /** 审核通过认证申请，并在同一事务中更新宠托师当前认证状态。 */
  async approve(id: string, reviewerId: string): Promise<AdminProviderCertificationDetail> {
    return this.prisma.$transaction(async (transaction) => {
      const application = await transaction.providerCertificationApplication.findUnique({
        where: { id },
        select: {
          applicantId: true,
          wechatScore: true,
          trainingPassed: true,
        },
      });

      if (!application) {
        throw new ApiException("RESOURCE_NOT_FOUND", "认证申请不存在", HttpStatus.NOT_FOUND);
      }

      const updated = await transaction.providerCertificationApplication.updateMany({
        where: { id, status: PROVIDER_CERTIFICATION_STATUS.PENDING },
        data: {
          status: PROVIDER_CERTIFICATION_STATUS.APPROVED,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          rejectReason: null,
        },
      });

      if (updated.count === 0) {
        throw new ApiException("REVIEW_CONFLICT", "该申请已被处理", HttpStatus.CONFLICT);
      }

      await transaction.provider.upsert({
        where: { userId: application.applicantId },
        update: {
          idCardVerified: true,
          trainingPassed: application.trainingPassed,
          certifiedSitter: true,
          wechatScore: application.wechatScore,
        },
        create: {
          userId: application.applicantId,
          idCardVerified: true,
          trainingPassed: application.trainingPassed,
          certifiedSitter: true,
          wechatScore: application.wechatScore,
        },
      });

      const result = await transaction.providerCertificationApplication.findUniqueOrThrow({
        where: { id },
        select: certificationDetailSelect,
      });

      return this.toDetail(result);
    });
  }

  /** 驳回待审核认证申请并记录原因与审核管理员。 */
  async reject(
    id: string,
    reviewerId: string,
    reason: string,
  ): Promise<AdminProviderCertificationDetail> {
    return this.prisma.$transaction(async (transaction) => {
      const application = await transaction.providerCertificationApplication.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!application) {
        throw new ApiException("RESOURCE_NOT_FOUND", "认证申请不存在", HttpStatus.NOT_FOUND);
      }

      const updated = await transaction.providerCertificationApplication.updateMany({
        where: { id, status: PROVIDER_CERTIFICATION_STATUS.PENDING },
        data: {
          status: PROVIDER_CERTIFICATION_STATUS.REJECTED,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          rejectReason: reason.trim(),
        },
      });

      if (updated.count === 0) {
        throw new ApiException("REVIEW_CONFLICT", "该申请已被处理", HttpStatus.CONFLICT);
      }

      const result = await transaction.providerCertificationApplication.findUniqueOrThrow({
        where: { id },
        select: certificationDetailSelect,
      });

      return this.toDetail(result);
    });
  }

  /** 将数据库记录转换为公开列表契约。 */
  private toListItem(record: CertificationRecord): AdminProviderCertificationListItem {
    return {
      id: record.id,
      applicant: record.applicant,
      realNameMasked: record.realNameMasked,
      idCardVerified: Boolean(record.idCardMasked),
      trainingPassed: record.trainingPassed,
      wechatScore: record.wechatScore,
      status: record.status as AdminProviderCertificationListItem["status"],
      createdAt: record.createdAt.toISOString(),
      reviewedAt: record.reviewedAt?.toISOString() ?? null,
    };
  }

  /** 将数据库记录转换为脱敏的审核详情契约。 */
  private toDetail(record: CertificationRecord): AdminProviderCertificationDetail {
    return {
      ...this.toListItem(record),
      idCardMasked: record.idCardMasked ?? "",
      idCardFrontUrl: record.idCardFrontUrl ?? "",
      idCardBackUrl: record.idCardBackUrl ?? "",
      rejectReason: record.rejectReason ?? null,
      reviewedBy: record.reviewedBy ?? null,
      updatedAt: record.updatedAt?.toISOString() ?? record.createdAt.toISOString(),
    };
  }
}
