import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import { CommunityPostController } from "./community-post.controller";

describe("CommunityPostController", () => {
  const posts = {
    create: jest.fn(),
    findMine: jest.fn(),
  };
  const controller = new CommunityPostController(posts as never);

  beforeEach(() => jest.clearAllMocks());

  it("requires an authenticated complete profile for every author endpoint", () => {
    expect(Reflect.getMetadata("path", CommunityPostController)).toBe("community/posts");
    expect(Reflect.getMetadata(GUARDS_METADATA, CommunityPostController)).toEqual([
      AccessTokenGuard,
      ProfileCompleteGuard,
    ]);
    expect(Reflect.getMetadata("path", CommunityPostController.prototype.create)).toBe("/");
    expect(Reflect.getMetadata("path", CommunityPostController.prototype.findMine)).toBe("mine");
  });

  it("uses only the access-token subject as the post author", async () => {
    posts.create.mockResolvedValue({ id: "post-1", status: "pending" });
    posts.findMine.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 });
    const request = { user: { sub: "user-1" } } as never;

    await expect(controller.create(request, { content: "动态正文" })).resolves.toMatchObject({
      id: "post-1",
    });
    await expect(controller.findMine(request, { page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 0,
    });

    expect(posts.create).toHaveBeenCalledWith("user-1", { content: "动态正文" });
    expect(posts.findMine).toHaveBeenCalledWith("user-1", { page: 1, pageSize: 20 });
  });
});
