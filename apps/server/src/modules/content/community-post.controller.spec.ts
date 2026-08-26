import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AccessTokenGuard } from "../../auth/access-token.guard";
import { ProfileCompleteGuard } from "../../auth/profile-complete.guard";
import {
  CommunityPostController,
  PublicCommunityPostController,
} from "./community-post.controller";

describe("CommunityPostController", () => {
  const posts = {
    create: jest.fn(),
    deleteOwn: jest.fn(),
    findMine: jest.fn(),
    findLikeState: jest.fn(),
    findPublished: jest.fn(),
    findPublishedById: jest.fn(),
    report: jest.fn(),
    like: jest.fn(),
    unlike: jest.fn(),
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
    expect(Reflect.getMetadata("path", CommunityPostController.prototype.report)).toBe(
      ":id/reports",
    );
    expect(Reflect.getMetadata("path", CommunityPostController.prototype.findLikeState)).toBe(
      ":id/like",
    );
    expect(Reflect.getMetadata("path", CommunityPostController.prototype.like)).toBe(":id/like");
    expect(Reflect.getMetadata("path", CommunityPostController.prototype.unlike)).toBe(":id/like");
    expect(Reflect.getMetadata("path", CommunityPostController.prototype.deleteOwn)).toBe(":id");
  });

  it("uses only the access-token subject as the post author", async () => {
    posts.create.mockResolvedValue({ id: "post-1", status: "pending" });
    posts.findMine.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 });
    posts.deleteOwn.mockResolvedValue(undefined);
    posts.report.mockResolvedValue({ id: "report-1", status: "pending" });
    posts.findLikeState.mockResolvedValue({ liked: false, likesCount: 0 });
    posts.like.mockResolvedValue({ liked: true, likesCount: 1 });
    posts.unlike.mockResolvedValue({ liked: false, likesCount: 0 });
    const request = { user: { sub: "user-1" } } as never;

    await expect(controller.create(request, { content: "动态正文" })).resolves.toMatchObject({
      id: "post-1",
    });
    await expect(controller.findMine(request, { page: 1, pageSize: 20 })).resolves.toMatchObject({
      total: 0,
    });
    await expect(controller.deleteOwn(request, "post-1")).resolves.toBeUndefined();
    await expect(controller.report(request, "post-1", { reason: "spam" })).resolves.toMatchObject({
      id: "report-1",
    });
    await expect(controller.findLikeState(request, "post-1")).resolves.toEqual({
      liked: false,
      likesCount: 0,
    });
    await expect(controller.like(request, "post-1")).resolves.toEqual({
      liked: true,
      likesCount: 1,
    });
    await expect(controller.unlike(request, "post-1")).resolves.toEqual({
      liked: false,
      likesCount: 0,
    });

    expect(posts.create).toHaveBeenCalledWith("user-1", { content: "动态正文" });
    expect(posts.findMine).toHaveBeenCalledWith("user-1", { page: 1, pageSize: 20 });
    expect(posts.deleteOwn).toHaveBeenCalledWith("user-1", "post-1");
    expect(posts.report).toHaveBeenCalledWith("user-1", "post-1", { reason: "spam" });
    expect(posts.findLikeState).toHaveBeenCalledWith("user-1", "post-1");
    expect(posts.like).toHaveBeenCalledWith("user-1", "post-1");
    expect(posts.unlike).toHaveBeenCalledWith("user-1", "post-1");
  });

  it("exposes public published list and detail without authentication", async () => {
    const publicController = new PublicCommunityPostController(posts as never);
    const query = { page: 2, pageSize: 10 };

    posts.findPublished.mockResolvedValue({ list: [], total: 0, page: 2, pageSize: 10 });
    posts.findPublishedById.mockResolvedValue({ id: "post-1" });

    expect(Reflect.getMetadata("path", PublicCommunityPostController)).toBe(
      "content/community-posts",
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, PublicCommunityPostController)).toBeUndefined();
    await expect(publicController.findPublished(query)).resolves.toMatchObject({ page: 2 });
    await expect(publicController.findPublishedById("post-1")).resolves.toEqual({ id: "post-1" });
    expect(posts.findPublished).toHaveBeenCalledWith(query);
    expect(posts.findPublishedById).toHaveBeenCalledWith("post-1");
  });
});
