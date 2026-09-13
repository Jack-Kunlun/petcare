import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import process from "node:process";
import { URL } from "node:url";
import { expect, test } from "@playwright/test";
import { assertDisposableAdminSchema } from "./run-e2e.mjs";

const serverRequire = createRequire(new URL("../../server/package.json", import.meta.url));

test("qualification cleanup retries partial failures without losing reservations or audit", async () => {
  assertDisposableAdminSchema(process.env.DB_SCHEMA);
  const { ConfigService } = serverRequire("./dist/config/config.service.js");
  const { PrismaService } = serverRequire("./dist/prisma/prisma.service.js");
  const { ProviderQualificationService } = serverRequire(
    "./dist/modules/provider-qualification/provider-qualification.service.js",
  );
  const config = new ConfigService();
  const prisma = new PrismaService(config);
  const objects = new Map();
  const failedDeletes = new Set();
  let failPut = true;
  const storage = {
    createKey: () => `private/provider-qualifications/${randomUUID()}`,
    put: async (key, bytes) => {
      objects.set(key, bytes);
      if (failPut) {
        failedDeletes.add(key);
        throw new Error("Injected response loss after upload");
      }
    },
    delete: async (key) => {
      if (failedDeletes.has(key)) throw new Error("Injected delete failure");
      objects.delete(key);
    },
  };
  // Only COS failures are injected; all transactions, locks and audit writes use PostgreSQL.
  const service = new ProviderQualificationService(prisma, storage, config);
  const file = {
    originalname: "non-personal-logo.png",
    mimetype: "image/png",
    buffer: readFileSync(
      new URL("../../miniapp/src/static/auth/petcare-logo.png", import.meta.url),
    ),
  };

  try {
    const user = await prisma.user.create({
      data: {
        phone: `139${randomInt(10_000_000, 100_000_000)}`,
        nickname: "Cleanup E2E",
        status: "active",
      },
    });
    const draft = await service.createDraft(user.id, randomUUID());
    await expect(service.upload(user.id, draft.id, "id-front", file)).rejects.toThrow(
      "response loss",
    );
    const [orphanKey] = objects.keys();
    expect(
      await prisma.providerQualificationUpload.findUnique({ where: { key: orphanKey } }),
    ).not.toBeNull();
    expect(
      (await prisma.providerQualificationApplication.findUniqueOrThrow({ where: { id: draft.id } }))
        .idCardFrontKey,
    ).toBeNull();
    await prisma.providerQualificationUpload.update({
      where: { key: orphanKey },
      data: { createdAt: new Date(Date.now() - 6 * 60_000) },
    });
    await service.purgeExpired();
    expect(
      await prisma.providerQualificationUpload.findUnique({ where: { key: orphanKey } }),
    ).not.toBeNull();
    failedDeletes.clear();
    await service.purgeExpired();
    expect(
      await prisma.providerQualificationUpload.findUnique({ where: { key: orphanKey } }),
    ).toBeNull();
    expect(objects.has(orphanKey)).toBe(false);

    failPut = false;
    await Promise.all(
      ["id-front", "id-back", "training"].map((kind) =>
        service.upload(user.id, draft.id, kind, file),
      ),
    );
    const complete = await prisma.providerQualificationApplication.update({
      where: { id: draft.id },
      data: { purgeAfter: new Date(Date.now() - 1_000) },
    });
    failedDeletes.add(complete.trainingKey);
    expect(await service.purgeExpired()).toBe(0);
    const partial = await prisma.providerQualificationApplication.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(partial.status).toBe("expired");
    expect(partial.purgedAt).toBeNull();
    expect(partial.trainingKey).toBe(complete.trainingKey);
    expect(objects.size).toBe(1);

    failedDeletes.clear();
    const purges = await Promise.all([service.purgeExpired(), service.purgeExpired()]);
    expect(purges.reduce((sum, count) => sum + count, 0)).toBe(1);
    const purged = await prisma.providerQualificationApplication.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(purged.purgedAt).not.toBeNull();
    expect([purged.idCardFrontKey, purged.idCardBackKey, purged.trainingKey]).toEqual([
      null,
      null,
      null,
    ]);
    expect(objects.size).toBe(0);
    const events = await prisma.providerQualificationEvent.findMany({
      where: { applicationId: draft.id },
    });
    expect(events.filter((event) => event.action === "expired")).toHaveLength(1);
    expect(events.filter((event) => event.action === "materials_purged")).toHaveLength(1);
    expect(await service.purgeExpired()).toBe(0);

    // Retention fixtures cannot grant eligibility: no provider projection is created.
    const retained = await Promise.all(
      ["pending", "approved", "revoked"].map((status) =>
        prisma.providerQualificationApplication.create({
          data: {
            applicantId: user.id,
            idempotencyKey: randomUUID(),
            status,
            idCardFrontKey: storage.createKey(),
            idCardFrontMime: "image/png",
            purgeAfter: new Date(Date.now() + (status === "revoked" ? 30 * 86_400_000 : -1_000)),
          },
        }),
      ),
    );
    for (const row of retained) objects.set(row.idCardFrontKey, file.buffer);
    expect(await service.purgeExpired()).toBe(0);
    expect(objects.size).toBe(3);
    expect(
      await prisma.providerQualificationApplication.count({
        where: { id: { in: retained.map((row) => row.id) }, purgedAt: null },
      }),
    ).toBe(3);
  } finally {
    await prisma.$disconnect();
  }
});
