import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CreateCommunityPostReportDto,
  CreateCommunityPostDto,
  MyCommunityPostListQueryDto,
  PublicCommunityPostListQueryDto,
} from "./community-post.dto";

describe("community post DTOs", () => {
  it("trims and validates text submissions", async () => {
    const dto = plainToInstance(CreateCommunityPostDto, { content: "  今天带旺财散步  " });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.content).toBe("今天带旺财散步");
    expect(dto.mediaAssetIds).toEqual([]);
  });

  it("rejects blank submissions", async () => {
    const dto = plainToInstance(CreateCommunityPostDto, { content: "   " });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it("accepts at most nine unique UUID media ids", async () => {
    const mediaAssetIds = Array.from(
      { length: 9 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );
    const valid = plainToInstance(CreateCommunityPostDto, { content: "图文", mediaAssetIds });
    const tooMany = plainToInstance(CreateCommunityPostDto, {
      content: "图文",
      mediaAssetIds: [...mediaAssetIds, "00000000-0000-4000-8000-000000000010"],
    });
    const duplicate = plainToInstance(CreateCommunityPostDto, {
      content: "图文",
      mediaAssetIds: [mediaAssetIds[0], mediaAssetIds[0]],
    });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(tooMany)).resolves.not.toHaveLength(0);
    await expect(validate(duplicate)).resolves.not.toHaveLength(0);
  });

  it("accepts only controlled report reasons and trims optional context", async () => {
    const valid = plainToInstance(CreateCommunityPostReportDto, {
      reason: "spam",
      description: "  重复广告  ",
    });
    const invalid = plainToInstance(CreateCommunityPostReportDto, { reason: "custom" });

    await expect(validate(valid)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.not.toHaveLength(0);
    expect(valid.description).toBe("重复广告");
  });

  it("uses bounded pagination defaults", async () => {
    const dto = plainToInstance(MyCommunityPostListQueryDto, {});
    const publicDto = plainToInstance(PublicCommunityPostListQueryDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
    await expect(validate(publicDto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, pageSize: 20 });
    expect(publicDto).toMatchObject({ page: 1, pageSize: 20 });
  });
});
