import { describe, expect, it } from "vitest";
import { getDefaultAvatar } from "./default-avatar";

describe("getDefaultAvatar", () => {
  it("maps a user id deterministically to a bundled pet avatar", () => {
    expect(getDefaultAvatar("user-1")).toBe("/static/main/profile-dog.png");
    expect(getDefaultAvatar("user-2")).toBe("/static/main/profile-cat.png");
    expect(getDefaultAvatar("user-1")).toBe(getDefaultAvatar("user-1"));
  });
});
