import { existsSync } from "node:fs";
import path from "node:path";
import {
  PET_ERROR_CODE,
  PET_GENDER,
  PET_SPECIES,
  type ApiErrorResponse,
  type CreatePetRequest,
  type MyPetDetail,
  type MyPetListResponse,
  type PetPhotoAsset,
} from "@petcare/shared-types";
import { expect, test, type APIResponse, type Page } from "@playwright/test";

const PET_PHOTO = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

PET_PHOTO.writeUInt32BE(32, 16);
PET_PHOTO.writeUInt32BE(32, 20);

function requiredEnv(
  name:
    | "ADMIN_E2E_MEDIA_DIR"
    | "ADMIN_E2E_MINIAPP_URL"
    | "PET_E2E_OTHER_OWNER_TOKEN"
    | "PET_E2E_OWNER_ID"
    | "PET_E2E_OWNER_TOKEN",
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Pet Profile E2E`);
  }

  return value;
}

async function responseData<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(`Request failed with ${response.status()}: ${await response.text()}`);
  }

  return ((await response.json()) as { data: T }).data;
}

async function expectFailure(response: APIResponse, status: number, code: string): Promise<void> {
  expect(response.status()).toBe(status);
  expect(((await response.json()) as ApiErrorResponse).code).toBe(code);
}

async function uploadPhoto(
  page: Page,
  petId: string,
  authorization: string,
  name: string,
): Promise<PetPhotoAsset> {
  return responseData<PetPhotoAsset>(
    await page.request.post(`/api/pets/${petId}/media-assets`, {
      headers: { Authorization: authorization },
      multipart: {
        file: {
          name,
          mimeType: "image/png",
          buffer: PET_PHOTO,
        },
      },
    }),
  );
}

function storedPhotoPath(asset: PetPhotoAsset): string {
  const storageRoot = path.resolve(requiredEnv("ADMIN_E2E_MEDIA_DIR"));
  const storageKey = decodeURIComponent(new URL(asset.url).pathname.replace(/^\/+/, ""));
  const objectPath = path.resolve(storageRoot, storageKey);

  expect(objectPath.startsWith(`${storageRoot}${path.sep}`)).toBe(true);

  return objectPath;
}

async function seedMiniappSession(page: Page, accessToken: string): Promise<void> {
  const refreshToken = "pet-e2e-refresh-restored";
  const user = {
    id: requiredEnv("PET_E2E_OWNER_ID"),
    nickname: "宠物 E2E 主人",
    avatar: null,
    phoneMasked: "139****0097",
    profileComplete: true,
    userType: "pet_owner",
    region: null,
    bio: null,
  };

  await page.route("**/auth/wechat/refresh", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();

      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": new URL(page.url()).origin },
      json: {
        code: "SUCCESS",
        message: "操作成功",
        data: { accessToken, refreshToken, user },
        meta: { requestId: "pet-e2e-session-refresh", timestamp: new Date().toISOString() },
      },
    });
  });
  await page.evaluate(
    ({ token, storedUser }) => {
      const runtime = globalThis as typeof globalThis & {
        uni: {
          removeStorageSync: (key: string) => void;
          setStorageSync: (key: string, value: unknown) => void;
        };
      };

      runtime.uni.setStorageSync("petcare.sessionCommitted", false);
      runtime.uni.setStorageSync("petcare.accessToken", token);
      runtime.uni.setStorageSync("petcare.refreshToken", "pet-e2e-refresh-not-used");
      runtime.uni.setStorageSync("petcare.user", storedUser);
      runtime.uni.removeStorageSync("petcare.manualLogout");
      runtime.uni.setStorageSync("petcare.sessionCommitted", true);
    },
    { token: accessToken, storedUser: user },
  );
  const refreshed = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/auth/wechat/refresh"),
  );

  await page.reload();
  await refreshed;
  await page.waitForFunction((expectedRefreshToken) => {
    const runtime = globalThis as typeof globalThis & {
      uni: { getStorageSync: (key: string) => unknown };
    };

    return runtime.uni.getStorageSync("petcare.refreshToken") === expectedRefreshToken;
  }, refreshToken);
}

test("本人宠物档案在隔离环境完成管理、权限与图片清理闭环", async ({ browser, page }) => {
  test.setTimeout(90_000);
  const ownerAuthorization = `Bearer ${requiredEnv("PET_E2E_OWNER_TOKEN")}`;
  const otherAuthorization = `Bearer ${requiredEnv("PET_E2E_OTHER_OWNER_TOKEN")}`;
  const originalName = `团团${Date.now().toString().slice(-4)}`;
  const updatedName = `圆圆${Date.now().toString().slice(-4)}`;
  const initialNotes = "喜欢散步；不能吃鸡肉和葡萄";
  const updatedNotes = "每天早晚散步，怕突然的响声";
  const input: CreatePetRequest = {
    name: originalName,
    species: PET_SPECIES.DOG,
    breed: "柯基",
    gender: PET_GENDER.FEMALE,
    birthDate: "2023-05-12",
    weightKg: 10.6,
    sterilized: true,
    notes: initialNotes,
  };

  await expectFailure(await page.request.get("/api/pets"), 401, "AUTH_SESSION_EXPIRED");
  await expect(
    responseData<MyPetListResponse>(
      await page.request.get("/api/pets", { headers: { Authorization: otherAuthorization } }),
    ),
  ).resolves.toEqual([]);

  const created = await responseData<MyPetDetail>(
    await page.request.post("/api/pets", {
      headers: { Authorization: ownerAuthorization },
      data: input,
    }),
  );

  expect(created).toMatchObject({
    ...input,
    id: expect.any(String),
    photoAssets: [],
    photoUrls: [],
  });

  const firstPhoto = await uploadPhoto(page, created.id, ownerAuthorization, "pet-first.png");
  const secondPhoto = await uploadPhoto(page, created.id, ownerAuthorization, "pet-second.png");
  const firstPhotoPath = storedPhotoPath(firstPhoto);
  const secondPhotoPath = storedPhotoPath(secondPhoto);

  expect(firstPhoto).toMatchObject({ mimeType: "image/png", width: 32, height: 32 });
  expect(secondPhoto).toMatchObject({ mimeType: "image/png", width: 32, height: 32 });
  expect(existsSync(firstPhotoPath)).toBe(true);
  expect(existsSync(secondPhotoPath)).toBe(true);

  await expectFailure(
    await page.request.get(`/api/pets/${created.id}`, {
      headers: { Authorization: otherAuthorization },
    }),
    404,
    PET_ERROR_CODE.NOT_FOUND,
  );
  await expectFailure(
    await page.request.put(`/api/pets/${created.id}`, {
      headers: { Authorization: otherAuthorization },
      data: { ...input, name: "越权修改" },
    }),
    404,
    PET_ERROR_CODE.NOT_FOUND,
  );
  await expectFailure(
    await page.request.post(`/api/pets/${created.id}/media-assets`, {
      headers: { Authorization: otherAuthorization },
      multipart: {
        file: { name: "foreign.png", mimeType: "image/png", buffer: PET_PHOTO },
      },
    }),
    404,
    PET_ERROR_CODE.NOT_FOUND,
  );
  await expectFailure(
    await page.request.delete(`/api/pets/${created.id}/media-assets/${firstPhoto.id}`, {
      headers: { Authorization: otherAuthorization },
    }),
    404,
    PET_ERROR_CODE.NOT_FOUND,
  );
  await expectFailure(
    await page.request.delete(`/api/pets/${created.id}`, {
      headers: { Authorization: otherAuthorization },
    }),
    404,
    PET_ERROR_CODE.NOT_FOUND,
  );
  expect(existsSync(firstPhotoPath)).toBe(true);
  expect(existsSync(secondPhotoPath)).toBe(true);

  const miniappContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const miniappPage = await miniappContext.newPage();
  const miniappUrl = requiredEnv("ADMIN_E2E_MINIAPP_URL");

  try {
    await miniappPage.goto(`${miniappUrl}/#/pages/community/index`);
    await seedMiniappSession(miniappPage, requiredEnv("PET_E2E_OWNER_TOKEN"));
    await miniappPage.goto(`${miniappUrl}/#/pages-account/pets/index`);
    await expect(miniappPage.getByText(originalName, { exact: true })).toBeVisible();
    await expect(miniappPage.getByText("1/5 只", { exact: true })).toBeVisible();
    await miniappPage.getByLabel(`查看${originalName}的宠物档案`).click();
    await expect(miniappPage).toHaveURL(
      new RegExp(`/pages-account/pets/detail[?]id=${created.id}$`, "u"),
    );
    await expect(miniappPage.getByText(originalName, { exact: true })).toBeVisible();
    await expect(miniappPage.getByText("2 张", { exact: true })).toBeVisible();
    await expect(miniappPage.getByText(initialNotes, { exact: true })).toBeVisible();
    await miniappPage.getByText("编辑档案", { exact: true }).click();
    await expect(miniappPage).toHaveURL(
      new RegExp(`/pages-account/pets/form[?]mode=edit&id=${created.id}$`, "u"),
    );
    await miniappPage.getByLabel("宠物名字").locator("input").fill(updatedName);
    await miniappPage.getByLabel("宠物备注").locator("textarea").fill(updatedNotes);
    await miniappPage.getByText("保存修改", { exact: true }).click();
    await expect(miniappPage.getByText(updatedName, { exact: true })).toBeVisible();
    await expect(miniappPage.getByText(updatedNotes, { exact: true })).toBeVisible();

    const repeatedInput: CreatePetRequest = { ...input, name: updatedName, notes: updatedNotes };
    const firstRepeatedUpdate = await responseData<MyPetDetail>(
      await page.request.put(`/api/pets/${created.id}`, {
        headers: { Authorization: ownerAuthorization },
        data: repeatedInput,
      }),
    );
    const secondRepeatedUpdate = await responseData<MyPetDetail>(
      await page.request.put(`/api/pets/${created.id}`, {
        headers: { Authorization: ownerAuthorization },
        data: repeatedInput,
      }),
    );

    expect(firstRepeatedUpdate).toMatchObject({ ...repeatedInput, id: created.id });
    expect(secondRepeatedUpdate).toMatchObject({ ...repeatedInput, id: created.id });
    expect(secondRepeatedUpdate.photoAssets.map((asset) => asset.id).sort()).toEqual(
      [firstPhoto.id, secondPhoto.id].sort(),
    );

    const firstDelete = await page.request.delete(
      `/api/pets/${created.id}/media-assets/${firstPhoto.id}`,
      { headers: { Authorization: ownerAuthorization } },
    );

    expect(firstDelete.status()).toBe(204);
    expect(existsSync(firstPhotoPath)).toBe(false);
    expect(existsSync(secondPhotoPath)).toBe(true);
    await expectFailure(
      await page.request.delete(`/api/pets/${created.id}/media-assets/${firstPhoto.id}`, {
        headers: { Authorization: ownerAuthorization },
      }),
      404,
      PET_ERROR_CODE.PHOTO_NOT_FOUND,
    );

    const afterPhotoDelete = await responseData<MyPetDetail>(
      await page.request.get(`/api/pets/${created.id}`, {
        headers: { Authorization: ownerAuthorization },
      }),
    );

    expect(afterPhotoDelete.photoAssets).toMatchObject([{ id: secondPhoto.id }]);
    expect(afterPhotoDelete.photoUrls).toEqual([secondPhoto.url]);

    const petDelete = await page.request.delete(`/api/pets/${created.id}`, {
      headers: { Authorization: ownerAuthorization },
    });

    expect(petDelete.status()).toBe(204);
    expect(existsSync(secondPhotoPath)).toBe(false);
    await expectFailure(
      await page.request.delete(`/api/pets/${created.id}`, {
        headers: { Authorization: ownerAuthorization },
      }),
      404,
      PET_ERROR_CODE.NOT_FOUND,
    );
    await expectFailure(
      await page.request.get(`/api/pets/${created.id}`, {
        headers: { Authorization: ownerAuthorization },
      }),
      404,
      PET_ERROR_CODE.NOT_FOUND,
    );
    await expect(
      responseData<MyPetListResponse>(
        await page.request.get("/api/pets", { headers: { Authorization: ownerAuthorization } }),
      ),
    ).resolves.toEqual([]);

    await miniappPage.goto(`${miniappUrl}/#/pages-account/pets/index`);
    await expect(miniappPage.getByText("还没有宠物档案", { exact: true })).toBeVisible();
    await expect(miniappPage.getByText("0/5 只", { exact: true })).toBeVisible();
  } finally {
    await miniappContext.close();
  }
});
