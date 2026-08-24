import { ApiProperty } from "@nestjs/swagger";
import type {
  AdminProviderCertificationDetail,
  AdminProviderCertificationListItem,
  AdminProviderCertificationListResponse,
  ProviderCertificationApplicantSummary,
  ProviderCertificationReviewerSummary,
  ProviderCertificationStatus,
} from "@petcare/shared-types";

export class ProviderCertificationApplicantSummaryDto implements ProviderCertificationApplicantSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ nullable: true, example: "13800138000" })
  phone: string | null;

  @ApiProperty({ nullable: true })
  username: string | null;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ nullable: true })
  avatar: string | null;
}

export class ProviderCertificationReviewerSummaryDto implements ProviderCertificationReviewerSummary {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty()
  nickname: string;
}

export class AdminProviderCertificationListItemDto implements AdminProviderCertificationListItem {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ type: ProviderCertificationApplicantSummaryDto })
  applicant: ProviderCertificationApplicantSummaryDto;

  @ApiProperty({ example: "张*" })
  realNameMasked: string;

  @ApiProperty()
  idCardVerified: boolean;

  @ApiProperty()
  trainingPassed: boolean;

  @ApiProperty({ nullable: true, example: 680 })
  wechatScore: number | null;

  @ApiProperty({ enum: ["pending", "approved", "rejected"] })
  status: ProviderCertificationStatus;

  @ApiProperty({ format: "date-time" })
  createdAt: string;

  @ApiProperty({ format: "date-time", nullable: true })
  reviewedAt: string | null;
}

export class AdminProviderCertificationListResponseDto implements AdminProviderCertificationListResponse {
  @ApiProperty({ type: [AdminProviderCertificationListItemDto] })
  list: AdminProviderCertificationListItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class AdminProviderCertificationDetailDto
  extends AdminProviderCertificationListItemDto
  implements AdminProviderCertificationDetail
{
  @ApiProperty({ example: "3601********1234" })
  idCardMasked: string;

  @ApiProperty()
  idCardFrontUrl: string;

  @ApiProperty()
  idCardBackUrl: string;

  @ApiProperty({ nullable: true })
  rejectReason: string | null;

  @ApiProperty({ type: ProviderCertificationReviewerSummaryDto, nullable: true })
  reviewedBy: ProviderCertificationReviewerSummaryDto | null;

  @ApiProperty({ format: "date-time" })
  updatedAt: string;
}
