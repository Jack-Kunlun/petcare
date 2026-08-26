import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCommunityPostDto, MyCommunityPostListQueryDto } from "./community-post.dto";

describe("community post DTOs", () => {
  it("trims and validates text submissions", async () => {
    const dto = plainToInstance(CreateCommunityPostDto, { content: "  今天带旺财散步  " });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.content).toBe("今天带旺财散步");
  });

  it("rejects blank submissions", async () => {
    const dto = plainToInstance(CreateCommunityPostDto, { content: "   " });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it("uses bounded pagination defaults", async () => {
    const dto = plainToInstance(MyCommunityPostListQueryDto, {});

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, pageSize: 20 });
  });
});
