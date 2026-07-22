import { applyDecorators, Type } from "@nestjs/common";
import { ApiExtraModels, ApiResponse, getSchemaPath } from "@nestjs/swagger";
import {
  ApiErrorResponseDto,
  ApiResponseEnvelopeDto,
  ApiResponseMetaDto,
} from "./api-response.dto";

const errorDescriptions: Record<number, string> = {
  400: "请求参数错误",
  401: "登录状态无效",
  403: "无权执行此操作",
  404: "资源不存在",
  429: "请求过于频繁",
  500: "服务内部错误",
};

interface ApiSuccessResponseOptions {
  status?: number;
  description?: string;
  isArray?: boolean;
}

export function ApiSuccessResponse(
  model: Type<unknown>,
  options: ApiSuccessResponseOptions = {},
): MethodDecorator {
  const dataSchema = options.isArray
    ? { type: "array", items: { $ref: getSchemaPath(model) } }
    : { $ref: getSchemaPath(model) };

  return applyDecorators(
    ApiExtraModels(ApiResponseEnvelopeDto, ApiResponseMetaDto, model),
    ApiResponse({
      status: options.status ?? 200,
      description: options.description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(ApiResponseEnvelopeDto) },
          { properties: { data: dataSchema } },
        ],
      },
    }),
  );
}

export function ApiStandardErrors(...statuses: number[]): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(ApiErrorResponseDto, ApiResponseMetaDto),
    ...statuses.map((status) =>
      ApiResponse({
        status,
        type: ApiErrorResponseDto,
        description: errorDescriptions[status] ?? "请求失败",
      }),
    ),
  );
}
