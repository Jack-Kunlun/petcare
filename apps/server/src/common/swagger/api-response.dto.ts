import { ApiProperty } from "@nestjs/swagger";

export class ApiResponseMetaDto {
  @ApiProperty({ example: "request-123" })
  requestId: string;

  @ApiProperty({ format: "date-time", example: "2026-07-22T14:00:00.000Z" })
  timestamp: string;
}

export class ApiResponseEnvelopeDto {
  @ApiProperty({ example: "SUCCESS" })
  code: string;

  @ApiProperty({ example: "操作成功" })
  message: string;

  @ApiProperty({ nullable: true })
  data: unknown;

  @ApiProperty({ type: ApiResponseMetaDto })
  meta: ApiResponseMetaDto;
}

export class ApiErrorResponseDto extends ApiResponseEnvelopeDto {
  @ApiProperty({ example: "AUTH_INVALID_CREDENTIALS" })
  declare code: string;

  @ApiProperty({ nullable: true, example: null })
  declare data: null;
}
