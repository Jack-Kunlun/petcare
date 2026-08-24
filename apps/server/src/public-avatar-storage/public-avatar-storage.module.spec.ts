import { HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigService } from "../config/config.service";
import { PublicAvatarStorageModule } from "./public-avatar-storage.module";
import { PUBLIC_AVATAR_STORAGE, PublicAvatarStorage } from "./public-avatar-storage.types";

describe("PublicAvatarStorageModule", () => {
  it("provides a disabled storage adapter when Tencent COS is not configured", async () => {
    const module = await Test.createTestingModule({
      imports: [PublicAvatarStorageModule],
    })
      .overrideProvider(ConfigService)
      .useValue({ tencentCosEnabled: false })
      .compile();
    const storage = module.get<PublicAvatarStorage>(PUBLIC_AVATAR_STORAGE);

    await expect(
      storage.upload({
        scope: "admin-avatars",
        userId: "user-1",
        body: Buffer.from("png-avatar"),
        contentType: "image/png",
        extension: "png",
      }),
    ).rejects.toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
    await expect(storage.delete("public/admin-avatars/user-1/avatar.png")).resolves.toBeUndefined();
  });
});
