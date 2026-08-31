import {
  BOUNTY_ERROR_CODE,
  BOUNTY_SERVICE_TYPE,
  PET_GENDER,
  PET_SPECIES,
  type ApiErrorResponse,
  type CreateBountyRequest,
  type CreatePetRequest,
  type MyBounty,
  type MyBountyListResponse,
  type MyPetDetail,
  type PublicBounty,
  type PublicBountyListResponse,
} from "@petcare/shared-types";
import {
  expect,
  test,
  type APIResponse,
  type Locator,
  type Page,
  type Response,
} from "@playwright/test";

function requiredEnv(
  name:
    | "ADMIN_E2E_MINIAPP_URL"
    | "BOUNTY_E2E_OTHER_OWNER_TOKEN"
    | "BOUNTY_E2E_OWNER_ID"
    | "BOUNTY_E2E_OWNER_TOKEN",
): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for Bounty E2E`);
  }

  return value;
}

async function responseData<T>(response: APIResponse | Response): Promise<T> {
  if (!response.ok()) {
    throw new Error(`Request failed with ${response.status()}: ${await response.text()}`);
  }

  return ((await response.json()) as { data: T }).data;
}

async function expectFailure(response: APIResponse, status: number, code: string): Promise<void> {
  expect(response.status()).toBe(status);
  expect(((await response.json()) as ApiErrorResponse).code).toBe(code);
}

const twoDigits = (part: number): string => part.toString().padStart(2, "0");

async function seedMiniappSession(page: Page, accessToken: string): Promise<void> {
  const refreshToken = "bounty-e2e-refresh-restored";
  const user = {
    id: requiredEnv("BOUNTY_E2E_OWNER_ID"),
    nickname: "悬赏 E2E 主人",
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
        meta: { requestId: "bounty-e2e-session-refresh", timestamp: new Date().toISOString() },
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
      runtime.uni.setStorageSync("petcare.refreshToken", "bounty-e2e-refresh-not-used");
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
}

async function openPicker(page: Page, label: string): Promise<Locator> {
  await page.getByLabel(label).click();
  const picker = page.locator(".uni-picker-container:has(.uni-picker-toggle)");

  await expect(picker).toHaveCount(1);
  await expect(picker.locator("uni-picker-view")).toBeVisible();

  return picker;
}

async function setPickerColumn(column: Locator, targetIndex: number): Promise<void> {
  await column.evaluate(async (element, nextIndex) => {
    const group = element.querySelector<HTMLElement>(".uni-picker-view-group");
    const content = element.querySelector<HTMLElement>(".uni-picker-view-content");
    const itemCount = element.querySelectorAll(".uni-picker-item").length;
    const selectedIndex = (): number => {
      const offset = /translateY\((-?[\d.]+)px\)/u.exec(content?.style.transform ?? "")?.[1];
      const height = Number.parseFloat(
        content?.style.getPropertyValue("--picker-view-column-indicator-height") ?? "",
      );

      return offset && height ? Math.round(Math.abs(Number(offset)) / height) : NaN;
    };

    await new Promise<void>((resolve, reject) => {
      let frame = 0;
      const waitForPosition = (): void => {
        if (Number.isFinite(selectedIndex())) {
          resolve();
        } else if (frame === 120) {
          reject(new Error("Picker did not initialize"));
        } else {
          frame += 1;
          requestAnimationFrame(waitForPosition);
        }
      };

      waitForPosition();
    });

    const currentIndex = selectedIndex();

    if (!group || !Number.isFinite(currentIndex) || nextIndex < 0 || nextIndex >= itemCount) {
      throw new Error(`Invalid picker index ${nextIndex} for ${itemCount} items`);
    }

    const direction = Math.sign(nextIndex - currentIndex);

    for (let index = currentIndex; index !== nextIndex; index += direction) {
      group.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: direction * 12 }),
      );
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    if (selectedIndex() !== nextIndex) {
      throw new Error(`Picker stopped at ${selectedIndex()} instead of ${nextIndex}`);
    }
  }, targetIndex);
}

async function confirmPicker(picker: Locator): Promise<void> {
  await picker.locator(".uni-picker-action-confirm").click();
}

function localDateParts(value: Date): { date: string; clock: string } {
  return {
    date: `${value.getFullYear()}-${twoDigits(value.getMonth() + 1)}-${twoDigits(value.getDate())}`,
    clock: `${twoDigits(value.getHours())}:${twoDigits(value.getMinutes())}`,
  };
}

test("悬赏在隔离环境完成发布、私有读取、公开脱敏与所有权拒绝", async ({ browser, page }) => {
  test.setTimeout(90_000);
  const ownerAuthorization = `Bearer ${requiredEnv("BOUNTY_E2E_OWNER_TOKEN")}`;
  const otherAuthorization = `Bearer ${requiredEnv("BOUNTY_E2E_OTHER_OWNER_TOKEN")}`;
  const petInput: CreatePetRequest = {
    name: `悬赏宠物${Date.now().toString().slice(-4)}`,
    species: PET_SPECIES.DOG,
    breed: "柯基",
    gender: PET_GENDER.FEMALE,
    birthDate: "2023-05-12",
    weightKg: 10.6,
    sterilized: true,
    notes: "悬赏隔离验收宠物",
  };
  const pet = await responseData<MyPetDetail>(
    await page.request.post("/api/pets", {
      headers: { Authorization: ownerAuthorization },
      data: petInput,
    }),
  );
  const service = localDateParts(new Date(Date.now() + 48 * 60 * 60 * 1_000));
  const request: CreateBountyRequest = {
    petId: pet.id,
    serviceType: BOUNTY_SERVICE_TYPE.FEEDING,
    serviceTime: new Date(`${service.date}T${service.clock}:00`).toISOString(),
    amountCents: 5_025,
    address: "上海市隔离验收地址 52 号",
    remark: "请换水并拍照",
  };

  await expectFailure(
    await page.request.post("/api/bounties", {
      headers: { Authorization: otherAuthorization },
      data: request,
    }),
    404,
    BOUNTY_ERROR_CODE.NOT_FOUND,
  );
  expect(
    await responseData<MyBountyListResponse>(
      await page.request.get("/api/bounties/mine?page=1&pageSize=20", {
        headers: { Authorization: otherAuthorization },
      }),
    ),
  ).toMatchObject({ list: [], total: 0 });

  const miniappContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const miniappPage = await miniappContext.newPage();
  const miniappUrl = requiredEnv("ADMIN_E2E_MINIAPP_URL");

  try {
    await miniappPage.goto(`${miniappUrl}/#/pages/community/index`);
    await seedMiniappSession(miniappPage, requiredEnv("BOUNTY_E2E_OWNER_TOKEN"));
    await miniappPage.goto(`${miniappUrl}/#/pages-bounty/form?petId=${pet.id}`);
    await expect(
      miniappPage.getByLabel("选择照护宠物").locator("span", { hasText: pet.name }),
    ).toBeVisible();

    const serviceTypePicker = await openPicker(miniappPage, "选择服务类型");

    await setPickerColumn(serviceTypePicker.locator("uni-picker-view-column"), 0);
    await confirmPicker(serviceTypePicker);

    const [year, month, day] = service.date.split("-").map(Number);
    const datePicker = await openPicker(miniappPage, "选择服务日期");
    const dateColumns = datePicker.locator("uni-picker-view-column");
    const dateColumnSizes = await dateColumns.evaluateAll((columns) =>
      columns.map((column) => column.querySelectorAll(".uni-picker-item").length),
    );
    const yearColumnIndex = dateColumnSizes.findIndex((size) => size > 31);
    const monthColumnIndex = dateColumnSizes.indexOf(12);
    const dayColumnIndex = dateColumnSizes.findIndex((size) => size >= 28 && size <= 31);
    const yearItems = await dateColumns
      .nth(yearColumnIndex)
      .locator(".uni-picker-item")
      .allTextContents();
    const yearIndex = yearItems.findIndex((item) => Number.parseInt(item, 10) === year);

    await setPickerColumn(dateColumns.nth(yearColumnIndex), yearIndex);
    await setPickerColumn(dateColumns.nth(monthColumnIndex), month - 1);
    await setPickerColumn(dateColumns.nth(dayColumnIndex), day - 1);
    await confirmPicker(datePicker);

    const [hour, minute] = service.clock.split(":").map(Number);
    const timePicker = await openPicker(miniappPage, "选择服务时间");
    const timeColumns = timePicker.locator("uni-picker-view-column");

    await setPickerColumn(timeColumns.nth(0), hour);
    await setPickerColumn(timeColumns.nth(1), minute);
    await confirmPicker(timePicker);
    await miniappPage.getByLabel("悬赏金额").locator("input").fill("50.25");
    await miniappPage.getByLabel("服务地址").locator("textarea").fill(request.address);
    await miniappPage
      .getByLabel("悬赏备注")
      .locator("textarea")
      .fill(request.remark ?? "");

    const createdResponse = miniappPage.waitForResponse(
      (response) => response.request().method() === "POST" && response.url().endsWith("/bounties"),
    );

    await miniappPage.getByText("确认发布", { exact: true }).click();
    const created = await responseData<MyBounty>(await createdResponse);

    expect(created).toMatchObject({
      pet: { id: pet.id, name: pet.name },
      serviceType: request.serviceType,
      amountCents: request.amountCents,
      address: request.address,
      remark: request.remark,
    });
    await expect(miniappPage).toHaveURL(/\/pages-bounty\/index[?]tab=mine$/u);
    await expect(miniappPage.getByText(request.address, { exact: true })).toBeVisible();
    await expect(miniappPage.getByText(`备注：${request.remark}`, { exact: true })).toBeVisible();

    const mine = await responseData<MyBountyListResponse>(
      await page.request.get("/api/bounties/mine?page=1&pageSize=20", {
        headers: { Authorization: ownerAuthorization },
      }),
    );

    expect(mine).toMatchObject({ total: 1, list: [{ id: created.id, address: request.address }] });

    const publicList = await responseData<PublicBountyListResponse>(
      await page.request.get("/api/bounties?page=1&pageSize=20"),
    );
    const publicDetail = await responseData<PublicBounty>(
      await page.request.get(`/api/bounties/${created.id}`),
    );

    expect(publicList).toMatchObject({ total: 1, list: [{ id: created.id }] });
    expect(publicDetail).toEqual(publicList.list[0]);
    expect(Object.keys(publicDetail).sort()).toEqual(
      [
        "amountCents",
        "expiresAt",
        "id",
        "owner",
        "pet",
        "serviceTime",
        "serviceType",
        "status",
      ].sort(),
    );
    expect(Object.keys(publicDetail.pet).sort()).toEqual(["breed", "coverImage", "name"]);

    await miniappPage.getByText("悬赏广场", { exact: true }).click();
    await expect(miniappPage.getByText(pet.name, { exact: false })).toBeVisible();
    await expect(miniappPage.getByText("¥50.25", { exact: true })).toBeVisible();
    await expect(miniappPage.getByText(request.address, { exact: true })).toHaveCount(0);
    await expect(miniappPage.getByText(request.remark ?? "", { exact: false })).toHaveCount(0);
  } finally {
    await miniappContext.close();
  }
});
