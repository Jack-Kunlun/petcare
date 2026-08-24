import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CreateAdminClassroomArticleDto,
  UpdateAdminClassroomArticleDto,
} from "./admin-classroom-article.dto";

const validUpdate = {
  title: "标题",
  summary: "摘要",
  bodyHtml: "<p>正文</p>",
  coverAssetId: "123e4567-e89b-12d3-a456-426614174000",
  expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
};

describe("Admin classroom article DTOs", () => {
  it("trims a valid update while preserving nullable cover intent", async () => {
    const dto = plainToInstance(UpdateAdminClassroomArticleDto, {
      title: "  幼犬喂养课堂  ",
      summary: "  基础知识  ",
      bodyHtml: "<p>正文</p>",
      coverAssetId: null,
      expectedUpdatedAt: "2026-08-24T00:00:00.000Z",
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.title).toBe("幼犬喂养课堂");
    expect(dto.summary).toBe("基础知识");
    expect(dto.coverAssetId).toBeNull();
  });

  it.each([
    ["blank title", { title: " " }],
    ["overlong title", { title: "x".repeat(121) }],
    ["blank summary", { summary: " " }],
    ["overlong summary", { summary: "x".repeat(501) }],
    ["overlong HTML", { bodyHtml: "x".repeat(200_001) }],
    ["non-UUID cover", { coverAssetId: "https://external.example/cover.png" }],
    ["non-strict timestamp", { expectedUpdatedAt: "yesterday" }],
  ])("rejects %s", async (_description, override) => {
    const dto = plainToInstance(UpdateAdminClassroomArticleDto, { ...validUpdate, ...override });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it("allows a new article to omit its cover", async () => {
    const dto = plainToInstance(CreateAdminClassroomArticleDto, {
      title: "标题",
      summary: "摘要",
      bodyHtml: "<p>正文</p>",
      coverAssetId: validUpdate.coverAssetId,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
